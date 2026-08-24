<?php
require_once __DIR__ . '/../includes/db.php';

try {
    // Update all 7 starters with correct prices
    $updates = [
        ['French Fries', 70, 140],
        ['Cheesy Bacon Fries', 120, 230],
        ['Potato Wedges', 75, 140],
        ['Mozzarella Sticks', 140, 200],
        ['Mojos', 75, 140],
        ['Mojos Hot', 75, 140],
        ['Chicken Nuggets', 120, 230]
    ];
    
    $conn->begin_transaction();
    
    $update_query = "UPDATE products SET solo_price = ?, sharing_price = ? WHERE name = ? AND category = 'Starter'";
    $stmt = $conn->prepare($update_query);
    
    foreach ($updates as [$name, $solo, $sharing]) {
        $stmt->bind_param("ids", $solo, $sharing, $name);
        if (!$stmt->execute()) {
            throw new Exception("Failed to update {$name}: " . $stmt->error);
        }
    }
    $stmt->close();
    
    // Delete old product_sizes for starters and recreate
    $conn->query("DELETE FROM product_sizes WHERE product_id IN (SELECT id FROM products WHERE category = 'Starter')");
    
    // Insert solo sizes
    $conn->query("INSERT INTO product_sizes (product_id, size_label, price) 
    SELECT id, 'solo', solo_price FROM products WHERE category = 'Starter' AND solo_price > 0");
    
    // Insert sharing sizes
    $conn->query("INSERT INTO product_sizes (product_id, size_label, price) 
    SELECT id, 'sharing', sharing_price FROM products WHERE category = 'Starter' AND sharing_price > 0");
    
    $conn->commit();
    
    // Verify
    $verify = $conn->query("SELECT id, name, solo_price, sharing_price FROM products WHERE category = 'Starter' ORDER BY id");
    $starters = [];
    while ($row = $verify->fetch_assoc()) {
        $starters[] = $row;
    }
    
    echo json_encode([
        'status' => 'success',
        'message' => 'All 7 starters updated',
        'starters' => $starters
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
