<?php
require_once __DIR__ . '/cors.php';

error_reporting(0);
ini_set('display_errors', 0);

try {
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) {
        throw new Exception("Database Connection Failed: " . mysqli_connect_error());
    }

    $order_id = 0;
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);
        $order_id = intval($data['order_id'] ?? $_GET['order_id'] ?? 0);
    } else {
        $order_id = intval($_GET['order_id'] ?? 0);
    }

    if ($order_id <= 0) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Missing or invalid order_id',
        ]);
        exit;
    }

    $hasCustomer = false;
    $hasEmail = false;
    $columnsRes = mysqli_query($conn, "SHOW COLUMNS FROM orders");
    if ($columnsRes) {
        while ($col = mysqli_fetch_assoc($columnsRes)) {
            if ($col['Field'] === 'customer') {
                $hasCustomer = true;
            }
            if ($col['Field'] === 'email') {
                $hasEmail = true;
            }
        }
    }

    $hasOrderItems = false;
    $tablesRes = mysqli_query($conn, "SHOW TABLES LIKE 'order_items'");
    if ($tablesRes && mysqli_num_rows($tablesRes) > 0) {
        $hasOrderItems = true;
    }

    $hasCustomCakeOrders = false;
    $customTablesRes = mysqli_query($conn, "SHOW TABLES LIKE 'custom_cake_orders'");
    if ($customTablesRes && mysqli_num_rows($customTablesRes) > 0) {
        $hasCustomCakeOrders = true;
    }

    $sql = "SELECT * FROM orders WHERE id = " . intval($order_id) . " LIMIT 1";
    $res = mysqli_query($conn, $sql);
    if (!$res) {
        throw new Exception("SQL Error: " . mysqli_error($conn));
    }

    if (mysqli_num_rows($res) === 0) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Order not found',
        ]);
        exit;
    }

    $row = mysqli_fetch_assoc($res);

    $items = [];
    $itemsFromJson = [];
    if (isset($row['items']) && $row['items'] !== '') {
        $decoded = json_decode($row['items'], true);
        if (is_array($decoded)) {
            $itemsFromJson = $decoded;
        }
    }

    if ($hasOrderItems) {
        $itemsRes = mysqli_query($conn, "SELECT product, qty, price FROM order_items WHERE order_id = " . intval($row['id']));
        if ($itemsRes) {
            $lineItems = [];
            while ($itemRow = mysqli_fetch_assoc($itemsRes)) {
                $lineItems[] = [
                    'name' => $itemRow['product'],
                    'product' => $itemRow['product'],
                    'qty' => intval($itemRow['qty']),
                    'price' => floatval($itemRow['price']),
                ];
            }
            $items = !empty($lineItems) ? $lineItems : $itemsFromJson;
        } else {
            $items = $itemsFromJson;
        }
    } else {
        $items = $itemsFromJson;
    }

    $customDetails = null;
    $isCustomizedOrder = false;
    if ($hasCustomCakeOrders) {
        $customRes = mysqli_query($conn, "SELECT * FROM custom_cake_orders WHERE order_id = " . intval($row['id']) . " LIMIT 1");
        if ($customRes && mysqli_num_rows($customRes) > 0) {
            $customRow = mysqli_fetch_assoc($customRes);
            $decoded = null;
            if (!empty($customRow['notes'])) {
                $decoded = json_decode($customRow['notes'], true);
            }
            if (!is_array($decoded)) {
                $decoded = [
                    'delivery_method' => $row['method'] ?? '',
                    'delivery_address' => $row['address'] ?? '',
                    'pickup_date' => $row['delivery_date'] ?? '',
                    'pickup_time' => $row['delivery_time'] ?? '',
                    'cake_size' => $customRow['cake_size'] ?? $customRow['tiers'] ?? '',
                    'quantity' => intval($customRow['quantity'] ?? 1),
                    'cake_flavor' => $customRow['flavor'] ?? '',
                    'filling_flavor' => $customRow['filling'] ?? '',
                    'frosting_type' => $customRow['frosting'] ?? '',
                    'occasion' => $customRow['occasion'] ?? '',
                    'theme' => $customRow['theme_design'] ?? '',
                    'cake_color' => $customRow['preferred_colors'] ?? '',
                    'custom_message' => $customRow['dedication'] ?? '',
                    'special_instructions' => '',
                    'details' => '',
                    'estimated_price' => $customRow['estimated_price'] ?? '',
                    'inspo_images' => $customRow['inspo_images'] ?? '[]',
                ];
            }
            $customDetails = $decoded;
            $isCustomizedOrder = true;
        }
    }

    $order = [
        'id' => intval($row['id']),
        'user_id' => intval($row['user_id'] ?? 0),
        'customer' => $hasCustomer ? ($row['customer'] ?? '') : '',
        'email' => $hasEmail ? ($row['email'] ?? '') : '',
        'items' => $items,
        'total' => floatval($row['total'] ?? 0),
        'payment' => $row['payment'] ?? '',
        'method' => $row['method'] ?? '',
        'address' => $row['address'] ?? '',
        'notes' => $row['notes'] ?? '',
        'type' => $row['type'] ?? '',
        'is_customized' => $isCustomizedOrder ? 1 : (isset($row['is_customized']) ? intval($row['is_customized']) : (strtolower($row['type'] ?? '') === 'custom' ? 1 : 0)),
        'custom_details' => $customDetails,
        'status' => $row['status'] ?? 'Pending',
        'created_at' => $row['created_at'] ?? '',
        'order_date' => $row['order_date'] ?? '',
    ];

    echo json_encode([
        'status' => 'success',
        'order' => $order,
    ]);
} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage(),
    ]);
}
?>