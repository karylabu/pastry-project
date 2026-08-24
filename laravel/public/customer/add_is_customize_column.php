<?php
/**
 * Add is_customize column to orders table if it doesn't exist
 */

require_once __DIR__ . '/../includes/db.php';

if (!$conn) {
    echo json_encode(['success' => false, 'message' => 'DB connection failed']);
    exit;
}

header('Content-Type: application/json');

// Check if column exists
$checkSQL = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'is_customize'";
$result = $conn->query($checkSQL);

if ($result && $result->num_rows > 0) {
    echo json_encode(['success' => true, 'message' => 'is_customize column already exists']);
    $conn->close();
    exit;
}

// Add column if it doesn't exist
$alterSQL = "ALTER TABLE orders ADD COLUMN is_customize TINYINT DEFAULT 0 AFTER user_id";
if ($conn->query($alterSQL) === TRUE) {
    echo json_encode(['success' => true, 'message' => 'is_customize column added successfully']);
} else {
    echo json_encode(['success' => false, 'message' => 'Error: ' . $conn->error]);
}

$conn->close();
?>
