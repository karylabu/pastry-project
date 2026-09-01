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
        echo json_encode(["success" => false, "message" => "Failed to load waste entries"]);
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

function synchronizeIngredientStock(mysqli $conn, int $ingredientId): float {
    $stmt = $conn->prepare('SELECT COALESCE(SUM(quantity_remaining), 0) AS total FROM ingredient_batches WHERE ingredient_id = ?');
    $stmt->bind_param('i', $ingredientId); $stmt->execute();
    $total = (float) ($stmt->get_result()->fetch_assoc()['total'] ?? 0); $stmt->close();
    $update = $conn->prepare('UPDATE ingredients SET stock = ?, updated_at = NOW() WHERE id = ?');
    $update->bind_param('di', $total, $ingredientId);
    if (!$update->execute()) { $update->close(); throw new RuntimeException('Failed to synchronize ingredient stock'); }
    $update->close(); return $total;
}

function createIngredientWasteEntry(mysqli $conn, array $body, int $ingredientId, string $item, float $qty, string $reason, string $datetime, string $idempotencyKey): void {
    $conn->begin_transaction();
    try {
        $ingredientStmt = $conn->prepare('SELECT id, name, unit_cost FROM ingredients WHERE ' . ($ingredientId > 0 ? 'id = ?' : 'name = ?') . ' LIMIT 1 FOR UPDATE');
        if ($ingredientId > 0) $ingredientStmt->bind_param('i', $ingredientId); else $ingredientStmt->bind_param('s', $item);
        $ingredientStmt->execute(); $ingredient = $ingredientStmt->get_result()->fetch_assoc(); $ingredientStmt->close();
        if (!$ingredient) throw new RuntimeException('Inventory item not found');
        $ingredientId = (int) $ingredient['id']; $item = $ingredient['name']; $unitCost = (float) $ingredient['unit_cost'];

        $requestedBatchId = max(0, (int) ($body['ingredient_batch_id'] ?? $body['batch_id'] ?? 0));
        if ($requestedBatchId > 0) {
            $batchStmt = $conn->prepare('SELECT id, batch_number, quantity_remaining FROM ingredient_batches WHERE id = ? AND ingredient_id = ? AND quantity_remaining > 0 FOR UPDATE');
            $batchStmt->bind_param('ii', $requestedBatchId, $ingredientId);
        } else {
            $batchStmt = $conn->prepare("SELECT id, batch_number, quantity_remaining FROM ingredient_batches WHERE ingredient_id = ? AND quantity_remaining > 0 AND (expiry_date IS NULL OR expiry_date >= CURDATE()) AND NOT EXISTS (SELECT 1 FROM discard_requests d WHERE d.ingredient_batch_id = ingredient_batches.id AND d.status = 'Pending') ORDER BY expiry_date IS NULL, expiry_date ASC, id ASC FOR UPDATE");
            $batchStmt->bind_param('i', $ingredientId);
        }
        $batchStmt->execute(); $result = $batchStmt->get_result(); $batches = [];
        while ($batch = $result->fetch_assoc()) $batches[] = ['id' => (int) $batch['id'], 'batch_number' => $batch['batch_number'], 'quantity_remaining' => (float) $batch['quantity_remaining']];
        $batchStmt->close();
        $remaining = $qty; $allocations = [];
        foreach ($batches as $batch) {
            if ($remaining <= 0.000001) break;
            $consumed = min($remaining, $batch['quantity_remaining']);
            $allocations[] = ['id' => $batch['id'], 'batch_number' => $batch['batch_number'], 'quantity' => $consumed];
            $remaining -= $consumed;
            if ($requestedBatchId > 0) break;
        }
        if ($remaining > 0.000001) throw new RuntimeException('Insufficient batch stock for waste entry');

        $insert = $conn->prepare("INSERT INTO waste_log (datetime, item, qty, unit_cost, item_type, reason, ingredient_id, user_id, reference_type, idempotency_key) VALUES (?, ?, ?, ?, 'Raw Material', ?, ?, ?, 'waste', NULLIF(?, ''))");
        $userId = inventoryUserId(); $insert->bind_param('ssddsiis', $datetime, $item, $qty, $unitCost, $reason, $ingredientId, $userId, $idempotencyKey);
        if (!$insert->execute()) throw new RuntimeException('Failed to save waste entry');
        $newId = $insert->insert_id; $insert->close();

        $beforeStmt = $conn->prepare('SELECT COALESCE(SUM(quantity_remaining), 0) AS total FROM ingredient_batches WHERE ingredient_id = ?');
        $beforeStmt->bind_param('i', $ingredientId); $beforeStmt->execute(); $before = (float) ($beforeStmt->get_result()->fetch_assoc()['total'] ?? 0); $beforeStmt->close();
        foreach ($allocations as $allocation) {
            $update = $conn->prepare('UPDATE ingredient_batches SET quantity_remaining = quantity_remaining - ?, updated_at = NOW() WHERE id = ? AND quantity_remaining >= ?');
            $update->bind_param('did', $allocation['quantity'], $allocation['id'], $allocation['quantity']);
            if (!$update->execute() || $update->affected_rows !== 1) { $update->close(); throw new RuntimeException('Failed to deduct waste batch'); }
            $update->close();
            $afterStmt = $conn->prepare('SELECT COALESCE(SUM(quantity_remaining), 0) AS total FROM ingredient_batches WHERE ingredient_id = ?');
            $afterStmt->bind_param('i', $ingredientId); $afterStmt->execute(); $after = (float) ($afterStmt->get_result()->fetch_assoc()['total'] ?? 0); $afterStmt->close();
            $movement = $conn->prepare("INSERT INTO ingredient_movements (ingredient_id, batch_id, action, qty, note, user_id, reference_type, reference_id, previous_stock, new_stock) VALUES (?, ?, 'stock_out', ?, ?, ?, 'waste', ?, ?, ?)");
            $note = "Waste: {$reason} batch {$allocation['batch_number']}"; $movement->bind_param('iidsiidd', $ingredientId, $allocation['id'], $allocation['quantity'], $note, $userId, $newId, $before, $after);
            if (!$movement->execute()) { $movement->close(); throw new RuntimeException('Failed to record waste movement'); }
            $movement->close(); $before = $after;
        }
        $newStock = synchronizeIngredientStock($conn, $ingredientId);
        $conn->commit();
        echo json_encode(['success' => true, 'entry' => ['id' => $newId, 'datetime' => $datetime, 'item' => $item, 'qty' => $qty, 'unit_cost' => $unitCost, 'cost' => round($qty * $unitCost, 2), 'type' => 'Raw Material', 'reason' => $reason], 'new_stock' => $newStock]);
    } catch (Throwable $error) {
        $conn->rollback(); http_response_code(409); echo json_encode(['success' => false, 'message' => $error->getMessage()]);
    }
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
    $reason = trim((string) $body["reason"]);
    if ($reason === '') {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "A non-empty reason is required"]);
        return;
    }
    if (mb_strlen($reason) > 50) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Reason must be 50 characters or fewer"]);
        return;
    }
    $idempotencyKey = trim((string) ($body['idempotency_key'] ?? ''));
    $datetime = !empty($body["datetime"])
        ? str_replace("T", " ", $body["datetime"]) . (strlen($body["datetime"]) === 16 ? ":00" : "")
        : date("Y-m-d H:i:s");

    // INPUT VALIDATION: reject malformed datetimes instead of storing garbage.
    $dtCheck = DateTime::createFromFormat("Y-m-d H:i:s", $datetime);
    if (!$dtCheck || $dtCheck->format("Y-m-d H:i:s") !== $datetime) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "datetime must use YYYY-MM-DD HH:MM:SS format"]);
        return;
    }

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

    if ($productId <= 0 && $itemTypeInput !== 'finished product') {
        createIngredientWasteEntry($conn, $body, $ingredientId, $item, $qty, $reason, $datetime, $idempotencyKey);
        return;
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
        $conn->rollback();
        http_response_code(409);
        echo json_encode(["success" => false, "message" => "Ingredient waste must identify a batch"]);
        return;
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
    $update = $conn->prepare("UPDATE products SET stock = ? WHERE id = ?");
    $update->bind_param('di', $newStock, $productId);
    if (!$update->execute()) {
        $update->close();
        $conn->rollback();
        echo json_encode(["success" => false, "message" => "Failed to update stock"]);
        return;
    }
    $update->close();

    // FK columns are nullable — a finished-product waste entry must store
    // NULL for ingredient_id (and vice versa), never 0, or the FK fails.
    $ingredientId = $ingredientId > 0 ? $ingredientId : null;
    $productId = $productId > 0 ? $productId : null;

    $insert = $conn->prepare(
        "INSERT INTO waste_log (datetime, item, qty, unit_cost, item_type, reason, ingredient_id, product_id, user_id, reference_type, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'waste', NULLIF(?, ''))"
    );
    $userId = inventoryUserId();
    $insert->bind_param("ssddssiiis", $datetime, $item, $qty, $unitCost, $itemType, $reason, $ingredientId, $productId, $userId, $idempotencyKey);

    if (!$insert->execute()) {
        http_response_code(500);
        $conn->rollback();
        echo json_encode(["success" => false, "message" => "Failed to save waste entry"]);
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