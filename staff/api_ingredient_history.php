<?php
require_once __DIR__ . '/../includes/api_auth.php';

requireInventoryRead();

$conn = new mysqli("localhost", "root", "", "pastry_db");
if ($conn->connect_error) {
    echo json_encode(["success" => false, "message" => "Database connection failed"]);
    exit;
}

$ingredient_id = isset($_GET['ingredient_id']) ? intval($_GET['ingredient_id']) : 0;
if (!$ingredient_id) {
    echo json_encode(["success" => false, "message" => "ingredient_id required"]);
    $conn->close();
    exit;
}

$sql = "SELECT id, ingredient_id, action, qty, note, user_id, reference_type, reference_id, previous_stock, new_stock, created_at FROM ingredient_movements WHERE ingredient_id = ? ORDER BY created_at DESC";
$stmt = $conn->prepare($sql);
$stmt->bind_param('i', $ingredient_id);
$stmt->execute();
$res = $stmt->get_result();
$rows = [];
while ($r = $res->fetch_assoc()) {
    $rows[] = [
        'id' => (int)$r['id'],
        'ingredient_id' => (int)$r['ingredient_id'],
        'type' => $r['action'],
        'qty' => (float)$r['qty'],
        'note' => $r['note'],
        'user' => $r['user_id'],
        'reference_type' => $r['reference_type'],
        'reference_id' => $r['reference_id'],
        'previous_stock' => $r['previous_stock'] !== null ? (float) $r['previous_stock'] : null,
        'new_stock' => $r['new_stock'] !== null ? (float) $r['new_stock'] : null,
        'created_at' => $r['created_at'],
    ];
}

echo json_encode(["success" => true, "history" => $rows]);
$stmt->close();
$conn->close();
