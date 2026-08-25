<?php
ini_set('display_errors', 0);
error_reporting(0);
while (ob_get_level()) ob_end_clean();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/api_auth.php';
requireInventoryRead();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['success' => true]);
    exit();
}

if (!$conn) {
    echo json_encode(['success' => false, 'conversations' => []]);
    exit();
}

$sql = "
    SELECT
        latest.order_id,
        CASE WHEN o.id IS NULL THEN 'General Inquiry' ELSE o.status END AS order_status,
        COALESCE(NULLIF(o.customer, ''), NULLIF(u.name, ''), 'Customer') AS customer_name,
        CONCAT('Order #', COALESCE(o.id, latest.order_id)) AS order_label,
        m.message AS last_message,
        m.sender AS last_sender,
        m.created_at AS last_message_at,
        (
            SELECT COUNT(*)
            FROM messages
            WHERE order_id = latest.order_id
              AND sender = 'customer'
              AND is_read = 0
        ) AS unread_count
    FROM (
        SELECT order_id, MAX(created_at) AS latest_created_at
        FROM messages
        GROUP BY order_id
    ) latest
    JOIN messages m
      ON m.order_id = latest.order_id
     AND m.created_at = latest.latest_created_at
    LEFT JOIN orders o
      ON o.id = latest.order_id
    LEFT JOIN users u
      ON u.id = o.user_id
    ORDER BY m.created_at DESC
";

$result = $conn->query($sql);
$conversations = [];

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $conversations[] = $row;
    }
}

$conn->close();

echo json_encode([
    'success' => true,
    'conversations' => $conversations,
]);
exit();
