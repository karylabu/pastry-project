<?php
require_once __DIR__ . '/../includes/db.php';

// Debug: Check what's in the orders table
$query = "SELECT id, user_id, customer, email, status, total, created_at FROM orders ORDER BY created_at DESC LIMIT 10";
$result = $conn->query($query);

echo "=== ORDERS TABLE DEBUG ===\n\n";
echo "Total orders: " . $conn->query("SELECT COUNT(*) as cnt FROM orders")->fetch_assoc()['cnt'] . "\n\n";

if ($result) {
    while ($row = $result->fetch_assoc()) {
        echo "Order ID: {$row['id']}\n";
        echo "  user_id: {$row['user_id']} (type: " . gettype($row['user_id']) . ")\n";
        echo "  customer: {$row['customer']}\n";
        echo "  email: {$row['email']}\n";
        echo "  status: {$row['status']}\n";
        echo "  total: {$row['total']}\n";
        echo "  created_at: {$row['created_at']}\n\n";
    }
} else {
    echo "Query failed: " . $conn->error . "\n";
}

// Also check what the API would return for a specific user
$test_user_id = 1;
echo "\n=== API TEST ===\n";
echo "Query: SELECT * FROM orders WHERE user_id = $test_user_id\n";
$test_result = $conn->query("SELECT id, customer, total FROM orders WHERE user_id = $test_user_id LIMIT 5");
echo "Found: " . $test_result->num_rows . " orders\n";
if ($test_result->num_rows > 0) {
    while ($row = $test_result->fetch_assoc()) {
        echo "  - Order {$row['id']}: {$row['customer']} (₱{$row['total']})\n";
    }
} else {
    echo "No orders found for user_id=$test_user_id\n";
}

$conn->close();
?>
