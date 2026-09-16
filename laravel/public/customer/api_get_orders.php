<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../../../includes/api_auth.php';

error_reporting(0);
ini_set('display_errors', 0);

try {
    // Connect to database
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) {
        throw new Exception("Database Connection Failed: " . mysqli_connect_error());
    }

    // Detect available columns in orders table
    $hasCustomer = false;
    $hasEmail = false;
    $hasItems = false;
    $hasUserId = false;

    $columnsRes = mysqli_query($conn, "SHOW COLUMNS FROM orders");
    if ($columnsRes) {
        while ($col = mysqli_fetch_assoc($columnsRes)) {
            if ($col['Field'] === 'customer') $hasCustomer = true;
            if ($col['Field'] === 'email') $hasEmail = true;
            if ($col['Field'] === 'items') $hasItems = true;
            if ($col['Field'] === 'user_id') $hasUserId = true;
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

    $authUser = requireApiRole(['customer']);
    $authenticatedUserId = (int) $authUser['id'];
    $authenticatedEmail = trim((string) ($authUser['email'] ?? ''));
    $ownership = [];
    if ($hasUserId) $ownership[] = 'user_id = ' . $authenticatedUserId;
    if ($hasEmail && $authenticatedEmail !== '') {
        $escapedEmail = mysqli_real_escape_string($conn, $authenticatedEmail);
        $ownership[] = "(user_id IS NULL AND email = '$escapedEmail')";
    }
    if (!$ownership) {
        echo json_encode([]);
        exit;
    }

    $sql = "SELECT * FROM orders WHERE (" . implode(' OR ', $ownership) . ") ORDER BY created_at DESC";

    $res = mysqli_query($conn, $sql);

    if (!$res) {
        throw new Exception("SQL Error: " . mysqli_error($conn));
    }

    $orders = [];
    while ($row = mysqli_fetch_assoc($res)) {
        $items = [];
        $itemsFromJson = [];

        if ($hasItems && isset($row['items']) && $row['items'] !== '') {
            $decoded = json_decode($row['items'], true);
            if (is_array($decoded)) {
                $itemsFromJson = $decoded;
            }
        }

        if ($hasOrderItems) {
            $itemsRes = mysqli_query($conn, "SELECT product, qty, price FROM order_items WHERE order_id = " . intval($row['id']));
            if ($itemsRes && mysqli_num_rows($itemsRes) > 0) {
                $lineItems = [];
                while ($itemRow = mysqli_fetch_assoc($itemsRes)) {
                    $lineItems[] = [
                        "name" => $itemRow['product'],
                        "product" => $itemRow['product'],
                        "qty" => intval($itemRow['qty']),
                        "price" => floatval($itemRow['price']),
                    ];
                }
                $items = $lineItems;
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
                $isCustomizedOrder = true;
                $decoded = null;
                if (!empty($customRow['notes'])) {
                    $decoded = json_decode($customRow['notes'], true);
                }
                $customDetails = is_array($decoded) ? $decoded : $customRow;
            }
        }

        $orders[] = [
            "id" => intval($row['id']),
            "user_id" => $hasUserId ? intval($row['user_id'] ?? 0) : 0,
            "customer" => $hasCustomer ? ($row['customer'] ?? '') : '',
            "email" => $hasEmail ? ($row['email'] ?? '') : '',
            "items" => $items,
            "total" => floatval($row['total'] ?? 0),
            "payment" => $row['payment'] ?? '',
            "method" => $row['method'] ?? '',
            "address" => $row['address'] ?? '',
            "status" => $row['status'] ?? 'Pending',
            "created_at" => $row['created_at'] ?? '',
            "is_customized" => $isCustomizedOrder ? 1 : 0,
            "custom_details" => $customDetails
        ];
    }

    echo json_encode($orders);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}
?>
