<?php
/**
 * Admin initialization script to set up customize_orders table
 * Access via: http://yourserver/customer/admin_init_db.php
 */

require_once __DIR__ . '/../includes/db.php';

if (!$conn) {
    die(json_encode(['success' => false, 'message' => 'Database connection failed']));
}

// Create customize_orders table
$createTableSQL = "CREATE TABLE IF NOT EXISTS customize_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    order_id INT,
    cake_size VARCHAR(100),
    servings INT,
    cake_flavor VARCHAR(100),
    filling_flavor VARCHAR(100),
    frosting_type VARCHAR(100),
    occasion VARCHAR(100),
    theme VARCHAR(255),
    cake_color VARCHAR(100),
    custom_message TEXT,
    special_instructions TEXT,
    addons TEXT,
    estimated_price DECIMAL(10, 2),
    delivery_method VARCHAR(50),
    delivery_address TEXT,
    pickup_date DATE,
    pickup_time TIME,
    reference_images JSON,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

$results = [];

if ($conn->query($createTableSQL) === TRUE) {
    $results[] = ['success' => true, 'table' => 'customize_orders', 'message' => 'Table created or already exists'];
} else {
    $results[] = ['success' => false, 'table' => 'customize_orders', 'message' => 'Error: ' . $conn->error];
}

// Verify table structure
$checkTableSQL = "DESC customize_orders";
$checkResult = $conn->query($checkTableSQL);
if ($checkResult) {
    $columns = [];
    while ($row = $checkResult->fetch_assoc()) {
        $columns[] = $row['Field'];
    }
    $results[] = ['table_check' => 'customize_orders', 'columns' => $columns, 'column_count' => count($columns)];
}

$conn->close();

header('Content-Type: application/json');
echo json_encode($results, JSON_PRETTY_PRINT);
?>
