<?php

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../includes/db.php';

// Debug: log incoming request headers, cookies, and session info to help diagnose 419 errors
$debugLog = __DIR__ . '/debug_api_orders.log';
$logEntry = date('c') . " | REQUEST_METHOD=" . ($_SERVER['REQUEST_METHOD'] ?? '') . " | ORIGIN=" . ($origin ?? '') . "\n";
$allHeaders = [];
foreach (getallheaders() as $k => $v) {
    $allHeaders[$k] = $v;
}
$logEntry .= "Headers: " . json_encode($allHeaders) . "\n";
$logEntry .= "Cookies: " . json_encode($_COOKIE) . "\n";
$logEntry .= "SessionID: " . session_id() . "\n";
file_put_contents($debugLog, $logEntry, FILE_APPEND);

try {
    if (!$conn) {
        throw new Exception("Database Connection Failed: " . mysqli_connect_error());
    }

    // Read input
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);
    if (!$data) {
        throw new Exception("No data received");
    }

    // Sanitize and extract
    $itemsData = is_array($data['items'] ?? null) ? $data['items'] : [];
    $items     = mysqli_real_escape_string($conn, json_encode($itemsData));
    $subtotal  = floatval($data['subtotal'] ?? 0);
    $delivery  = floatval($data['delivery_fee'] ?? 0);
    $total     = floatval($data['total'] ?? 0);
    $method    = mysqli_real_escape_string($conn, $data['method'] ?? '');
    $payment   = mysqli_real_escape_string($conn, $data['payment'] ?? '');
    $address   = mysqli_real_escape_string($conn, $data['address'] ?? '');
    $phone     = mysqli_real_escape_string($conn, $data['phone'] ?? '');
    $latitude  = floatval($data['latitude'] ?? 0);
    $longitude = floatval($data['longitude'] ?? 0);
    $customer  = mysqli_real_escape_string($conn, $data['customer'] ?? '');
    $email     = mysqli_real_escape_string($conn, $data['email'] ?? '');
    $user_id   = intval($data['user_id'] ?? 0); // Capture user_id from frontend

    $hasCustomer = false;
    $hasEmail = false;
    $hasUserId = false;
    $columnsRes = mysqli_query($conn, "SHOW COLUMNS FROM orders");
    if ($columnsRes) {
        while ($col = mysqli_fetch_assoc($columnsRes)) {
            if ($col['Field'] === 'customer') {
                $hasCustomer = true;
            }
            if ($col['Field'] === 'email') {
                $hasEmail = true;
            }
            if ($col['Field'] === 'user_id') {
                $hasUserId = true;
            }
        }
    }

    // Add missing customer/email/user_id fields if the table is still using the older schema.
    $alterStatements = [];
    if (!$hasCustomer) {
        $alterStatements[] = "ADD COLUMN customer VARCHAR(150) NOT NULL DEFAULT ''";
    }
    if (!$hasEmail) {
        $alterStatements[] = "ADD COLUMN email VARCHAR(150) NOT NULL DEFAULT ''";
    }
    if (!$hasUserId) {
        $alterStatements[] = "ADD COLUMN user_id INT DEFAULT NULL AFTER email";
    }
    if (count($alterStatements) > 0) {
        mysqli_query($conn, "ALTER TABLE orders " . implode(', ', $alterStatements));
        $hasCustomer = true;
        $hasEmail = true;
        $hasUserId = true;
    }

    // Build insert fields dynamically so this API still works if the orders table lacks customer/email/user_id columns.
    $fields = ['items', 'subtotal', 'delivery_fee', 'total', 'method', 'payment', 'address', 'phone', 'lat', 'lng'];
    $values = ["'$items'", "'$subtotal'", "'$delivery'", "'$total'", "'$method'", "'$payment'", "'$address'", "'$phone'", "'$latitude'", "'$longitude'"];

    if ($hasCustomer) {
        $fields[] = 'customer';
        $values[] = "'$customer'";
    }

    if ($hasEmail) {
        $fields[] = 'email';
        $values[] = "'$email'";
    }

    // Check if user_id column exists and add if provided
    $hasUserId = false;
    $userIdCheckRes = mysqli_query($conn, "SHOW COLUMNS FROM orders LIKE 'user_id'");
    if ($userIdCheckRes && mysqli_num_rows($userIdCheckRes) > 0) {
        $hasUserId = true;
    }
    
    if ($hasUserId) {
        $fields[] = 'user_id';
        $values[] = ($user_id > 0 ? $user_id : 'NULL');
    }

    $sql = sprintf(
        "INSERT INTO orders (%s) VALUES (%s)",
        implode(', ', $fields),
        implode(', ', $values)
    );

    if (mysqli_query($conn, $sql)) {
        $orderId = mysqli_insert_id($conn);

        $itemsTableExists = false;
        $itemsTableCheck = mysqli_query($conn, "SHOW TABLES LIKE 'order_items'");
        if ($itemsTableCheck && mysqli_num_rows($itemsTableCheck) > 0) {
            $itemsTableExists = true;
        }

        if ($itemsTableExists && is_array($itemsData) && count($itemsData) > 0) {
            foreach ($itemsData as $item) {
                $itemName = mysqli_real_escape_string($conn, (string)($item['name'] ?? $item['product'] ?? $item['title'] ?? ''));
                $itemQty = intval($item['qty'] ?? $item['quantity'] ?? 1);
                $itemPrice = floatval($item['price'] ?? $item['unit_price'] ?? 0);
                mysqli_query($conn, "INSERT INTO order_items (order_id, product, qty, price) VALUES ('$orderId', '$itemName', '$itemQty', '$itemPrice')");
            }
        }

        echo json_encode([
            "status" => "success",
            "order_id" => $orderId
        ]);
    } else {
        throw new Exception("SQL Error: " . mysqli_error($conn));
    }

} catch (Exception $e) {
    // Log error to file for debugging
    @file_put_contents(__DIR__ . '/api_orders_errors.log', 
        date('c') . " - " . $e->getMessage() . "\n", 
        FILE_APPEND
    );
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}
?>