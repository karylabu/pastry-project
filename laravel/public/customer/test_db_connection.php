<?php
require_once __DIR__ . '/../includes/db.php';

// Check connection
if (!$conn) {
    echo "Database connection failed: " . $GLOBALS['db_error'] . "\n";
    exit(1);
}

echo "Connection successful!\n";

// Check if the products table exists
$query = "SHOW TABLES LIKE 'products'";
$result = $conn->query($query);
if ($result && $result->num_rows > 0) {
    echo "Products table exists.\n";
} else {
    echo "Products table does NOT exist.\n";
}

// Get all unique categories
$query = "SELECT DISTINCT category FROM products";
$result = $conn->query($query);
if ($result) {
    echo "Unique categories in database:\n";
    while ($row = $result->fetch_assoc()) {
        echo "  - " . $row['category'] . "\n";
    }
} else {
    echo "Error querying categories: " . $conn->error . "\n";
}

// Count total products
$query = "SELECT COUNT(*) as total FROM products";
$result = $conn->query($query);
if ($result) {
    $row = $result->fetch_assoc();
    echo "Total products in database: " . $row['total'] . "\n";
}

// Check for starters specifically
$query = "SELECT id, name, image FROM products WHERE category = 'Starter' LIMIT 5";
$result = $conn->query($query);
if ($result) {
    echo "Starters found: " . $result->num_rows . "\n";
    while ($row = $result->fetch_assoc()) {
        echo "  ID: " . $row['id'] . ", Name: " . $row['name'] . ", Image: " . ($row['image'] ? $row['image'] : "NULL") . "\n";
    }
} else {
    echo "Error querying starters: " . $conn->error . "\n";
}

$conn->close();
?>
