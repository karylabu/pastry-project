<?php
require_once __DIR__ . '/../includes/db.php';

$conn->begin_transaction();

try {
    // Fix the image extensions to match actual files
    $updates = [
        'Mojos Hot' => 'mojos_hot.jpg',
        'Mozzarella Sticks' => 'mozzarella_sticks.jpg',
        'Cheesy Bacon Fries' => 'cheesy_bacon_fries.jpg'
    ];
    
    $query = "UPDATE products SET image = ? WHERE name = ? AND category = 'Starters'";
    $stmt = $conn->prepare($query);
    
    foreach ($updates as $name => $image) {
        $stmt->bind_param("ss", $image, $name);
        if (!$stmt->execute()) {
            throw new Exception("Failed to update {$name}: " . $stmt->error);
        }
    }
    $stmt->close();
    
    $conn->commit();
    
    // Verify updates
    $verify = $conn->query("SELECT id, name, image FROM products WHERE name IN ('Mojos Hot', 'Mozzarella Sticks', 'Cheesy Bacon Fries') ORDER BY id");
    $results = [];
    while ($row = $verify->fetch_assoc()) {
        $results[] = $row;
    }
    
    echo json_encode([
        'status' => 'success',
        'message' => 'Fixed 3 starter image extensions',
        'updated' => $results
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
