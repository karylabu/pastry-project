<?php
require_once __DIR__ . '/../includes/db.php';

$sql = "CREATE TABLE IF NOT EXISTS customize_orders (
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
    INDEX (user_id),
    INDEX (status),
    INDEX (created_at)
)";

if ($conn->query($sql) === TRUE) {
    echo json_encode(['success' => true, 'message' => 'customize_orders table created successfully']);
} else {
    echo json_encode(['success' => false, 'message' => 'Error creating table: ' . $conn->error]);
}

$conn->close();
?>
