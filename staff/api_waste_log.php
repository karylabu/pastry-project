<?php
require_once __DIR__ . '/../includes/api_auth.php';
require_once __DIR__ . '/../includes/inventory.php';

requireInventoryWrite();
/**
 * api_waste_log.php
 *
 * GET  /api_waste_log.php               -> { success: true, entries: [...] }
 * GET  /api_waste_log.php?action=items  -> { success: true, items: [...] }
 *      (combined ingredients + products list, for populating the "Item" dropdown
 *      with real names/units/costs instead of a hardcoded frontend catalogue)
 * POST /api_waste_log.php               -> body { item, qty, reason, datetime? }
 *      looks up unit_cost + type from ingredients/products by item name,
 *      snapshots them onto the new waste_log row, and returns the saved entry.
 *
 * Adjust the DB CONNECTION block below to match your real credentials /
 * shared config include (e.g. require_once __DIR__ . '/db_config.php').
 */

/* ---------------------- DB CONNECTION ---------------------- */
$conn = new mysqli("localhost", "root", "", "pastry_db");

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "DB connection failed: " . $conn->connect_error]);
    exit;
}

/* ---------------------- ROUTES ---------------------- */

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;

if ($method === 'GET' && $action === 'items') {
    getItemCatalogue($conn);
} elseif ($method === 'GET') {
    getEntries($conn);
} elseif ($method === 'POST') {
    createEntry($conn);
} else {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
}

$conn->close();

/* ---------------------- HANDLERS ---------------------- */

function getEntries($conn) {
    $entries = [];

    $sql = "SELECT id, datetime, item, qty, unit_cost, item_type, reason
            FROM waste_log
            ORDER BY datetime DESC";
    $result = $conn->query($sql);

    if ($result === false) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Query failed: " . $conn->error]);
        return;
    }

    while ($row = $result->fetch_assoc()) {
        $qty = (float) $row["qty"];
        $unitCost = (float) $row["unit_cost"];
        $entries[] = [
            "id"        => (int) $row["id"],
            "datetime"  => $row["datetime"],
            "item"      => $row["item"],
            "qty"       => $qty,
            "unit_cost" => $unitCost,
            "cost"      => round($qty * $unitCost, 2),
            "type"      => $row["item_type"],
            "reason"    => $row["reason"],
        ];
    }

    echo json_encode(["success" => true, "entries" => $entries]);
}

function getItemCatalogue($conn) {
    $items = [];

    $ingredients = $conn->query("SELECT id, name, unit, unit_cost FROM ingredients ORDER BY name");
    if (!$ingredients) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Failed to load ingredient catalogue"]);
        return;
    }
    while ($row = $ingredients->fetch_assoc()) {
        $items[] = [
            "id"        => (int) $row["id"],
            "name"      => $row["name"],
            "unit"      => $row["unit"],
            "unit_cost" => (float) $row["unit_cost"],
            "type"      => "Raw Material",
        ];
    }

    $products = $conn->query("SELECT id, name, production_cost FROM products ORDER BY name");
    if (!$products) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Failed to load product catalogue"]);
        return;
    }
    while ($row = $products->fetch_assoc()) {
        $items[] = [
            "id"        => (int) $row["id"],
            "name"      => $row["name"],
            "unit"      => "pcs",
            "unit_cost" => (float) $row["production_cost"],
            "type"      => "Finished Product",
        ];
    }

    echo json_encode(["success" => true, "items" => $items]);
}

function createEntry($conn) {
    $body = json_decode(file_get_contents("php://input"), true);

    if (!$body || !isset($body["qty"]) || empty($body["reason"])) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Missing required fields: item, qty, reason"]);
        return;
    }

    $ingredientId = (int) ($body['ingredient_id'] ?? 0);
    $productId = (int) ($body['product_id'] ?? 0);
    $itemTypeInput = strtolower(trim((string) ($body['item_type'] ?? $body['type'] ?? '')));
    $item = trim((string) ($body["item"] ?? ''));
    $qty    = (float) $body["qty"];
    $reason = $body["reason"];
    $idempotencyKey = trim((string) ($body['idempotency_key'] ?? ''));
    $datetime = !empty($body["datetime"])
        ? str_replace("T", " ", $body["datetime"]) . (strlen($body["datetime"]) === 16 ? ":00" : "")
        : date("Y-m-d H:i:s");

    if ($qty <= 0 || ($ingredientId <= 0 && $productId <= 0 && $item === '')) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "A valid ingredient_id or product_id and positive qty are required"]);
        return;
    }

    if (strlen($idempotencyKey) > 100) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "idempotency_key is too long"]);
        return;
    }

    if ($idempotencyKey !== '') {
        $existingStmt = $conn->prepare("SELECT id, datetime, item, qty, unit_cost, item_type, reason FROM waste_log WHERE idempotency_key = ? LIMIT 1");
        $existingStmt->bind_param('s', $idempotencyKey);
        $existingStmt->execute();
        $existing = $existingStmt->get_result()->fetch_assoc();
        $existingStmt->close();
        if ($existing) {
            echo json_encode(["success" => true, "duplicate" => true, "entry" => [
                "id" => (int) $existing['id'], "datetime" => $existing['datetime'], "item" => $existing['item'],
                "qty" => (float) $existing['qty'], "unit_cost" => (float) $existing['unit_cost'],
                "cost" => round((float) $existing['qty'] * (float) $existing['unit_cost'], 2),
                "type" => $existing['item_type'], "reason" => $existing['reason'],
            ]]);
            return;
        }
    }

    $conn->begin_transaction();
    $unitCost = 0.0;
    $itemType = "Raw Material";

    if ($productId > 0 || ($itemTypeInput === 'finished product' && $item !== '')) {
        if ($productId <= 0) {
            $stmt = $conn->prepare("SELECT id, name, production_cost, stock FROM products WHERE name = ? LIMIT 1 FOR UPDATE");
            $stmt->bind_param("s", $item);
        } else {
            $stmt = $conn->prepare("SELECT name, production_cost, stock FROM products WHERE id = ? FOR UPDATE");
            $stmt->bind_param("i", $productId);
        }
        $itemType = "Finished Product";
    } else {
        $stmt = $conn->prepare("SELECT id, name, unit_cost, stock FROM ingredients WHERE id = ? FOR UPDATE");
        if ($ingredientId <= 0) {
            $stmt = $conn->prepare("SELECT id, name, unit_cost, stock FROM ingredients WHERE name = ? LIMIT 1 FOR UPDATE");
            $stmt->bind_param("s", $item);
        } else {
            $stmt->bind_param("i", $ingredientId);
        }
    }
    $stmt->execute();
    $res = $stmt->get_result();
    if ($row = $res->fetch_assoc()) {
        $item = $row['name'];
        if ($productId > 0) {
            $unitCost = (float) $row['production_cost'];
        } elseif ($itemType === 'Finished Product') {
            $productId = (int) $row['id'];
            $unitCost = (float) $row['production_cost'];
        } else {
            $ingredientId = (int) $row['id'];
            $unitCost = (float) $row['unit_cost'];
        }
    } else {
        $stmt->close();
        $conn->rollback();
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Inventory item not found"]);
        return;
    }
    $stmt->close();

    $previous = (float) $row['stock'];
    if ($qty > $previous) {
        $conn->rollback();
        http_response_code(409);
        echo json_encode(["success" => false, "message" => "Insufficient stock for waste entry"]);
        return;
    }

    $newStock = $previous - $qty;
    if ($productId > 0) {
        $update = $conn->prepare("UPDATE products SET stock = ? WHERE id = ?");
        $update->bind_param('di', $newStock, $productId);
    } else {
        $update = $conn->prepare("UPDATE ingredients SET stock = ?, updated_at = NOW() WHERE id = ?");
        $update->bind_param('di', $newStock, $ingredientId);
    }
    if (!$update->execute()) {
        $update->close();
        $conn->rollback();
        echo json_encode(["success" => false, "message" => "Failed to update stock"]);
        return;
    }
    $update->close();

    $insert = $conn->prepare(
        "INSERT INTO waste_log (datetime, item, qty, unit_cost, item_type, reason, ingredient_id, product_id, user_id, reference_type, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'waste', NULLIF(?, ''))"
    );
    $userId = inventoryUserId();
    $insert->bind_param("ssddssiiis", $datetime, $item, $qty, $unitCost, $itemType, $reason, $ingredientId, $productId, $userId, $idempotencyKey);

    if (!$insert->execute()) {
        http_response_code(500);
        $conn->rollback();
        echo json_encode(["success" => false, "message" => "Insert failed: " . $insert->error]);
        $insert->close();
        return;
    }

    $newId = $insert->insert_id;
    $insert->close();

    if ($productId > 0) {
        $movementOk = recordProductMovement($conn, $productId, 'Waste', -$qty, $previous, $newStock, $reason, 'waste', $newId, $userId);
    } else {
        $movementOk = insertIngredientMovement($conn, $ingredientId, 'stock_out', $qty, "Waste: {$reason}", $userId, 'waste', $newId);
    }
    if (!$movementOk) {
        $conn->rollback();
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Failed to record waste movement"]);
        return;
    }
    $conn->commit();

    echo json_encode([
        "success" => true,
        "entry" => [
            "id"        => $newId,
            "datetime"  => $datetime,
            "item"      => $item,
            "qty"       => $qty,
            "unit_cost" => $unitCost,
            "cost"      => round($qty * $unitCost, 2),
            "type"      => $itemType,
            "reason"    => $reason,
        ],
    ]);
}