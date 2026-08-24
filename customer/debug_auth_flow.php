<?php
/**
 * Debug endpoint to verify Flutter auth and order flow
 * Shows what user data is cached and how orders are being placed
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) {
        throw new Exception("Database connection failed");
    }

    $debug = [];

    // 1. Check latest orders
    $result = mysqli_query($conn, "SELECT id, user_id, customer, email, total, status, created_at 
                                   FROM orders 
                                   ORDER BY id DESC 
                                   LIMIT 5");
    $latest_orders = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $latest_orders[] = $row;
    }
    $debug['latest_orders'] = $latest_orders;

    // 2. Check user info
    $result = mysqli_query($conn, "SELECT id, name, email, role FROM users WHERE id = 8");
    $debug['user_hernandezkaryl78'] = mysqli_fetch_assoc($result);

    // 3. Check user sessions
    $result = mysqli_query($conn, "SELECT * FROM user_sessions WHERE user_id = 8 ORDER BY created_at DESC LIMIT 3");
    $sessions = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $sessions[] = $row;
    }
    $debug['user_sessions'] = $sessions;

    // 4. Check orders for user 8
    $result = mysqli_query($conn, "SELECT id, user_id, customer, email, total, status, created_at 
                                   FROM orders 
                                   WHERE user_id = 8 OR LOWER(email) = 'hernandezkaryl78@gmail.com'
                                   ORDER BY id DESC");
    $user_orders = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $user_orders[] = $row;
    }
    $debug['user_orders'] = $user_orders;

    $debug['message'] = 'Debug data loaded successfully';
    echo json_encode($debug, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    echo json_encode([
        'error' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}
?>
