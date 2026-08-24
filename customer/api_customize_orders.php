<?php
/**
 * api_customize_orders.php
 * 
 * GET: Fetch all customized orders for a user
 * POST: Not used (custom orders are created via api_custom_cake.php)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db.php';

if (!$conn) {
    echo json_encode(['success' => false, 'message' => 'DB connection failed']);
    exit;
}

// Ensure customize_orders table exists
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

$conn->query($createTableSQL);

// GET: Fetch customized orders for user
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $userId = intval($_GET['user_id'] ?? 0);
    
    if ($userId <= 0) {
        echo json_encode(['success' => false, 'message' => 'user_id is required']);
        exit;
    }
    
    $stmt = $conn->prepare(
        "SELECT * FROM customize_orders 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT 50"
    );
    
    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $conn->error]);
        exit;
    }
    
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $orders = [];
    while ($row = $result->fetch_assoc()) {
        // Parse JSON fields
        if ($row['reference_images']) {
            try {
                $row['reference_images'] = json_decode($row['reference_images'], true) ?: [];
            } catch (Exception $e) {
                $row['reference_images'] = [];
            }
        } else {
            $row['reference_images'] = [];
        }
        
        if ($row['addons']) {
            try {
                // Try decoding as JSON first
                $decodedAddons = json_decode($row['addons'], true);
                if (is_array($decodedAddons)) {
                    $row['addons'] = $decodedAddons;
                } else if (is_string($row['addons']) && !empty($row['addons'])) {
                    $row['addons'] = explode(',', $row['addons']);
                } else {
                    $row['addons'] = [];
                }
            } catch (Exception $e) {
                if (is_string($row['addons']) && !empty($row['addons'])) {
                    $row['addons'] = explode(',', $row['addons']);
                } else {
                    $row['addons'] = [];
                }
            }
        } else {
            $row['addons'] = [];
        }
        
        $orders[] = $row;
    }
    
    $stmt->close();
    
    echo json_encode([
        'success' => true,
        'orders' => $orders,
        'total' => count($orders)
    ]);
    exit;
}

// Method not allowed
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
$conn->close();
?>

