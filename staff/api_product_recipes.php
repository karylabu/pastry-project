<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$conn = new mysqli("localhost", "root", "", "pastry_db");
if ($conn->connect_error) {
    echo json_encode(["success" => false, "message" => "Database connection failed"]);
    exit;
}

$product_id = isset($_GET['product_id']) ? intval($_GET['product_id']) : 0;
if ($product_id <= 0) {
    echo json_encode(["success" => false, "message" => "Missing product_id"]);
    $conn->close();
    exit;
}

$stmt = $conn->prepare(
    "SELECT pr.ingredient_id, pr.qty, i.name, i.unit, i.stock
     FROM product_recipes pr
     JOIN ingredients i ON i.id = pr.ingredient_id
     WHERE pr.product_id = ?"
);
$stmt->bind_param('i', $product_id);
$stmt->execute();
$result = $stmt->get_result();

$recipe = [];
while ($row = $result->fetch_assoc()) {
    $recipe[] = [
        'ingredient_id' => intval($row['ingredient_id']),
        'qty' => floatval($row['qty']),
        'name' => $row['name'],
        'unit' => $row['unit'],
        'stock' => floatval($row['stock'])
    ];
}

$stmt->close();
$conn->close();

echo json_encode(["success" => true, "recipe" => $recipe]);
