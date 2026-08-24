<?php
require_once __DIR__ . '/../includes/db.php';

try {
    // Define all 7 starters with prices
    $starters = [
        ['French Fries', 70, 140],
        ['Cheesy Bacon Fries', 120, 230],
        ['Potato Wedges', 75, 140],
        ['Mozzarella Sticks', 140, 200],
        ['Mojos', 75, 140],
        ['Mojos Hot', 75, 140],
        ['Chicken Nuggets', 120, 230]
    ];
    
    $conn->begin_transaction();
    
    // First, ensure all starters exist
    $insert_query = "INSERT IGNORE INTO products (name, category, solo_price, sharing_price, price, stock, image, description, available) 
                     VALUES (?, 'Starters', ?, ?, ?, 10, ?, ?, 1)";
    $insert_stmt = $conn->prepare($insert_query);
    
    foreach ($starters as [$name, $solo, $sharing]) {
        // Calculate a base price (average of solo and sharing)
        $base_price = round(($solo + $sharing) / 2);
        $image = strtolower(str_replace(' ', '_', $name)) . '.png';
        $description = $name . ' - Delicious starter';
        
        $insert_stmt->bind_param("siidss", $name, $solo, $sharing, $base_price, $image, $description);
        if (!$insert_stmt->execute()) {
            // Continue on duplicate, we'll update anyway
        }
    }
    $insert_stmt->close();
    
    // Now update all starters with correct prices
    $update_query = "UPDATE products SET solo_price = ?, sharing_price = ? WHERE name = ? AND category = 'Starters'";
    $update_stmt = $conn->prepare($update_query);
    
    foreach ($starters as [$name, $solo, $sharing]) {
        $update_stmt->bind_param("ids", $solo, $sharing, $name);
        if (!$update_stmt->execute()) {
            throw new Exception("Failed to update {$name}: " . $update_stmt->error);
        }
    }
    $update_stmt->close();
    
    // Delete old product_sizes for starters and recreate
    $conn->query("DELETE FROM product_sizes WHERE product_id IN (SELECT id FROM products WHERE category = 'Starters')");
    
    // Insert solo sizes
    $conn->query("INSERT INTO product_sizes (product_id, size_label, price) 
    SELECT id, 'solo', solo_price FROM products WHERE category = 'Starters' AND solo_price > 0");
    
    // Insert sharing sizes
    $conn->query("INSERT INTO product_sizes (product_id, size_label, price) 
    SELECT id, 'sharing', sharing_price FROM products WHERE category = 'Starters' AND sharing_price > 0");
    
    $conn->commit();
    
    // Verify
    $verify = $conn->query("SELECT id, name, solo_price, sharing_price FROM products WHERE category = 'Starters' ORDER BY name");
    $results = [];
    $count = 0;
    while ($row = $verify->fetch_assoc()) {
        $results[] = $row;
        $count++;
    }
    
    // Verify product_sizes
    $ps_verify = $conn->query("SELECT COUNT(*) as count FROM product_sizes WHERE product_id IN (SELECT id FROM products WHERE category = 'Starters')");
    $ps_row = $ps_verify->fetch_assoc();
    
    echo json_encode([
        'status' => 'success',
        'message' => "All 7 starters updated successfully",
        'starters_count' => $count,
        'product_sizes_count' => $ps_row['count'],
        'starters' => $results
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}

$conn->close();
?>
