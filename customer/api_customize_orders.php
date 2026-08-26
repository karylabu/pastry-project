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

/*
| SCHEMA NOTE: The customize_orders table is created by the versioned migration
| database/migrations/2026_08_25_07_runtime_ddl_tables.sql. This API must never
| run CREATE TABLE / ALTER TABLE statements at request time.
*/

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

