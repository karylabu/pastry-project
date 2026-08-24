<?php
/**
 * migration.php - Run database migrations
 */

header('Content-Type: application/json');

require_once __DIR__ . '/includes/db.php';

if (!$conn) {
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

try {
    // Add is_customized column if it doesn't exist
    $checkColumn = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'is_customized' AND TABLE_SCHEMA = 'pastry_db'";
    $result = mysqli_query($conn, $checkColumn);
    
    if (mysqli_num_rows($result) == 0) {
        // Column doesn't exist, add it
        $addColumn = "ALTER TABLE `orders` ADD COLUMN `is_customized` TINYINT(1) DEFAULT 0 AFTER `address_id`";
        if (!mysqli_query($conn, $addColumn)) {
            throw new Exception("Failed to add is_customized column: " . mysqli_error($conn));
        }
        
        // Create index
        $createIndex = "CREATE INDEX idx_is_customized ON `orders`(is_customized)";
        mysqli_query($conn, $createIndex); // Ignore if index already exists
        
        // Update existing custom cake orders
        $updateCustom = "UPDATE `orders` SET `is_customized` = 1 WHERE `type` = 'Custom'";
        mysqli_query($conn, $updateCustom);
        
        echo json_encode(['success' => true, 'message' => 'Migration completed. is_customized column added.']);
    } else {
        echo json_encode(['success' => true, 'message' => 'is_customized column already exists.']);
    }
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

mysqli_close($conn);
?>
