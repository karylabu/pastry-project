<?php
require_once __DIR__ . '/../includes/api_auth.php';
require_once __DIR__ . '/../includes/inventory.php';

requireInventoryWrite();

function getSessionUserId(): int {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        @session_start();
    }
    return isset($_SESSION['user']['id']) ? intval($_SESSION['user']['id']) : 0;
}

function insertAuditLog(mysqli $conn, int $userId, string $context, string $action, string $entityType, int $entityId, string $note): bool {
    $stmt = $conn->prepare(
        "INSERT INTO audit_log (user_id, context, action, entity_type, entity_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())"
    );
    if (!$stmt) {
        return false;
    }

    $stmt->bind_param('isssis', $userId, $context, $action, $entityType, $entityId, $note);
    $ok = $stmt->execute();
    $stmt->close();
    return $ok;
}

$conn = new mysqli("localhost", "root", "", "pastry_db");

if ($conn->connect_error) {
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed"
    ]);
    exit;
}

/* ================= INPUT ================= */

$data = json_decode(file_get_contents("php://input"), true);

$action = trim($data['action'] ?? "");
$id     = intval($data['id'] ?? 0);

// INTEGRITY: quantities must be whole numbers — silently truncating a
// decimal (intval("2.9") === 2) would corrupt stock records.
$rawQty = $data['qty'] ?? 0;
if (is_string($rawQty)) {
    $rawQty = trim($rawQty);
}
if (!is_numeric($rawQty) || floor((float) $rawQty) != (float) $rawQty) {
    echo json_encode(["status" => "error", "message" => "Quantity must be a whole number"]);
    exit;
}
$qty    = intval($rawQty);

// Keep movement reasons within the column limit so inserts cannot fail late
// inside an open transaction.
$reason = mb_substr(trim((string) ($data['reason'] ?? $data['note'] ?? 'Manual stock adjustment')), 0, 255);
$type   = $data['type'] ?? $action;
$productVariantId = intval($data['product_variant_id'] ?? 0);

// DUPLICATE PROTECTION: optional client idempotency key (same pattern as
// waste logging). Replaying the same key returns the original result
// instead of producing twice.
$idempotencyKey = trim((string) ($data['idempotency_key'] ?? ''));
if (strlen($idempotencyKey) > 100) {
    echo json_encode(["status" => "error", "message" => "idempotency_key is too long"]);
    exit;
}

if ($action === "produce") {
    if ($id <= 0 || $qty <= 0) {
        echo json_encode([
            "status" => "error",
            "message" => "Invalid input data"
        ]);
        exit;
    }

    if (trim((string) $idempotencyKey) === '') {
        echo json_encode([
            "status" => "error",
            "message" => "idempotency_key is required for production requests"
        ]);
        exit;
    }

    $dupStmt = $conn->prepare("SELECT id, quantity FROM production_transactions WHERE idempotency_key = ? LIMIT 1");
    $dupStmt->bind_param('s', $idempotencyKey);
    $dupStmt->execute();
    $existingProduction = $dupStmt->get_result()->fetch_assoc();
    $dupStmt->close();
    if ($existingProduction) {
        echo json_encode([
            "status" => "success",
            "duplicate" => true,
            "production_id" => (int) $existingProduction['id'],
            "message" => "Production already recorded"
        ]);
        exit;
    }

    $conn->begin_transaction();

    $productStmt = $conn->prepare("SELECT stock, name FROM products WHERE id = ? FOR UPDATE");
    $productStmt->bind_param("i", $id);
    $productStmt->execute();
    $productResult = $productStmt->get_result();

    if ($productResult->num_rows === 0) {
        $conn->rollback();
        echo json_encode([
            "status" => "error",
            "message" => "Product not found"
        ]);
        exit;
    }

    $productRow = $productResult->fetch_assoc();
    $currentProductStock = intval($productRow['stock'] ?? 0);
    $productName = $productRow['name'];
    $productStmt->close();

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
        echo json_encode([
            "status" => "error",
            "message" => "No active recipe defined for this product"
        ]);
        exit;
    }

    $ingredientUsableStock = [];
    $allocations = [];
    $productionIngredientBeforeStock = [];

    foreach ($recipeLines as $line) {
        $ingredientId = (int) $line['ingredient_id'];
        $required = (float) $line['qty'] * (float) $qty;

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
                'id' => (int) $batch['id'],
                'batch_number' => $batch['batch_number'],
                'quantity_remaining' => (float) $batch['quantity_remaining'],
                'expiry_date' => $batch['expiry_date']
            ];
            $totalUsable += (float) $batch['quantity_remaining'];
        }
        $batchStmt->close();

        $ingredientUsableStock[$ingredientId] = $totalUsable;
        $productionIngredientBeforeStock[$ingredientId] = $totalUsable;

        if ($totalUsable < $required) {
            $conn->rollback();
            echo json_encode([
                "status" => "error",
                "message" => "Insufficient {$line['name']}. Required: {$required} {$line['unit']}. Available: {$totalUsable} {$line['unit']}."
            ]);
            exit;
        }

        $remaining = $required;
        foreach ($usableBatches as $batch) {
            if ($remaining <= 0.000001) {
                break;
            }

            $consumed = min((float) $batch['quantity_remaining'], $remaining);
            if ($consumed <= 0.000001) {
                continue;
            }

            $allocations[] = [
                'ingredient_id' => $ingredientId,
                'batch_id' => (int) $batch['id'],
                'quantity_consumed' => $consumed,
                'batch_number' => $batch['batch_number'],
                'ingredient_name' => $line['name'],
                'ingredient_unit' => $line['unit']
            ];
            $remaining -= $consumed;
        }

        if ($remaining > 0.000001) {
            $conn->rollback();
            echo json_encode([
                "status" => "error",
                "message" => "Insufficient {$line['name']} for this production quantity"
            ]);
            exit;
        }
    }

    $currentUserId = inventoryUserId();
    $movementNote = "Produced {$qty} unit(s) of {$productName}";

    $productionStmt = $conn->prepare("INSERT INTO production_transactions (product_id, quantity, user_id, idempotency_key) VALUES (?, ?, ?, NULLIF(?, ''))");
    $productionStmt->bind_param('iiis', $id, $qty, $currentUserId, $idempotencyKey);
    if (!$productionStmt->execute()) {
        if ($conn->errno === 1062) {
            $productionStmt->close();
            $dupStmt = $conn->prepare("SELECT id, quantity FROM production_transactions WHERE idempotency_key = ? LIMIT 1");
            $dupStmt->bind_param('s', $idempotencyKey);
            $dupStmt->execute();
            $duplicateProduction = $dupStmt->get_result()->fetch_assoc();
            $dupStmt->close();
            $conn->rollback();
            echo json_encode([
                "status" => "success",
                "duplicate" => true,
                "production_id" => $duplicateProduction ? (int) $duplicateProduction['id'] : 0,
                "message" => "Production already recorded"
            ]);
            exit;
        }
        $conn->rollback();
        echo json_encode(["status" => "error", "message" => "Failed to record production"]);
        exit;
    }
    $productionId = $productionStmt->insert_id;
    $productionStmt->close();

    $batchUpdateStmt = $conn->prepare("UPDATE ingredient_batches SET quantity_remaining = quantity_remaining - ?, updated_at = NOW() WHERE id = ? AND quantity_remaining >= ?");
    $allocInsertStmt = $conn->prepare("INSERT INTO production_batch_allocations (production_transaction_id, ingredient_id, ingredient_batch_id, quantity_consumed) VALUES (?, ?, ?, ?)");
    $ingredientMovementStmt = $conn->prepare(
        "INSERT INTO ingredient_movements (ingredient_id, batch_id, action, qty, note, user_id, reference_type, reference_id, previous_stock, new_stock)
         VALUES (?, ?, 'stock_out', ?, ?, ?, 'production', ?, ?, ?)"
    );

    foreach ($allocations as $allocation) {
        $ingredientId = (int) $allocation['ingredient_id'];
        $batchId = (int) $allocation['batch_id'];
        $consumed = (float) $allocation['quantity_consumed'];

        $batchUpdateStmt->bind_param('ddi', $consumed, $batchId, $consumed);
        if (!$batchUpdateStmt->execute() || $batchUpdateStmt->affected_rows !== 1) {
            $allocInsertStmt->close();
            $ingredientMovementStmt->close();
            $conn->rollback();
            echo json_encode([
                "status" => "error",
                "message" => "Failed to deduct batch quantity for {$allocation['ingredient_name']}"
            ]);
            exit;
        }

        $allocInsertStmt->bind_param('iiid', $productionId, $ingredientId, $batchId, $consumed);
        if (!$allocInsertStmt->execute()) {
            $allocInsertStmt->close();
            $ingredientMovementStmt->close();
            $conn->rollback();
            echo json_encode([
                "status" => "error",
                "message" => "Failed to record production batch allocation"
            ]);
            exit;
        }

        $aggregateStmt = $conn->prepare("SELECT COALESCE(SUM(quantity_remaining), 0) AS total FROM ingredient_batches WHERE ingredient_id = ?");
        $aggregateStmt->bind_param('i', $ingredientId);
        $aggregateStmt->execute();
        $aggregateResult = $aggregateStmt->get_result()->fetch_assoc();
        $aggregateStmt->close();
        $aggregateBefore = (float) ($productionIngredientBeforeStock[$ingredientId] ?? 0);
        $aggregateAfter = (float) ($aggregateResult['total'] ?? 0);

        $ingredientMovementStmt->bind_param('iidsiidd', $ingredientId, $batchId, $consumed, $movementNote, $currentUserId, $productionId, $aggregateBefore, $aggregateAfter);
        if (!$ingredientMovementStmt->execute()) {
            $ingredientMovementStmt->close();
            $conn->rollback();
            echo json_encode([
                "status" => "error",
                "message" => "Failed to log ingredient movement"
            ]);
            exit;
        }

        $ingredientMasterUpdate = $conn->prepare("UPDATE ingredients SET stock = ?, updated_at = NOW() WHERE id = ?");
        $ingredientMasterUpdate->bind_param('di', $aggregateAfter, $ingredientId);
        if (!$ingredientMasterUpdate->execute()) {
            $ingredientMasterUpdate->close();
            $conn->rollback();
            echo json_encode([
                "status" => "error",
                "message" => "Failed to synchronize ingredient stock"
            ]);
            exit;
        }
        $ingredientMasterUpdate->close();
    }

    $batchUpdateStmt->close();
    $allocInsertStmt->close();
    $ingredientMovementStmt->close();

    $productUpdate = $conn->prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
    $productUpdate->bind_param('ii', $qty, $id);
    if (!$productUpdate->execute()) {
        $conn->rollback();
        echo json_encode([
            "status" => "error",
            "message" => "Failed to update finished goods stock"
        ]);
        exit;
    }

    if (!recordProductMovement($conn, $id, 'Production', $qty, $currentProductStock, $currentProductStock + $qty, $movementNote, 'production', $productionId, $currentUserId)) {
        $conn->rollback();
        echo json_encode(["status" => "error", "message" => "Failed to record finished-product movement"]);
        exit;
    }

    $conn->commit();

    echo json_encode([
        "status" => "success",
        "message" => "Finished goods produced successfully",
        "new_stock" => $currentProductStock + $qty
    ]);
    exit;
}

if ($productVariantId > 0) {
    if ($qty <= 0 || !in_array($type, ['in', 'out'])) {
        echo json_encode([
            "status" => "error",
            "message" => "Invalid input data"
        ]);
        exit;
    }

    $conn->begin_transaction();
    $variantStmt = $conn->prepare("SELECT product_id, stock_quantity FROM product_variants WHERE id = ? FOR UPDATE");
    $variantStmt->bind_param("i", $productVariantId);
    $variantStmt->execute();
    $variantResult = $variantStmt->get_result();

    if ($variantResult->num_rows === 0) {
        $conn->rollback();
        echo json_encode([
            "status" => "error",
            "message" => "Variant not found"
        ]);
        exit;
    }

    $variant = $variantResult->fetch_assoc();
    $current = intval($variant['stock_quantity']);
    if ($type === 'in') {
        $newStock = $current + $qty;
    } else {
        // INTEGRITY: never clamp silently — reject excessive stock-out.
        if ($current < $qty) {
            $conn->rollback();
            echo json_encode(["status" => "error", "message" => "Insufficient variant stock"]);
            exit;
        }
        $newStock = $current - $qty;
    }

    $updateVariant = $conn->prepare("UPDATE product_variants SET stock_quantity = ? WHERE id = ?");
    $updateVariant->bind_param("ii", $newStock, $productVariantId);

    if (!$updateVariant->execute()) {
        $conn->rollback();
        echo json_encode([
            "status" => "error",
            "message" => "Failed to update variant stock"
        ]);
        exit;
    }

    if (!recordProductMovement($conn, (int) $variant['product_id'], 'Stock Adjustment', $type === 'in' ? $qty : -$qty, $current, $newStock, $reason, 'stock_adjustment', null, inventoryUserId(), $productVariantId)) {
        $conn->rollback();
        echo json_encode(["status" => "error", "message" => "Failed to record variant stock movement"]);
        exit;
    }

    $currentUserId = getSessionUserId();
    $movement = $conn->prepare(
        "INSERT INTO product_variant_movements
         (product_id, product_variant_id, action, qty, note, user_id)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $note = $type === 'in' ? 'Admin stock in' : 'Admin stock out';
    $movement->bind_param('iisisi', $variant['product_id'], $productVariantId, $type, $qty, $note, $currentUserId);
    $movement->execute();
    if ($currentUserId > 0) {
        insertAuditLog($conn, $currentUserId, 'stocks', 'variant_stock_change', 'product_variant', $productVariantId, $note);
    }

    $aggregate = $conn->prepare(
        "UPDATE products
         SET stock = (
             SELECT COALESCE(SUM(stock_quantity), 0)
             FROM product_variants
             WHERE product_id = ?
         )
         WHERE id = ?"
    );
    $aggregate->bind_param('ii', $variant['product_id'], $variant['product_id']);
    $aggregate->execute();
    $conn->commit();

    echo json_encode([
        "status" => "success",
        "message" => "Variant stock updated successfully",
        "variant_stock" => $newStock
    ]);
    exit;
}

if ($id <= 0 || $qty <= 0 || !in_array($type, ['in','out'])) {
    echo json_encode([
        "status" => "error",
        "message" => "Invalid input data"
    ]);
    exit;
}

/* ================= GET CURRENT STOCK ================= */

$conn->begin_transaction();
$stmt = $conn->prepare("SELECT stock FROM products WHERE id = ? FOR UPDATE");
$stmt->bind_param("i", $id);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    $conn->rollback();
    echo json_encode([
        "status" => "error",
        "message" => "Product not found"
    ]);
    exit;
}

$row = $result->fetch_assoc();
$current = intval($row['stock'] ?? 0);

/* ================= CALCULATE ================= */

if ($type === "in") {
    $newStock = $current + $qty;
} else {
    $newStock = $current - $qty;

    if ($newStock < 0) {
        $conn->rollback();
        echo json_encode([
            "status" => "error",
            "message" => "Insufficient product stock"
        ]);
        exit;
    }
}

/* ================= UPDATE ================= */

$update = $conn->prepare("UPDATE products SET stock = ? WHERE id = ?");
$update->bind_param("ii", $newStock, $id);

if ($update->execute()) {
    $currentUserId = getSessionUserId();
    $movementType = $type === 'in' ? 'Stock Adjustment' : 'Stock Adjustment';
    $movementQuantity = $type === 'in' ? $qty : -$qty;
    if (!recordProductMovement($conn, $id, $movementType, $movementQuantity, $current, $newStock, $reason, 'stock_adjustment', null, $currentUserId)) {
        $conn->rollback();
        echo json_encode(["status" => "error", "message" => "Failed to record stock movement"]);
        exit;
    }
    if ($currentUserId > 0) {
        $stockNote = sprintf('Product %s stock %s via api_update_stocks', $type === 'in' ? 'increased' : 'decreased', $type);
        insertAuditLog($conn, $currentUserId, 'stocks', $type === 'in' ? 'stock_in' : 'stock_out', 'product', $id, $stockNote);
    }

    $conn->commit();

    echo json_encode([
        "status" => "success",
        "message" => "Stock updated successfully",
        "new_stock" => $newStock
    ]);

} else {

    $conn->rollback();

    echo json_encode([
        "status" => "error",
        "message" => "Update failed"
    ]);

}

?>