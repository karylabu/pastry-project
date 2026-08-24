<?php
require_once __DIR__ . '/../includes/db.php';

try {
    $conn->begin_transaction();
    
    // Delete duplicates - keep the lower IDs
    // For French Fries: keep 26, delete 57
    $conn->query("DELETE FROM product_sizes WHERE product_id = 57");
    $conn->query("DELETE FROM products WHERE id = 57");
    
    // For Potato Wedges: keep 27, delete 59
    $conn->query("DELETE FROM product_sizes WHERE product_id = 59");
    $conn->query("DELETE FROM products WHERE id = 59");
    
    // For Mojos: keep 24, delete 61
    $conn->query("DELETE FROM product_sizes WHERE product_id = 61");
    $conn->query("DELETE FROM products WHERE id = 61");
    
    // Remove Starter Plate (not in the 7 required)
    $conn->query("DELETE FROM product_sizes WHERE product_id = 23");
    $conn->query("DELETE FROM products WHERE id = 23");
    
    $conn->commit();
    
    // Verify final list
    $verify = $conn->query("SELECT id, name, solo_price, sharing_price FROM products WHERE category = 'Starters' ORDER BY name");
    $results = [];
    $expected = ['Cheesy Bacon Fries', 'Chicken Nuggets', 'French Fries', 'Mojos', 'Mojos Hot', 'Mozzarella Sticks', 'Potato Wedges'];
    $expected_count = 0;
    
    while ($row = $verify->fetch_assoc()) {
        $results[] = $row;
        if (in_array($row['name'], $expected)) {
            $expected_count++;
        }
    }
    
    // Verify product_sizes
    $ps_verify = $conn->query("SELECT COUNT(*) as count FROM product_sizes WHERE product_id IN (SELECT id FROM products WHERE category = 'Starters')");
    $ps_row = $ps_verify->fetch_assoc();
    
    echo json_encode([
        'status' => 'success',
        'message' => 'Duplicates removed and cleanup completed',
        'total_starters' => count($results),
        'expected_starters' => $expected_count,
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
