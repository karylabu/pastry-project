<?php
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json');

// Test 1: Check database for any orders
$total_orders = $conn->query("SELECT COUNT(*) as cnt FROM orders")->fetch_assoc()['cnt'];

// Test 2: Try a simple query without filters
$all_orders = $conn->query("SELECT id, user_id, customer, email, total, created_at FROM orders ORDER BY created_at DESC LIMIT 5");
$orders_list = [];
while ($row = $all_orders->fetch_assoc()) {
    $orders_list[] = $row;
}

// Test 3: Test with parameters from GET/POST
$user_id = $_GET['user_id'] ?? null;
$email = $_GET['user_email'] ?? null;
$customer = $_GET['customer'] ?? null;

$filters = [];
$filtered_orders = [];

if ($user_id) {
    $filters[] = "user_id = " . intval($user_id);
}
if ($email) {
    $escaped = $conn->real_escape_string($email);
    $filters[] = "(email = '$escaped' OR customer = '$escaped')";
}
if ($customer) {
    $escaped = $conn->real_escape_string($customer);
    $filters[] = "customer = '$escaped'";
}

if (count($filters) > 0) {
    $sql = "SELECT id, user_id, customer, email, total, created_at FROM orders WHERE " . implode(' OR ', $filters) . " ORDER BY created_at DESC LIMIT 10";
} else {
    $sql = "SELECT id, user_id, customer, email, total, created_at FROM orders ORDER BY created_at DESC LIMIT 10";
}

$result = $conn->query($sql);
while ($row = $result->fetch_assoc()) {
    $filtered_orders[] = $row;
}

echo json_encode([
    'status' => 'debug',
    'total_orders_in_db' => $total_orders,
    'query_params' => [
        'user_id' => $user_id,
        'email' => $email,
        'customer' => $customer
    ],
    'sql_query' => $sql,
    'recent_orders' => $orders_list,
    'filtered_orders' => $filtered_orders,
    'filtered_count' => count($filtered_orders)
], JSON_PRETTY_PRINT);

$conn->close();
?>
