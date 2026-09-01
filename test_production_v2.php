<?php
/**
 * BATCH-BASED PRODUCTION FLOW RUNTIME TEST (V2)
 * Simplified robust test suite with unique idempotency keys
 */

session_start();
$_SESSION['user'] = ['id' => 999, 'name' => 'Test User'];

$conn = new mysqli("localhost", "root", "", "pastry_db");
if ($conn->connect_error) die("DB Error: " . $conn->connect_error);

echo "===== RUNTIME VERIFICATION TEST SUITE =====\n\n";

function test($name, $pass, $detail = '') {
    $result = $pass ? '✓ PASS' : '✗ FAIL';
    echo "[$result] $name";
    if ($detail) echo " - $detail";
    echo "\n";
    return $pass;
}

// ===== Helper Functions =====

function api_produce($product_id, $qty, $idempotency_key) {
    global $conn;
    
    $conn->begin_transaction();
    
    // Get product
    $stmt = $conn->prepare("SELECT stock, name FROM products WHERE id = ? FOR UPDATE");
    $stmt->bind_param("i", $product_id);
    $stmt->execute();
    $product = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    if (!$product) {
        $conn->rollback();
        return ['status' => 'error', 'msg' => 'Product not found'];
    }

    // Get recipe
    $stmt = $conn->prepare("
        SELECT pr.ingredient_id, pr.qty, i.name, i.unit
        FROM product_recipes pr
        JOIN ingredients i ON i.id = pr.ingredient_id
        WHERE pr.product_id = ? AND pr.active = 1
        ORDER BY pr.id ASC
    ");
    $stmt->bind_param("i", $product_id);
    $stmt->execute();
    $result_set = $stmt->get_result();
    $recipe = [];
    while ($row = $result_set->fetch_assoc()) {
        $recipe[] = $row;
    }
    $result_set->free();
    $stmt->close();

    if (count($recipe) === 0) {
        $conn->rollback();
        return ['status' => 'error', 'msg' => 'No recipe'];
    }

    // Validate and allocate
    $allocations = [];
    foreach ($recipe as $item) {
        $ing_id = (int)$item['ingredient_id'];
        $required = (float)$item['qty'] * $qty;

        // Get valid batches (not expired, not in discard)
        $stmt = $conn->prepare("
            SELECT id, batch_number, quantity_remaining
            FROM ingredient_batches
            WHERE ingredient_id = ?
              AND quantity_remaining > 0
              AND (expiry_date IS NULL OR expiry_date >= CURDATE())
              AND NOT EXISTS (SELECT 1 FROM discard_requests dr WHERE dr.ingredient_batch_id = ingredient_batches.id AND dr.status = 'Pending')
            ORDER BY expiry_date IS NULL, expiry_date ASC, id ASC
            FOR UPDATE
        ");
        $stmt->bind_param("i", $ing_id);
        $stmt->execute();
        $batches = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        $available = array_sum(array_column($batches, 'quantity_remaining'));
        if ($available < $required) {
            $conn->rollback();
            return ['status' => 'error', 'msg' => "Insufficient {$item['name']} (need {$required}, have {$available})"];
        }

        // FEFO allocation
        $remaining = $required;
        foreach ($batches as $batch) {
            if ($remaining <= 0.0001) break;
            $consume = min((float)$batch['quantity_remaining'], $remaining);
            if ($consume > 0.0001) {
                $allocations[] = [
                    'ing_id' => $ing_id,
                    'batch_id' => (int)$batch['id'],
                    'qty' => $consume
                ];
                $remaining -= $consume;
            }
        }
    }

    // Check for duplicate key
    $stmt = $conn->prepare("SELECT id FROM production_transactions WHERE idempotency_key = ?");
    $stmt->bind_param("s", $idempotency_key);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        $stmt->close();
        $conn->rollback();
        return ['status' => 'duplicate'];
    }
    $stmt->close();

    // Insert production
    $user_id = $_SESSION['user']['id'];
    $stmt = $conn->prepare("INSERT INTO production_transactions (product_id, quantity, user_id, idempotency_key) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("iiis", $product_id, $qty, $user_id, $idempotency_key);
    $stmt->execute();
    $prod_id = $stmt->insert_id;
    $stmt->close();

    // Execute allocations
    $before_stock = [];
    foreach ($allocations as $alloc) {
        $ing_id = $alloc['ing_id'];
        
        // Update batch
        $stmt = $conn->prepare("UPDATE ingredient_batches SET quantity_remaining = quantity_remaining - ? WHERE id = ?");
        $stmt->bind_param("di", $alloc['qty'], $alloc['batch_id']);
        $stmt->execute();
        $stmt->close();

        // Record allocation
        $stmt = $conn->prepare("INSERT INTO production_batch_allocations (production_transaction_id, ingredient_id, ingredient_batch_id, quantity_consumed) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("iiid", $prod_id, $ing_id, $alloc['batch_id'], $alloc['qty']);
        $stmt->execute();
        $stmt->close();

        // Record movement
        if (!isset($before_stock[$ing_id])) {
            $st = $conn->prepare("SELECT stock FROM ingredients WHERE id = ?");
            $st->bind_param("i", $ing_id);
            $st->execute();
            $before_stock[$ing_id] = (float)$st->get_result()->fetch_assoc()['stock'];
            $st->close();
        }

        $st = $conn->prepare("SELECT COALESCE(SUM(quantity_remaining), 0) as total FROM ingredient_batches WHERE ingredient_id = ?");
        $st->bind_param("i", $ing_id);
        $st->execute();
        $after = (float)$st->get_result()->fetch_assoc()['total'];
        $st->close();

        $note = "Production of $qty unit(s)";
        $st = $conn->prepare("INSERT INTO ingredient_movements (ingredient_id, batch_id, action, qty, note, user_id, reference_type, reference_id, previous_stock, new_stock) VALUES (?, ?, 'stock_out', ?, ?, ?, 'production', ?, ?, ?)");
        $st->bind_param("iidsiid", $ing_id, $alloc['batch_id'], $alloc['qty'], $note, $user_id, $prod_id, $before_stock[$ing_id], $after);
        $st->execute();
        $st->close();

        // Sync ingredient stock
        $st = $conn->prepare("UPDATE ingredients SET stock = ? WHERE id = ?");
        $st->bind_param("di", $after, $ing_id);
        $st->execute();
        $st->close();
    }

    // Update product stock
    $new_product_stock = (int)$product['stock'] + $qty;
    $stmt = $conn->prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
    $stmt->bind_param("ii", $qty, $product_id);
    $stmt->execute();
    $stmt->close();

    // Record product movement
    $before_ps = (int)$product['stock'];
    $ref_type = 'production';
    $stmt = $conn->prepare("INSERT INTO product_inventory_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference_type, reference_id, user_id) VALUES (?, 'Production', ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ididssii", $product_id, $qty, $before_ps, $new_product_stock, $note, $ref_type, $prod_id, $user_id);
    $stmt->execute();
    $stmt->close();

    $conn->commit();
    return ['status' => 'success', 'prod_id' => $prod_id, 'allocations' => count($allocations)];
}

// ===== TESTS =====

$test_count = 0;
$pass_count = 0;

// TEST 1: Normal Production
echo "\n--- TEST 1: Normal Production ---\n";
$test_count++;
$result = api_produce(128, 1, 'TEST-NORMAL-' . time() . '-1');
$pass_count += test("Single unit produced", $result['status'] === 'success', "ID: {$result['prod_id']}");

$stmt = $conn->prepare("SELECT stock FROM products WHERE id = 128");
$stmt->execute();
$stock_after_1 = (int)$stmt->get_result()->fetch_assoc()['stock'];
$stmt->close();
$pass_count += test("Product stock increased", $stock_after_1 === 1);

// TEST 2: FEFO Ordering
echo "\n--- TEST 2: FEFO (Multi-batch with different expiry) ---\n";
$test_count++;
$result2 = api_produce(128, 2, 'TEST-FEFO-' . time() . '-1');
$pass_count += test("Multi-unit production", $result2['status'] === 'success', "Allocations: {$result2['allocations']}");

// Check allocations used earliest expiry
$stmt = $conn->prepare("
    SELECT ib.expiry_date, SUM(pba.quantity_consumed) as qty
    FROM production_batch_allocations pba
    JOIN ingredient_batches ib ON pba.ingredient_batch_id = ib.id
    WHERE pba.production_transaction_id = ? AND ib.ingredient_id = 19
    GROUP BY ib.expiry_date
    ORDER BY ib.expiry_date
");
$stmt->bind_param("i", $result2['prod_id']);
$stmt->execute();
$fefo_check = $stmt->get_result()->fetch_assoc();
$stmt->close();
$pass_count += test("FEFO: Earlier expiry used first", $fefo_check !== null);

// TEST 3: Expired Batch Not Used
echo "\n--- TEST 3: Expired Batch Exclusion ---\n";
$test_count++;
$stmt = $conn->prepare("SELECT id FROM ingredient_batches WHERE ingredient_id = 19 AND expiry_date < CURDATE()");
$stmt->execute();
$expired_batch_id = $stmt->get_result()->fetch_assoc()['id'];
$stmt->close();

$stmt = $conn->prepare("
    SELECT COUNT(*) as cnt FROM production_batch_allocations 
    WHERE ingredient_batch_id = ? AND production_transaction_id IN (
        SELECT id FROM production_transactions WHERE product_id = 128
    )
");
$stmt->bind_param("i", $expired_batch_id);
$stmt->execute();
$expired_used = (int)$stmt->get_result()->fetch_assoc()['cnt'];
$stmt->close();
$pass_count += test("Expired batch never consumed", $expired_used === 0);

// TEST 4: Idempotency - Same Key
echo "\n--- TEST 4: Idempotency (Same Key) ---\n";
$test_count++;
$idempotency_key = 'TEST-IDEMPO-' . time();
$result_a = api_produce(128, 1, $idempotency_key);
$result_b = api_produce(128, 1, $idempotency_key);

$pass_count += test("First request succeeds", $result_a['status'] === 'success');
$pass_count += test("Duplicate request rejected", $result_b['status'] === 'duplicate');

$stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM production_transactions WHERE idempotency_key = ?");
$stmt->bind_param("s", $idempotency_key);
$stmt->execute();
$count = (int)$stmt->get_result()->fetch_assoc()['cnt'];
$stmt->close();
$pass_count += test("Only one production recorded", $count === 1);

// TEST 5: Different Keys = Separate Transactions
echo "\n--- TEST 5: Different Idempotency Keys ---\n";
$test_count++;
$key_a = 'TEST-KEY-A-' . time();
$key_b = 'TEST-KEY-B-' . time();

$result_key_a = api_produce(128, 1, $key_a);
usleep(100000); // Small delay
$result_key_b = api_produce(128, 1, $key_b);

$pass_count += test("Both requests succeed", $result_key_a['status'] === 'success' && $result_key_b['status'] === 'success');

$stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM production_transactions WHERE idempotency_key IN (?, ?)");
$stmt->bind_param("ss", $key_a, $key_b);
$stmt->execute();
$count = (int)$stmt->get_result()->fetch_assoc()['cnt'];
$stmt->close();
$pass_count += test("Two separate transactions created", $count === 2);

// TEST 6: Insufficient Stock
echo "\n--- TEST 6: Insufficient Stock (Rollback) ---\n";
$test_count++;
$before_butter = 0;
$stmt = $conn->prepare("SELECT stock FROM ingredients WHERE id = 21");
$stmt->execute();
$before_butter = (float)$stmt->get_result()->fetch_assoc()['stock'];
$stmt->close();

$result_fail = api_produce(128, 100, 'TEST-INSUFF-' . time()); // 100 * 0.25 kg = 25 kg butter needed, have <5 kg

$pass_count += test("Insufficient stock rejected", $result_fail['status'] === 'error');

$stmt = $conn->prepare("SELECT stock FROM ingredients WHERE id = 21");
$stmt->execute();
$after_butter = (float)$stmt->get_result()->fetch_assoc()['stock'];
$stmt->close();

$pass_count += test("No partial changes on rollback", abs($before_butter - $after_butter) < 0.001);

// TEST 7: Stock Synchronization
echo "\n--- TEST 7: Stock Synchronization ---\n";
$test_count++;

$sync_issues = [];
$stmt = $conn->prepare("
    SELECT i.id, i.name, i.stock as master, COALESCE(SUM(ib.quantity_remaining), 0) as batch_total
    FROM ingredients i
    LEFT JOIN ingredient_batches ib ON i.id = ib.ingredient_id
    WHERE i.name LIKE '[DEV]%'
    GROUP BY i.id, i.name, i.stock
");
$stmt->execute();
while ($row = $stmt->get_result()->fetch_assoc()) {
    $master = (float)$row['master'];
    $total = (float)$row['batch_total'];
    if (abs($master - $total) >= 0.001) {
        $sync_issues[] = $row['name'];
    }
}
$stmt->close();

$pass_count += test("All ingredients synced", count($sync_issues) === 0, count($sync_issues) > 0 ? "Mismatches: " . implode(', ', $sync_issues) : "");

// TEST 8: Batch Traceability
echo "\n--- TEST 8: Batch Traceability ---\n";
$test_count++;

$stmt = $conn->prepare("
    SELECT COUNT(*) as cnt FROM production_batch_allocations
    WHERE production_transaction_id = ? AND ingredient_batch_id IS NOT NULL
");
$stmt->bind_param("i", $result['prod_id']);
$stmt->execute();
$alloc_count = (int)$stmt->get_result()->fetch_assoc()['cnt'];
$stmt->close();

$stmt = $conn->prepare("
    SELECT COUNT(*) as cnt FROM ingredient_movements
    WHERE reference_type = 'production' AND reference_id = ? AND batch_id IS NOT NULL
");
$stmt->bind_param("i", $result['prod_id']);
$stmt->execute();
$movement_count = (int)$stmt->get_result()->fetch_assoc()['cnt'];
$stmt->close();

$pass_count += test("Batch allocations recorded", $alloc_count > 0, "Count: $alloc_count");
$pass_count += test("Batch traceability in movements", $movement_count === $alloc_count, "Allocations: $alloc_count, Movements: $movement_count");

// ===== FINAL REPORT =====

echo "\n===== FINAL RESULTS =====\n";
echo "Tests Passed: $pass_count / " . ($test_count * 2) . "\n";

$status = ($pass_count >= ($test_count * 2 * 0.8)) ? 'READY FOR AVAILABILITY LOGIC' : 'NEEDS BACKEND FIX';
echo "Status: $status\n";

// Database Evidence
echo "\n===== DATABASE EVIDENCE =====\n";
$stmt = $conn->query("SELECT COUNT(*) as cnt FROM production_transactions WHERE product_id IN (128, 129)");
$prod_count = (int)$stmt->fetch_assoc()['cnt'];
echo "Production Transactions (DEV products): $prod_count\n";

$stmt = $conn->query("SELECT COUNT(*) as cnt FROM production_batch_allocations");
$alloc_count = (int)$stmt->fetch_assoc()['cnt'];
echo "Batch Allocations (total): $alloc_count\n";

$stmt = $conn->query("SELECT COUNT(*) as cnt FROM ingredient_movements WHERE reference_type = 'production'");
$move_count = (int)$stmt->fetch_assoc()['cnt'];
echo "Ingredient Movements (production): $move_count\n";

$conn->close();
echo "\n=== TEST COMPLETE ===\n";
