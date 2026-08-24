<?php
require_once __DIR__ . '/../includes/db.php';

$conn->begin_transaction();

try {
    // Add 3 missing starters
    $query = "INSERT INTO products (name, category, regular_price, solo_price, sharing_price, stock, image, description, available, date_added, date_modified, slice_price, small_price, big_price, meal_price, combo_price, options, staff_only, sort_order) 
    VALUES (?, 'Starter', 0.00, ?, ?, 0, ?, NULL, 1, NOW(), NOW(), 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, ?)";
    
    $stmt = $conn->prepare($query);
    
    $starters = [
        ['Lumpiang Shanghai', 120, 220, 'lumpiang_shanghai.png', 6],
        ['Tempura', 140, 260, 'tempura.png', 7],
        ['Pork Barbecue', 130, 240, 'pork_barbecue.png', 8]
    ];
    
    $inserted_ids = [];
    
    foreach ($starters as $starter) {
        $stmt->bind_param("sdssi", $starter[0], $starter[1], $starter[2], $starter[3], $starter[4]);
        if (!$stmt->execute()) {
            throw new Exception("Failed to insert {$starter[0]}: " . $stmt->error);
        }
        $inserted_ids[] = $conn->insert_id;
    }
    $stmt->close();
    
    // Create product_sizes for all starters (both new and existing)
    $size_query = "INSERT IGNORE INTO product_sizes (product_id, size_label, price)
    SELECT id, 'solo', solo_price FROM products WHERE category = 'Starter' AND solo_price > 0
    UNION ALL
    SELECT id, 'sharing', sharing_price FROM products WHERE category = 'Starter' AND sharing_price > 0";
    
    if (!$conn->query($size_query)) {
        throw new Exception("Failed to create product_sizes: " . $conn->error);
    }
    
    $conn->commit();
    
    http_response_code(200);
    echo json_encode([
        'status' => 'success',
        'message' => '3 starters added and product_sizes created',
        'inserted_ids' => $inserted_ids
    ]);
    
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}

$conn->close();
?>
