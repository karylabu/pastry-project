<?php
require_once __DIR__ . '/../includes/db.php';

$conn->begin_transaction();

try {
    // Update starter prices to exact specifications
    $updates = [
        'French Fries' => ['solo' => 70, 'sharing' => 140],
        'Cheesy Bacon Fries' => ['solo' => 120, 'sharing' => 230],
        'Potato Wedges' => ['solo' => 75, 'sharing' => 140],
        'Mozzarella Sticks' => ['solo' => 140, 'sharing' => 200],
        'Mojos' => ['solo' => 75, 'sharing' => 140],
        'Mojos Hot' => ['solo' => 75, 'sharing' => 140],
        'Chicken Nuggets' => ['solo' => 120, 'sharing' => 230]
    ];
    
    $update_query = "UPDATE products SET solo_price = ?, sharing_price = ? WHERE name = ? AND category = 'Starter'";
    $stmt = $conn->prepare($update_query);
    
    foreach ($updates as $name => $prices) {
        $stmt->bind_param("dds", $prices['solo'], $prices['sharing'], $name);
        if (!$stmt->execute()) {
            throw new Exception("Failed to update {$name}: " . $stmt->error);
        }
    }
    $stmt->close();
    
    // Update/create product_sizes for all starters
    $size_query = "INSERT INTO product_sizes (product_id, size_label, price) 
    SELECT id, 'solo', solo_price FROM products WHERE category = 'Starter' AND solo_price > 0
    ON DUPLICATE KEY UPDATE price = VALUES(price);";
    
    if (!$conn->query($size_query)) {
        throw new Exception("Failed to update solo sizes: " . $conn->error);
    }
    
    $size_query = "INSERT INTO product_sizes (product_id, size_label, price) 
    SELECT id, 'sharing', sharing_price FROM products WHERE category = 'Starter' AND sharing_price > 0
    ON DUPLICATE KEY UPDATE price = VALUES(price);";
    
    if (!$conn->query($size_query)) {
        throw new Exception("Failed to update sharing sizes: " . $conn->error);
    }
    
    $conn->commit();
    
    // Verify updates
    $verify_query = "SELECT name, solo_price, sharing_price FROM products WHERE category = 'Starter' ORDER BY id";
    $result = $conn->query($verify_query);
    $verified = [];
    while ($row = $result->fetch_assoc()) {
        $verified[] = $row;
    }
    
    http_response_code(200);
    echo json_encode([
        'status' => 'success',
        'message' => 'All 7 starters updated with correct prices',
        'updated_starters' => $verified
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
