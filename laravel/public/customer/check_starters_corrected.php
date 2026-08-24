<?php
require_once __DIR__ . '/../includes/db.php';

// Query with correct category name (Starters with 's')
$query = "SELECT id, name, image, solo_price, sharing_price FROM products WHERE category = 'Starters' ORDER BY id";
$result = $conn->query($query);

if (!$result) {
    die("Query failed: " . $conn->error);
}

$starters = [];
while ($row = $result->fetch_assoc()) {
    $starters[] = $row;
}

header('Content-Type: application/json');
echo json_encode([
    'status' => 'success',
    'count' => count($starters),
    'data' => $starters
], JSON_PRETTY_PRINT);

$conn->close();
?>
