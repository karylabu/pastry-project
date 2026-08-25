<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

try {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    
    if (!$data) {
        throw new Exception('No data received');
    }

    $conn = mysqli_connect('localhost', 'root', '', 'pastry_db');
    if (!$conn) {
        throw new Exception('Database connection failed: ' . mysqli_connect_error());
    }

    // Sanitize and extract
    $user_id = intval($data['user_id'] ?? 0);
    $customer = mysqli_real_escape_string($conn, $data['customer'] ?? '');
    $email = mysqli_real_escape_string($conn, $data['email'] ?? '');
    $items_data = $data['items'] ?? [];
    $items_json = mysqli_real_escape_string($conn, json_encode($items_data));
    $subtotal = floatval($data['subtotal'] ?? 0);
    $delivery_fee = floatval($data['delivery_fee'] ?? 0);
    $total = floatval($data['total'] ?? 0);
    $method = mysqli_real_escape_string($conn, $data['method'] ?? 'Delivery');
    $payment = mysqli_real_escape_string($conn, $data['payment'] ?? 'Cash on Delivery');
    $address = mysqli_real_escape_string($conn, $data['address'] ?? '');
    $phone = mysqli_real_escape_string($conn, $data['phone'] ?? '');
    $lat = floatval($data['latitude'] ?? 0);
    $lng = floatval($data['longitude'] ?? 0);
    $status = 'Pending';
    $order_date = date('Y-m-d');

    $sql = "INSERT INTO orders (
                user_id, customer, email, items, subtotal, delivery_fee,
                total, method, payment, address, phone, lat, lng,
                status, order_date, created_at
            ) VALUES (
                " . ($user_id > 0 ? $user_id : "NULL") . ",
                '$customer', '$email', '$items_json', $subtotal, $delivery_fee,
                $total, '$method', '$payment', '$address', '$phone', $lat, $lng,
                '$status', '$order_date', NOW()
            )";

    if (!mysqli_query($conn, $sql)) {
        throw new Exception('Query failed: ' . mysqli_error($conn));
    }

    $order_id = mysqli_insert_id($conn);

    // --- Create Notification for the user ---
    // Ensure table exists first
    mysqli_query($conn, "CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'order',
        is_read TINYINT(1) DEFAULT 0,
        action_url VARCHAR(255) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    if ($user_id > 0) {
        $notif_title = "Order Placed";
        $notif_msg = "Your order #$order_id has been successfully placed. We'll notify you once it's confirmed!";
        $notif_type = "order";
        $action_url = "/customer/orders/$order_id";

        $notif_sql = "INSERT INTO notifications (user_id, title, message, type, action_url)
                      VALUES ($user_id, '$notif_title', '$notif_msg', '$notif_type', '$action_url')";
        mysqli_query($conn, $notif_sql);
    }

    // Also insert into order_items table if it exists for backward compatibility/redundancy
    $table_check = mysqli_query($conn, "SHOW TABLES LIKE 'order_items'");
    if ($table_check && mysqli_num_rows($table_check) > 0) {
        foreach ($items_data as $item) {
            $p_name = mysqli_real_escape_string($conn, $item['name'] ?? '');
            $p_id = intval($item['id'] ?? $item['product_id'] ?? 0);
            $p_qty = intval($item['qty'] ?? 1);
            $p_price = floatval($item['price'] ?? 0);
            mysqli_query($conn, "INSERT INTO order_items (order_id, product_id, product, qty, price) VALUES ($order_id, " . ($p_id > 0 ? $p_id : 'NULL') . ", '$p_name', $p_qty, $p_price)");
        }
    }

    mysqli_close($conn);

    echo json_encode([
        'status' => 'success',
        'order_id' => $order_id,
        'message' => 'Order placed successfully'
    ]);

} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
?>
