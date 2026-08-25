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
$qty    = intval($data['qty'] ?? 0);
$type   = $data['type'] ?? $action;
$reason = trim((string) ($data['reason'] ?? $data['note'] ?? 'Manual stock adjustment'));
$productVariantId = intval($data['product_variant_id'] ?? 0);

if ($action === "produce") {
    if ($id <= 0 || $qty <= 0) {
        echo json_encode([
            "status" => "error",
            "message" => "Invalid input data"
        ]);
        exit;
    }

    $conn->begin_transaction();
    $stmt = $conn->prepare("SELECT stock, name FROM products WHERE id = ? FOR UPDATE");
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
    $currentProductStock = intval($row['stock'] ?? 0);
    $productName = $row['name'];

    $recipeStmt = $conn->prepare(
        "SELECT pr.ingredient_id, pr.qty, i.name, i.unit, i.stock
         FROM product_recipes pr
         JOIN ingredients i ON i.id = pr.ingredient_id
         WHERE pr.product_id = ? AND pr.active = 1
         FOR UPDATE"
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
            'unit' => $line['unit'],
            'stock' => floatval($line['stock'])
        ];
    }

    if (count($recipeLines) === 0) {
        $conn->rollback();
        echo json_encode([
            "status" => "error",
            "message" => "No recipe defined for this product"
        ]);
        exit;
    }

    $shortage = null;
    foreach ($recipeLines as $line) {
        $required = $line['qty'] * $qty;
        if (floatval($line['stock']) < $required) {
            $shortage = $line;
            break;
        }
    }

    if ($shortage) {
        $conn->rollback();
        echo json_encode([
            "status" => "error",
            "message" => "Insufficient {$shortage['name']} for this production quantity"
        ]);
        exit;
    }

    $currentUserId = inventoryUserId();
    $ingredientUpdate = $conn->prepare("UPDATE ingredients SET stock = stock - ?, updated_at = NOW() WHERE id = ?");
    $movementNote = "Produced {$qty} unit(s) of {$productName}";

    $productionStmt = $conn->prepare("INSERT INTO production_transactions (product_id, quantity, user_id) VALUES (?, ?, ?)");
    $productionStmt->bind_param('iii', $id, $qty, $currentUserId);
    if (!$productionStmt->execute()) {
        $conn->rollback();
        echo json_encode(["status" => "error", "message" => "Failed to record production"]);
        exit;
    }
    $productionId = $productionStmt->insert_id;
    $productionStmt->close();

    foreach ($recipeLines as $line) {
        $required = $line['qty'] * $qty;
        $ingredientUpdate->bind_param('di', $required, $line['ingredient_id']);
        if (!$ingredientUpdate->execute()) {
            $conn->rollback();
            echo json_encode([
                "status" => "error",
                "message" => "Failed to deduct ingredients"
            ]);
            exit;
        }

        if (!insertIngredientMovement($conn, $line['ingredient_id'], 'stock_out', $required, $movementNote, $currentUserId, 'production', $productionId)) {
            $conn->rollback();
            echo json_encode([
                "status" => "error",
                "message" => "Failed to log ingredient movement"
            ]);
            exit;
        }
    }

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
    $newStock = $type === 'in' ? $current + $qty : max(0, $current - $qty);

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