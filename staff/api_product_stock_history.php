<?php
require_once __DIR__ . '/../includes/api_auth.php';
requireInventoryRead();

header('Content-Type: application/json');

$conn = new mysqli('localhost', 'root', '', 'pastry_db');
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

$productId = filter_input(INPUT_GET, 'product_id', FILTER_VALIDATE_INT) ?: 0;
$productVariantId = filter_input(INPUT_GET, 'product_variant_id', FILTER_VALIDATE_INT) ?: 0;
$userId = filter_input(INPUT_GET, 'user_id', FILTER_VALIDATE_INT) ?: 0;
$movementType = trim((string) ($_GET['movement_type'] ?? ''));
$from = trim((string) ($_GET['from'] ?? ''));
$to = trim((string) ($_GET['to'] ?? ''));
$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = min(100, max(1, (int) ($_GET['per_page'] ?? 25)));

$conditions = [];
$types = '';
$params = [];
if ($productId > 0) {
    $conditions[] = 'm.product_id = ?';
    $types .= 'i';
    $params[] = $productId;
}
if ($productVariantId > 0) {
    $conditions[] = 'm.product_variant_id = ?';
    $types .= 'i';
    $params[] = $productVariantId;
}
if ($userId > 0) {
    $conditions[] = 'm.user_id = ?';
    $types .= 'i';
    $params[] = $userId;
}
if ($movementType !== '') {
    $conditions[] = 'm.movement_type = ?';
    $types .= 's';
    $params[] = $movementType;
}
if ($from !== '') {
    $date = DateTime::createFromFormat('Y-m-d', $from);
    if (!$date || $date->format('Y-m-d') !== $from) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid from date; use YYYY-MM-DD']);
        exit;
    }
    $conditions[] = 'm.created_at >= ?';
    $types .= 's';
    $params[] = $from . ' 00:00:00';
}
if ($to !== '') {
    $date = DateTime::createFromFormat('Y-m-d', $to);
    if (!$date || $date->format('Y-m-d') !== $to) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid to date; use YYYY-MM-DD']);
        exit;
    }
    $conditions[] = 'm.created_at < DATE_ADD(?, INTERVAL 1 DAY)';
    $types .= 's';
    $params[] = $to;
}

$where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
$offset = ($page - 1) * $perPage;

try {
    $countStmt = $conn->prepare("SELECT COUNT(*) AS total FROM product_inventory_movements m {$where}");
    if (!$countStmt) throw new RuntimeException('Failed to prepare history count');
    if ($types !== '') $countStmt->bind_param($types, ...$params);
    if (!$countStmt->execute()) throw new RuntimeException('Failed to count stock history');
    $total = (int) $countStmt->get_result()->fetch_assoc()['total'];
    $countStmt->close();

    $sql = "SELECT m.id, m.product_id, m.product_variant_id, p.name AS product_name, m.movement_type, m.quantity,
                   m.previous_stock, m.new_stock, m.reason, m.reference_type, m.reference_id,
                   m.created_at, u.name AS staff_name
            FROM product_inventory_movements m
            INNER JOIN products p ON p.id = m.product_id
            LEFT JOIN users u ON u.id = m.user_id
            {$where}
            ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) throw new RuntimeException('Failed to prepare stock history');
    $queryTypes = $types . 'ii';
    $queryParams = array_merge($params, [$perPage, $offset]);
    $stmt->bind_param($queryTypes, ...$queryParams);
    if (!$stmt->execute()) throw new RuntimeException('Failed to retrieve stock history');
    $result = $stmt->get_result();
    $history = [];
    while ($row = $result->fetch_assoc()) {
        $history[] = [
            'movement_id' => (int) $row['id'],
            'product_id' => (int) $row['product_id'],
            'product_variant_id' => $row['product_variant_id'] === null ? null : (int) $row['product_variant_id'],
            'product_name' => $row['product_name'],
            'movement_type' => $row['movement_type'],
            'quantity' => (float) $row['quantity'],
            'previous_stock' => (float) $row['previous_stock'],
            'new_stock' => (float) $row['new_stock'],
            'reason' => $row['reason'],
            'reference_type' => $row['reference_type'],
            'reference_id' => $row['reference_id'] === null ? null : (int) $row['reference_id'],
            'staff' => $row['staff_name'] ?: 'System',
            'created_at' => $row['created_at'],
        ];
    }
    $stmt->close();
    echo json_encode(['success' => true, 'history' => $history, 'pagination' => [
        'page' => $page, 'per_page' => $perPage, 'total' => $total,
        'total_pages' => (int) ceil($total / $perPage),
    ]]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to retrieve stock history']);
}
$conn->close();
