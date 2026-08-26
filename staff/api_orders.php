<?php
require_once __DIR__ . '/../includes/api_auth.php';

requireInventoryRead();

/* ================= DATABASE CONNECTION ================= */
/*
| SCHEMA NOTE: The orders table schema is maintained exclusively through
| versioned migrations in database/migrations/. This API must never run
| ALTER TABLE / CREATE TABLE statements at request time.
*/

$conn = new mysqli("localhost", "root", "", "pastry_db");

if ($conn->connect_error) {
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed"
    ]);
    exit;
}

/* ================= GET ORDERS ================= */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    $customOnly = isset($_GET['custom']) && (strval($_GET['custom']) === '1' || strtolower(strval($_GET['custom'])) === 'true');
    $sql = $customOnly
        ? "SELECT o.* FROM orders o WHERE EXISTS (SELECT 1 FROM custom_cake_orders c WHERE c.order_id = o.id) ORDER BY o.id DESC"
        : "SELECT * FROM orders ORDER BY id DESC";

    $result = $conn->query($sql);

    if (!$result) {
        echo json_encode([
            "status" => "error",
            "message" => "Failed to load orders"
        ]);
        exit;
    }

    $ordersById = [];

    while ($row = $result->fetch_assoc()) {
        $row['items'] = [];
        $ordersById[(int) $row['id']] = $row;
    }

    if (!empty($ordersById)) {
        $ids = array_keys($ordersById);
        $idList = implode(',', array_map('intval', $ids));
        $itemsSql = "SELECT order_id, product, qty, price FROM order_items WHERE order_id IN ($idList)";
        $itemsResult = $conn->query($itemsSql);

        if ($itemsResult) {
            while ($itemRow = $itemsResult->fetch_assoc()) {
                $orderId = (int) ($itemRow['order_id'] ?? 0);
                if (!isset($ordersById[$orderId])) {
                    continue;
                }

                $ordersById[$orderId]['items'][] = [
                    'name' => $itemRow['product'] ?? 'Item',
                    'qty' => (int) ($itemRow['qty'] ?? 1),
                    'price' => (float) ($itemRow['price'] ?? 0),
                ];
            }
        }
    }

    $orders = array_values($ordersById);
    usort($orders, function ($a, $b) {
        return ((int) ($b['id'] ?? 0)) <=> ((int) ($a['id'] ?? 0));
    });

    echo json_encode($orders);
    exit;
}

/* ================= UPDATE TOTAL ================= */
/*
| SECURITY: This endpoint previously interpolated client-supplied values
| directly into SQL (injection risk) and allowed arbitrary status writes
| that BYPASSED inventory deduction/cancellation logic. Status changes must
| go through api_update_order_status.php, which handles stock atomically.
| Only a numeric order-total correction is permitted here, via prepared
| statements.
*/

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $data = json_decode(file_get_contents("php://input"), true);
    if (!is_array($data)) {
        $data = $_POST;
    }

    // Status changes are NOT allowed here — they would bypass stock logic.
    if (!empty($data['status'])) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Status changes must use api_update_order_status.php"
        ]);
        exit;
    }

    $id = intval($data['id'] ?? 0);
    $hasTotal = array_key_exists('total', $data) && is_numeric($data['total']);
    $total = $hasTotal ? floatval($data['total']) : null;

    if (!$id || !$hasTotal || $total < 0) {
        echo json_encode([
            "status" => "error",
            "message" => "Missing or invalid data"
        ]);
        exit;
    }

    $stmt = $conn->prepare("UPDATE orders SET total = ? WHERE id = ?");
    $stmt->bind_param("di", $total, $id);
    if ($stmt->execute()) {
        echo json_encode([
            "status" => "success"
        ]);
    } else {
        echo json_encode([
            "status" => "error",
            "message" => "Update failed"
        ]);
    }
    $stmt->close();

    exit;
}

?>