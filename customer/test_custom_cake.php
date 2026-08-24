<?php
require_once __DIR__ . '/../includes/db.php';

// Check table structure
echo "=== custom_cake_orders table structure ===\n";
$result = $conn->query("DESC custom_cake_orders");
while ($row = $result->fetch_assoc()) {
    echo "Column: {$row['Field']}, Type: {$row['Type']}\n";
}

echo "\n=== orders table structure ===\n";
$result = $conn->query("DESC orders");
while ($row = $result->fetch_assoc()) {
    echo "Column: {$row['Field']}, Type: {$row['Type']}\n";
}
?>
