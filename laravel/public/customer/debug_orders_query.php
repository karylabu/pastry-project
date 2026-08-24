<?php
session_start();
require 'includes/data.php';

// DEBUG: Check what's in session
$user = $_SESSION['user'] ?? null;
echo "<h2>DEBUG - Session Data:</h2>";
echo "User ID: " . ($user['id'] ?? 'NOT SET') . "<br>";
echo "Email: " . ($user['email'] ?? 'NOT SET') . "<br>";
echo "Name: " . ($user['name'] ?? 'NOT SET') . "<br>";
echo "<hr>";

// DEBUG: Query the database manually
$email = $user['email'] ?? '';
$name = $user['name'] ?? '';
$id = $user['id'] ?? 0;

echo "<h2>DEBUG - Database Query:</h2>";
echo "Looking for orders where:<br>";
echo "- email = '$email'<br>";
echo "- name = '$name'<br>";
echo "- user_id = $id<br>";
echo "<hr>";

$query = 'SELECT id, user_id, customer, email, status, total, created_at FROM orders WHERE LOWER(email) = LOWER(?) OR LOWER(customer) = LOWER(?) OR user_id = ? ORDER BY id DESC LIMIT 20';

$ordersRaw = db_all($query, [$email, $name, (int)$id]);

echo "<h2>Result: " . count($ordersRaw) . " orders found</h2>";
echo "<table border='1' cellpadding='10'>";
echo "<tr><th>ID</th><th>User ID</th><th>Customer</th><th>Email</th><th>Status</th><th>Total</th></tr>";

foreach ($ordersRaw as $o) {
    echo "<tr>";
    echo "<td>" . $o['id'] . "</td>";
    echo "<td>" . ($o['user_id'] ?? 'NULL') . "</td>";
    echo "<td>" . htmlspecialchars($o['customer']) . "</td>";
    echo "<td>" . htmlspecialchars($o['email']) . "</td>";
    echo "<td>" . $o['status'] . "</td>";
    echo "<td>" . $o['total'] . "</td>";
    echo "</tr>";
}

echo "</table>";

// DEBUG: Check if database connection works
echo "<h2>DEBUG - DB Connection:</h2>";
try {
    $pdo = db();
    echo "✅ Database connection OK<br>";
} catch (Exception $e) {
    echo "❌ Database connection ERROR: " . $e->getMessage() . "<br>";
}
?>
