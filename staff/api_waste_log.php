<?php
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

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *"); // tighten this in production
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

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

    $ingredients = $conn->query("SELECT name, unit, unit_cost FROM ingredients ORDER BY name");
    while ($row = $ingredients->fetch_assoc()) {
        $items[] = [
            "name"      => $row["name"],
            "unit"      => $row["unit"],
            "unit_cost" => (float) $row["unit_cost"],
            "type"      => "Raw Material",
        ];
    }

    $products = $conn->query("SELECT name, production_cost FROM products ORDER BY name");
    while ($row = $products->fetch_assoc()) {
        $items[] = [
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

    if (!$body || empty($body["item"]) || !isset($body["qty"]) || empty($body["reason"])) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Missing required fields: item, qty, reason"]);
        return;
    }

    $item   = $body["item"];
    $qty    = (float) $body["qty"];
    $reason = $body["reason"];
    $datetime = !empty($body["datetime"])
        ? str_replace("T", " ", $body["datetime"]) . (strlen($body["datetime"]) === 16 ? ":00" : "")
        : date("Y-m-d H:i:s");

    // Look up the real cost + type by item name: ingredients first, then products
    $unitCost = 0.0;
    $itemType = "Raw Material";

    $stmt = $conn->prepare("SELECT unit_cost FROM ingredients WHERE name = ? LIMIT 1");
    $stmt->bind_param("s", $item);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($row = $res->fetch_assoc()) {
        $unitCost = (float) $row["unit_cost"];
        $itemType = "Raw Material";
    } else {
        $stmt->close();
        $stmt = $conn->prepare("SELECT production_cost FROM products WHERE name = ? LIMIT 1");
        $stmt->bind_param("s", $item);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($row = $res->fetch_assoc()) {
            $unitCost = (float) $row["production_cost"];
            $itemType = "Finished Product";
        }
    }
    $stmt->close();

    $insert = $conn->prepare(
        "INSERT INTO waste_log (datetime, item, qty, unit_cost, item_type, reason) VALUES (?, ?, ?, ?, ?, ?)"
    );
    $insert->bind_param("ssddss", $datetime, $item, $qty, $unitCost, $itemType, $reason);

    if (!$insert->execute()) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Insert failed: " . $insert->error]);
        $insert->close();
        return;
    }

    $newId = $insert->insert_id;
    $insert->close();

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