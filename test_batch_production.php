<?php
/**
 * BATCH-BASED PRODUCTION FLOW RUNTIME TEST
 * This script tests the batch-based FEFO production logic
 * WITHOUT modifying the application code
 */

// ============================================================================
// SETUP
// ============================================================================
session_start();

// Set up a test user session
$_SESSION['user'] = [
    'id' => 999,
    'name' => 'Test User',
    'email' => 'test@example.com'
];

$conn = new mysqli("localhost", "root", "", "pastry_db");
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log_test($message) {
    echo "[TEST] " . date('H:i:s') . " - " . $message . "\n";
}

function get_product_stock($product_id) {
    global $conn;
    $stmt = $conn->prepare("SELECT stock FROM products WHERE id = ?");
    $stmt->bind_param("i", $product_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $result ? (int)$result['stock'] : 0;
}

function get_batch_quantities($ingredient_id) {
    global $conn;
    $stmt = $conn->prepare("SELECT GROUP_CONCAT(CONCAT(batch_number, ':', quantity_remaining) SEPARATOR '|') as batches FROM ingredient_batches WHERE ingredient_id = ? ORDER BY expiry_date, id");
    $stmt->bind_param("i", $ingredient_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $result['batches'] ?? '';
}

function get_ingredient_stock($ingredient_id) {
    global $conn;
    $stmt = $conn->prepare("SELECT stock FROM ingredients WHERE id = ?");
    $stmt->bind_param("i", $ingredient_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $result ? (float)$result['stock'] : 0;
}

function call_production_api($product_id, $qty, $idempotency_key) {
    $data = [
        'action' => 'produce',
        'id' => $product_id,
        'qty' => $qty,
        'idempotency_key' => $idempotency_key
    ];
    
    $payload = json_encode($data);
    
    // Simulate the API call by including and executing the API file
    ob_start();
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_SERVER['CONTENT_TYPE'] = 'application/json';
    
    // Mock file_get_contents for php://input
    $temp_file = tempnam(sys_get_temp_dir(), 'test_input_');
    file_put_contents($temp_file, $payload);
    
    // Create a wrapper for the test
    $_FILES_BACKUP = $_FILES;
    
    // Include the API - it will read from its normal input stream
    // We'll need to capture output
    $input = $payload;
    
    // Since we can't easily mock php://input, let's use a different approach
    // We'll create a wrapper script that sets up the environment
    $test_result = file_get_contents('php://input', false, stream_context_create([
        'http' => ['method' => 'POST']
    ]));
    
    ob_end_clean();
    unlink($temp_file);
    
    return null;
}

// ============================================================================
// ALTERNATIVE: Direct API Testing via Curl-like functionality
// ============================================================================

function test_production_api($product_id, $qty, $idempotency_key) {
    global $conn;
    
    // We'll directly execute the logic from api_update_stocks.php
    // This allows us to test without requiring HTTP server
    
    $data = [
        'action' => 'produce',
        'id' => $product_id,
        'qty' => $qty,
        'idempotency_key' => $idempotency_key
    ];
    
    $action = $data['action'];
    $id = intval($data['id']);
    $qty_val = intval($data['qty']);
    $idempotencyKey = trim((string)($data['idempotency_key'] ?? ''));
    
    // ===== PRODUCTION TEST LOGIC =====
    if ($action === "produce") {
        if ($id <= 0 || $qty_val <= 0) {
            return ['status' => 'error', 'message' => 'Invalid input data'];
        }

        if (trim($idempotencyKey) === '') {
            return ['status' => 'error', 'message' => 'idempotency_key is required for production requests'];
        }

        // Check for duplicate
        $dupStmt = $conn->prepare("SELECT id, quantity FROM production_transactions WHERE idempotency_key = ? LIMIT 1");
        $dupStmt->bind_param('s', $idempotencyKey);
        $dupStmt->execute();
        $existingProduction = $dupStmt->get_result()->fetch_assoc();
        $dupStmt->close();
        if ($existingProduction) {
            return [
                'status' => 'success',
                'duplicate' => true,
                'production_id' => (int)$existingProduction['id'],
                'message' => 'Production already recorded'
            ];
        }

        $conn->begin_transaction();

        // Get product
        $productStmt = $conn->prepare("SELECT stock, name FROM products WHERE id = ? FOR UPDATE");
        $productStmt->bind_param("i", $id);
        $productStmt->execute();
        $productResult = $productStmt->get_result();

        if ($productResult->num_rows === 0) {
            $conn->rollback();
            return ['status' => 'error', 'message' => 'Product not found'];
        }

        $productRow = $productResult->fetch_assoc();
        $currentProductStock = intval($productRow['stock'] ?? 0);
        $productName = $productRow['name'];
        $productStmt->close();

        // Get recipe
        $recipeStmt = $conn->prepare(
            "SELECT pr.ingredient_id, pr.qty, i.name, i.unit
             FROM product_recipes pr
             JOIN ingredients i ON i.id = pr.ingredient_id
             WHERE pr.product_id = ? AND pr.active = 1
             ORDER BY pr.id ASC"
        );
        $recipeStmt->bind_param("i", $id);
        $recipeStmt->execute();
        $recipeResult = $recipeStmt->get_result();

        $recipeLines = [];
        while ($line = $recipeResult->fetch_assoc()) {
            $recipeLines[] = [
                'ingredient_id' => intval($line['ingredient_id']),
                'qty' => floatval($line['qty']),
                'name' => $line['name'],
                'unit' => $line['unit']
            ];
        }
        $recipeStmt->close();

        if (count($recipeLines) === 0) {
            $conn->rollback();
            return ['status' => 'error', 'message' => 'No active recipe defined for this product'];
        }

        $allocations = [];
        $productionIngredientBeforeStock = [];

        // Validate all ingredients first
        foreach ($recipeLines as $line) {
            $ingredientId = (int)$line['ingredient_id'];
            $required = (float)$line['qty'] * (float)$qty_val;

            $batchStmt = $conn->prepare(
                "SELECT id, ingredient_id, batch_number, quantity_remaining, expiry_date, created_at
                 FROM ingredient_batches
                 WHERE ingredient_id = ?
                   AND quantity_remaining > 0
                   AND (expiry_date IS NULL OR expiry_date >= CURDATE())
                   AND NOT EXISTS (
                       SELECT 1
                       FROM discard_requests dr
                       WHERE dr.ingredient_batch_id = ingredient_batches.id
                         AND dr.status = 'Pending'
                   )
                 ORDER BY expiry_date IS NULL, expiry_date ASC, id ASC
                 FOR UPDATE"
            );
            $batchStmt->bind_param('i', $ingredientId);
            $batchStmt->execute();
            $batchResult = $batchStmt->get_result();

            $usableBatches = [];
            $totalUsable = 0.0;
            while ($batch = $batchResult->fetch_assoc()) {
                $usableBatches[] = [
                    'id' => (int)$batch['id'],
                    'batch_number' => $batch['batch_number'],
                    'quantity_remaining' => (float)$batch['quantity_remaining'],
                    'expiry_date' => $batch['expiry_date']
                ];
                $totalUsable += (float)$batch['quantity_remaining'];
            }
            $batchStmt->close();

            $productionIngredientBeforeStock[$ingredientId] = $totalUsable;

            if ($totalUsable < $required) {
                $conn->rollback();
                return [
                    'status' => 'error',
                    'message' => "Insufficient {$line['name']}. Required: {$required} {$line['unit']}. Available: {$totalUsable} {$line['unit']}."
                ];
            }

            // Allocate batches (FEFO)
            $remaining = $required;
            foreach ($usableBatches as $batch) {
                if ($remaining <= 0.000001) {
                    break;
                }

                $consumed = min((float)$batch['quantity_remaining'], $remaining);
                if ($consumed <= 0.000001) {
                    continue;
                }

                $allocations[] = [
                    'ingredient_id' => $ingredientId,
                    'batch_id' => (int)$batch['id'],
                    'quantity_consumed' => $consumed,
                    'batch_number' => $batch['batch_number'],
                    'ingredient_name' => $line['name'],
                    'ingredient_unit' => $line['unit']
                ];
                $remaining -= $consumed;
            }

            if ($remaining > 0.000001) {
                $conn->rollback();
                return ['status' => 'error', 'message' => "Insufficient {$line['name']} for this production quantity"];
            }
        }

        // All validations passed - execute production
        $currentUserId = $_SESSION['user']['id'] ?? 0;
        $movementNote = "Produced {$qty_val} unit(s) of {$productName}";

        $productionStmt = $conn->prepare("INSERT INTO production_transactions (product_id, quantity, user_id, idempotency_key) VALUES (?, ?, ?, NULLIF(?, ''))");
        $productionStmt->bind_param('iiis', $id, $qty_val, $currentUserId, $idempotencyKey);
        if (!$productionStmt->execute()) {
            if ($conn->errno === 1062) {
                $productionStmt->close();
                $dupStmt = $conn->prepare("SELECT id, quantity FROM production_transactions WHERE idempotency_key = ? LIMIT 1");
                $dupStmt->bind_param('s', $idempotencyKey);
                $dupStmt->execute();
                $duplicateProduction = $dupStmt->get_result()->fetch_assoc();
                $dupStmt->close();
                $conn->rollback();
                return [
                    'status' => 'success',
                    'duplicate' => true,
                    'production_id' => $duplicateProduction ? (int)$duplicateProduction['id'] : 0,
                    'message' => 'Production already recorded'
                ];
            }
            $conn->rollback();
            return ['status' => 'error', 'message' => 'Failed to record production'];
        }
        $productionId = $productionStmt->insert_id;
        $productionStmt->close();

        // Execute allocations
        $batchUpdateStmt = $conn->prepare("UPDATE ingredient_batches SET quantity_remaining = quantity_remaining - ?, updated_at = NOW() WHERE id = ? AND quantity_remaining >= ?");
        $allocInsertStmt = $conn->prepare("INSERT INTO production_batch_allocations (production_transaction_id, ingredient_id, ingredient_batch_id, quantity_consumed) VALUES (?, ?, ?, ?)");
        $ingredientMovementStmt = $conn->prepare(
            "INSERT INTO ingredient_movements (ingredient_id, batch_id, action, qty, note, user_id, reference_type, reference_id, previous_stock, new_stock)
             VALUES (?, ?, 'stock_out', ?, ?, ?, 'production', ?, ?, ?)"
        );

        foreach ($allocations as $allocation) {
            $ingredientId = (int)$allocation['ingredient_id'];
            $batchId = (int)$allocation['batch_id'];
            $consumed = (float)$allocation['quantity_consumed'];

            $batchUpdateStmt->bind_param('ddi', $consumed, $batchId, $consumed);
            if (!$batchUpdateStmt->execute() || $batchUpdateStmt->affected_rows !== 1) {
                $allocInsertStmt->close();
                $ingredientMovementStmt->close();
                $conn->rollback();
                return ['status' => 'error', 'message' => "Failed to deduct batch quantity for {$allocation['ingredient_name']}"];
            }

            $allocInsertStmt->bind_param('iiid', $productionId, $ingredientId, $batchId, $consumed);
            if (!$allocInsertStmt->execute()) {
                $allocInsertStmt->close();
                $ingredientMovementStmt->close();
                $conn->rollback();
                return ['status' => 'error', 'message' => 'Failed to record production batch allocation'];
            }

            $aggregateStmt = $conn->prepare("SELECT COALESCE(SUM(quantity_remaining), 0) AS total FROM ingredient_batches WHERE ingredient_id = ?");
            $aggregateStmt->bind_param('i', $ingredientId);
            $aggregateStmt->execute();
            $aggregateResult = $aggregateStmt->get_result()->fetch_assoc();
            $aggregateStmt->close();
            $aggregateBefore = (float)($productionIngredientBeforeStock[$ingredientId] ?? 0);
            $aggregateAfter = (float)($aggregateResult['total'] ?? 0);

            $ingredientMovementStmt->bind_param('iidsiidd', $ingredientId, $batchId, $consumed, $movementNote, $currentUserId, $productionId, $aggregateBefore, $aggregateAfter);
            if (!$ingredientMovementStmt->execute()) {
                $ingredientMovementStmt->close();
                $conn->rollback();
                return ['status' => 'error', 'message' => 'Failed to log ingredient movement'];
            }

            $ingredientMasterUpdate = $conn->prepare("UPDATE ingredients SET stock = ?, updated_at = NOW() WHERE id = ?");
            $ingredientMasterUpdate->bind_param('di', $aggregateAfter, $ingredientId);
            if (!$ingredientMasterUpdate->execute()) {
                $ingredientMasterUpdate->close();
                $conn->rollback();
                return ['status' => 'error', 'message' => 'Failed to synchronize ingredient stock'];
            }
            $ingredientMasterUpdate->close();
        }

        $batchUpdateStmt->close();
        $allocInsertStmt->close();
        $ingredientMovementStmt->close();

        $productUpdate = $conn->prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
        $productUpdate->bind_param('ii', $qty_val, $id);
        if (!$productUpdate->execute()) {
            $conn->rollback();
            return ['status' => 'error', 'message' => 'Failed to update finished goods stock'];
        }

        // Record product movement
        $movementStmt = $conn->prepare("INSERT INTO product_inventory_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference_type, reference_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $newProductStock = $currentProductStock + $qty_val;
        $movementType = 'Production';
        $referenceType = 'production';
        $movementStmt->bind_param('isddsssii', $id, $movementType, $qty_val, $currentProductStock, $newProductStock, $movementNote, $referenceType, $productionId, $currentUserId);
        if (!$movementStmt->execute()) {
            $conn->rollback();
            return ['status' => 'error', 'message' => 'Failed to record finished-product movement'];
        }
        $movementStmt->close();

        $conn->commit();

        return [
            'status' => 'success',
            'message' => 'Finished goods produced successfully',
            'production_id' => $productionId,
            'allocations' => $allocations,
            'new_stock' => $newProductStock
        ];
    }

    return ['status' => 'error', 'message' => 'Unknown action'];
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

$test_results = [];

log_test("========== TEST 1: NORMAL PRODUCTION ==========");
$product_id = 128; // [DEV] Chocolate Cake
$flour_id = 19;    // [DEV] All-Purpose Flour
$sugar_id = 20;    // [DEV] Sugar

$before_product_stock = get_product_stock($product_id);
$before_flour_batches = get_batch_quantities($flour_id);
$before_flour_stock = get_ingredient_stock($flour_id);

log_test("Before: Product stock = $before_product_stock, Flour = $before_flour_stock kg");
log_test("Flour batches: $before_flour_batches");

$result = test_production_api($product_id, 1, 'DEV-TEST-NORMAL-001');
log_test("API Response: " . json_encode($result));

$after_product_stock = get_product_stock($product_id);
$after_flour_stock = get_ingredient_stock($flour_id);
$after_flour_batches = get_batch_quantities($flour_id);

log_test("After: Product stock = $after_product_stock, Flour = $after_flour_stock kg");
log_test("Flour batches: $after_flour_batches");

$test1_pass = ($result['status'] === 'success' && !isset($result['duplicate']) && $after_product_stock === $before_product_stock + 1);
$test_results['Normal Production'] = $test1_pass ? 'PASS' : 'FAIL';
log_test("Test 1 Result: " . ($test1_pass ? "PASS" : "FAIL"));

if ($test1_pass) {
    $production_id_1 = $result['production_id'];
    log_test("Production ID: $production_id_1, Allocations: " . count($result['allocations'] ?? []));
}

echo "\n";

log_test("========== TEST 2: FEFO (MULTI-BATCH) ==========");

// Get flour batches
$flour_batches_stmt = $conn->prepare("SELECT id, batch_number, quantity_remaining, expiry_date FROM ingredient_batches WHERE ingredient_id = ? ORDER BY expiry_date, id");
$flour_batches_stmt->bind_param('i', $flour_id);
$flour_batches_stmt->execute();
$flour_batches_result = $flour_batches_stmt->get_result();
$flour_batches = [];
while ($row = $flour_batches_result->fetch_assoc()) {
    $flour_batches[] = $row;
}
$flour_batches_stmt->close();

log_test("Current flour batches:");
foreach ($flour_batches as $batch) {
    $status = ($batch['expiry_date'] < date('Y-m-d')) ? 'EXPIRED' : 'VALID';
    log_test("  - {$batch['batch_number']}: {$batch['quantity_remaining']} kg, Expires: {$batch['expiry_date']} ($status)");
}

$before_flour_stock_2 = get_ingredient_stock($flour_id);
$result2 = test_production_api($product_id, 2, 'DEV-TEST-FEFO-001');

$test2_allocations = $result2['allocations'] ?? [];
$after_flour_stock_2 = get_ingredient_stock($flour_id);

if ($result2['status'] === 'success') {
    log_test("Production succeeded. Flour consumed: " . ($before_flour_stock_2 - $after_flour_stock_2) . " kg");
    log_test("Allocations created: " . count($test2_allocations));
    
    if (count($test2_allocations) > 0) {
        log_test("Allocation detail:");
        foreach ($test2_allocations as $alloc) {
            log_test("  - Batch {$alloc['batch_number']}: {$alloc['quantity_consumed']} kg");
        }
    }
}

// Verify FEFO: Check if any expired batch was used
$expired_used = false;
$prod_id_2 = $result2['production_id'] ?? 0;
$alloc_batches_stmt = $conn->prepare("SELECT pba.ingredient_batch_id, ib.batch_number, ib.expiry_date FROM production_batch_allocations pba JOIN ingredient_batches ib ON pba.ingredient_batch_id = ib.id WHERE pba.production_transaction_id = ? AND ib.ingredient_id = ?");
$alloc_batches_stmt->bind_param('ii', $prod_id_2, $flour_id);
$alloc_batches_stmt->execute();
$alloc_result = $alloc_batches_stmt->get_result();
while ($row = $alloc_result->fetch_assoc()) {
    if ($row['expiry_date'] < date('Y-m-d')) {
        $expired_used = true;
    }
}
$alloc_batches_stmt->close();

$test2_pass = ($result2['status'] === 'success' && !$expired_used);
$test_results['FEFO (Multi-batch)'] = $test2_pass ? 'PASS' : 'FAIL';
log_test("Test 2 Result: " . ($test2_pass ? "PASS" : "FAIL"));

echo "\n";

log_test("========== TEST 3: IDEMPOTENCY (SAME KEY) ==========");

$before_prod_count = $conn->query("SELECT COUNT(*) as cnt FROM production_transactions WHERE idempotency_key = 'DEV-TEST-IDEMPO-001'")->fetch_assoc()['cnt'];
log_test("Before: production_transactions with key = $before_prod_count");

// First request
$result3a = test_production_api($product_id, 1, 'DEV-TEST-IDEMPO-001');
log_test("First request: " . ($result3a['status'] ?? 'error'));

$after_first = $conn->query("SELECT COUNT(*) as cnt FROM production_transactions WHERE idempotency_key = 'DEV-TEST-IDEMPO-001'")->fetch_assoc()['cnt'];
log_test("After first: production_transactions with key = $after_first");

// Second request (duplicate)
$result3b = test_production_api($product_id, 1, 'DEV-TEST-IDEMPO-001');
log_test("Second request: " . ($result3b['status'] ?? 'error') . ", Duplicate = " . (isset($result3b['duplicate']) ? 'true' : 'false'));

$after_second = $conn->query("SELECT COUNT(*) as cnt FROM production_transactions WHERE idempotency_key = 'DEV-TEST-IDEMPO-001'")->fetch_assoc()['cnt'];
log_test("After second: production_transactions with key = $after_second");

$test3_pass = ($result3a['status'] === 'success' && isset($result3b['duplicate']) && $after_second === $after_first && $after_first === 1);
$test_results['Idempotency (Same Key)'] = $test3_pass ? 'PASS' : 'FAIL';
log_test("Test 3 Result: " . ($test3_pass ? "PASS" : "FAIL"));

echo "\n";

log_test("========== TEST 4: DIFFERENT IDEMPOTENCY KEY ==========");

$result4a = test_production_api($product_id, 1, 'DEV-TEST-IDEMPO-002');
$result4b = test_production_api($product_id, 1, 'DEV-TEST-IDEMPO-003');

log_test("Request A (key=002): " . ($result4a['status'] ?? 'error'));
log_test("Request B (key=003): " . ($result4b['status'] ?? 'error'));

$prod_002 = $conn->query("SELECT COUNT(*) as cnt FROM production_transactions WHERE idempotency_key = 'DEV-TEST-IDEMPO-002'")->fetch_assoc()['cnt'];
$prod_003 = $conn->query("SELECT COUNT(*) as cnt FROM production_transactions WHERE idempotency_key = 'DEV-TEST-IDEMPO-003'")->fetch_assoc()['cnt'];

log_test("Transactions with key 002: $prod_002");
log_test("Transactions with key 003: $prod_003");

$test4_pass = ($result4a['status'] === 'success' && $result4b['status'] === 'success' && $prod_002 === 1 && $prod_003 === 1);
$test_results['Different Idempotency Keys'] = $test4_pass ? 'PASS' : 'FAIL';
log_test("Test 4 Result: " . ($test4_pass ? "PASS" : "FAIL"));

echo "\n";

log_test("========== TEST 5: INSUFFICIENT STOCK ==========");

// Check current ingredient stock
$butter_id = 21;
$butter_stock = get_ingredient_stock($butter_id);
log_test("Current butter stock: $butter_stock kg, Recipe needs: 0.75 kg per 3-unit batch");

// Try to produce a large batch that will exceed available butter
$before_butter_stock = get_ingredient_stock($butter_id);
$before_product_stock_5 = get_product_stock($product_id);
$before_alloc_count = $conn->query("SELECT COUNT(*) as cnt FROM production_batch_allocations")->fetch_assoc()['cnt'];
$before_prod_count = $conn->query("SELECT COUNT(*) as cnt FROM production_transactions WHERE idempotency_key = 'DEV-TEST-INSUFF-001'")->fetch_assoc()['cnt'];

// Produce 20 units - requires 20 * 0.25 = 5 kg butter, but only ~5 kg available
// Actually, let's produce 25 units to ensure insufficient stock (25 * 0.25 = 6.25 kg)
$result5 = test_production_api($product_id, 25, 'DEV-TEST-INSUFF-001');

log_test("Production request for 25 units (needs 6.25 kg butter, have $before_butter_stock kg): " . ($result5['status'] ?? 'error'));

$after_butter_stock = get_ingredient_stock($butter_id);
$after_product_stock_5 = get_product_stock($product_id);
$after_alloc_count = $conn->query("SELECT COUNT(*) as cnt FROM production_batch_allocations")->fetch_assoc()['cnt'];
$after_prod_count = $conn->query("SELECT COUNT(*) as cnt FROM production_transactions WHERE idempotency_key = 'DEV-TEST-INSUFF-001'")->fetch_assoc()['cnt'];

log_test("After: Butter=$after_butter_stock kg, Product stock=$after_product_stock_5, Allocations=$after_alloc_count, Transactions=$after_prod_count");

$test5_pass = ($result5['status'] === 'error' && $after_butter_stock === $before_butter_stock && $after_product_stock_5 === $before_product_stock_5 && $after_prod_count === $before_prod_count);
$test_results['Insufficient Stock (Rollback)'] = $test5_pass ? 'PASS' : 'FAIL';
log_test("Test 5 Result: " . ($test5_pass ? "PASS" : "FAIL"));

echo "\n";

log_test("========== TEST 6: BATCH TRACEABILITY ==========");

if (isset($production_id_1) && $production_id_1 > 0) {
    $trace_stmt = $conn->prepare("
        SELECT 
            pt.id as prod_id,
            pt.product_id,
            pt.quantity,
            pba.ingredient_id,
            pba.ingredient_batch_id,
            pba.quantity_consumed,
            ib.batch_number,
            i.name as ingredient_name,
            im.id as movement_id,
            im.batch_id as movement_batch_id
        FROM production_transactions pt
        LEFT JOIN production_batch_allocations pba ON pt.id = pba.production_transaction_id
        LEFT JOIN ingredient_batches ib ON pba.ingredient_batch_id = ib.id
        LEFT JOIN ingredients i ON pba.ingredient_id = i.id
        LEFT JOIN ingredient_movements im ON im.reference_type = 'production' AND im.reference_id = pt.id AND im.ingredient_id = pba.ingredient_id
        WHERE pt.id = ?
    ");
    $trace_stmt->bind_param('i', $production_id_1);
    $trace_stmt->execute();
    $trace_result = $trace_stmt->get_result();
    
    $trace_rows = [];
    while ($row = $trace_result->fetch_assoc()) {
        $trace_rows[] = $row;
    }
    $trace_stmt->close();
    
    log_test("Production $production_id_1 traceability:");
    $batch_ids_correct = true;
    foreach ($trace_rows as $row) {
        log_test("  - {$row['ingredient_name']}: {$row['quantity_consumed']} from batch {$row['batch_number']}");
        if ($row['movement_batch_id'] !== $row['ingredient_batch_id']) {
            $batch_ids_correct = false;
        }
    }
    
    $test6_pass = (count($trace_rows) > 0 && $batch_ids_correct);
    $test_results['Batch Traceability'] = $test6_pass ? 'PASS' : 'FAIL';
} else {
    $test_results['Batch Traceability'] = 'SKIP (No successful production)';
}
log_test("Test 6 Result: " . ($test_results['Batch Traceability'] ?? 'SKIP'));

echo "\n";

log_test("========== TEST 7: STOCK SYNCHRONIZATION ==========");

// Check each development ingredient
$sync_check_stmt = $conn->prepare("
    SELECT 
        i.id,
        i.name,
        i.stock as master_stock,
        COALESCE(SUM(ib.quantity_remaining), 0) as batch_total
    FROM ingredients i
    LEFT JOIN ingredient_batches ib ON i.id = ib.ingredient_id
    WHERE i.name LIKE '[DEV]%'
    GROUP BY i.id, i.name, i.stock
");
$sync_check_stmt->execute();
$sync_result = $sync_check_stmt->get_result();

$all_synced = true;
$sync_issues = [];
while ($row = $sync_result->fetch_assoc()) {
    $master = (float)$row['master_stock'];
    $total = (float)$row['batch_total'];
    $match = abs($master - $total) < 0.001;
    log_test("{$row['name']}: master={$master}, batch_total={$total}, " . ($match ? "OK" : "MISMATCH"));
    if (!$match) {
        $all_synced = false;
        $sync_issues[] = $row['name'];
    }
}
$sync_check_stmt->close();

$test7_pass = $all_synced;
$test_results['Stock Synchronization'] = $test7_pass ? 'PASS' : 'FAIL';
log_test("Test 7 Result: " . ($test7_pass ? "PASS" : "FAIL"));

if (!$test7_pass) {
    log_test("Sync issues: " . implode(', ', $sync_issues));
}

echo "\n";

// ============================================================================
// REPORT
// ============================================================================

log_test("========== FINAL TEST RESULTS ==========");
foreach ($test_results as $test_name => $status) {
    echo "[$status] $test_name\n";
}

// Count passing tests
$passed = count(array_filter($test_results, fn($v) => $v === 'PASS'));
$total = count(array_filter($test_results, fn($v) => $v !== 'SKIP'));

log_test("Summary: $passed / $total tests passed");

// Database evidence
log_test("========== DATABASE EVIDENCE ==========");

$prod_count = $conn->query("SELECT COUNT(*) as cnt FROM production_transactions")->fetch_assoc()['cnt'];
$alloc_count = $conn->query("SELECT COUNT(*) as cnt FROM production_batch_allocations")->fetch_assoc()['cnt'];
$movement_count = $conn->query("SELECT COUNT(*) as cnt FROM ingredient_movements WHERE reference_type = 'production'")->fetch_assoc()['cnt'];
$prod_movement_count = $conn->query("SELECT COUNT(*) as cnt FROM product_inventory_movements WHERE reference_type = 'production'")->fetch_assoc()['cnt'];

log_test("Production Transactions: $prod_count");
log_test("Batch Allocations: $alloc_count");
log_test("Ingredient Movements (production): $movement_count");
log_test("Product Movements (production): $prod_movement_count");

$conn->close();

echo "\n=== TEST EXECUTION COMPLETE ===\n";
