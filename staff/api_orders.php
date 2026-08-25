<?php
require_once __DIR__ . '/../includes/api_auth.php';

requireInventoryRead();

/* ================= DATABASE CONNECTION ================= */

function ensureOrdersSchemaCompat(mysqli $conn): void {
    if (!$conn) {
        return;
    }

    @mysqli_query($conn, "ALTER TABLE orders MODIFY COLUMN status ENUM('Pending','Confirmed','Preparing','To Receive','Completed','Cancelled') NOT NULL DEFAULT 'Pending'");

    $phoneCheck = $conn->query("SHOW COLUMNS FROM orders LIKE 'phone'");
    if (!$phoneCheck || $phoneCheck->num_rows === 0) {
        @mysqli_query($conn, "ALTER TABLE orders ADD COLUMN phone VARCHAR(30) NULL AFTER email");
    }
}

$conn = new mysqli("localhost", "root", "", "pastry_db");

if ($conn->connect_error) {
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed"
    ]);
    exit;
}

ensureOrdersSchemaCompat($conn);

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
            "message" => $conn->error
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

/* ================= UPDATE STATUS / TOTAL ================= */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $data = json_decode(file_get_contents("php://input"), true);

    $id = intval($data['id'] ?? 0);
    $status = $conn->real_escape_string($data['status'] ?? '');
    $total = isset($data['total']) ? floatval($data['total']) : null;

    if (!$id) {
        echo json_encode([
            "status" => "error",
            "message" => "Missing data"
        ]);
        exit;
    }

    $updates = [];
    if ($status !== '') {
        $updates[] = "status='$status'";
    }
    if ($total !== null) {
        $updates[] = "total=" . number_format($total, 2, '.', '');
    }

    if (empty($updates)) {
        echo json_encode([
            "status" => "error",
            "message" => "Nothing to update"
        ]);
        exit;
    }

    $sql = "UPDATE orders SET " . implode(', ', $updates) . " WHERE id=$id";

    if ($conn->query($sql)) {
        echo json_encode([
            "status" => "success"
        ]);
    } else {
        echo json_encode([
            "status" => "error",
            "message" => $conn->error
        ]);
    }

    exit;
}

?>