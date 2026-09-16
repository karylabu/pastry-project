<?php
// Enable strict error logging
ini_set('display_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/chat_debug.log');

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../../../includes/api_auth.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$raw = file_get_contents("php://input");
$data = json_decode($raw, true) ?? $_POST;

$authUser = requireApiRole(['customer', 'admin']);
$isAdmin = strtolower((string) $authUser['role']) === 'admin';
$authenticatedUserId = (int) $authUser['id'];

// DEBUG LOGGING
$clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
error_log("[$clientIP] RAW: $raw");

$uId = $data['user_id'] ?? $data['customer_id'] ?? 0;
$userId = $isAdmin && intval($uId) > 0 ? intval($uId) : $authenticatedUserId;

$oId = $data['order_id'] ?? 0;
$orderId = (intval($oId) > 0) ? intval($oId) : null;

$message = trim($data['message'] ?? "");
$sender  = $isAdmin ? 'admin' : 'customer';
$supportMode = "staff";

if ($orderId !== null) {
    $orderCheck = $conn->prepare($isAdmin
        ? 'SELECT user_id FROM orders WHERE id = ? LIMIT 1'
        : 'SELECT user_id FROM orders WHERE id = ? AND user_id = ? LIMIT 1');
    if ($isAdmin) {
        $orderCheck->bind_param('i', $orderId);
    } else {
        $orderCheck->bind_param('ii', $orderId, $authenticatedUserId);
    }
    $orderCheck->execute();
    $orderOwner = $orderCheck->get_result()->fetch_assoc();
    $orderCheck->close();
    if (!$orderOwner) {
        echo json_encode(["success" => false, "message" => "You cannot access this order conversation."]);
        exit();
    }
    $userId = (int) ($orderOwner['user_id'] ?? $userId);
}

if (empty($message)) {
    echo json_encode(["success" => false, "message" => "Empty message"]);
    exit();
}

/* =========================
   SAVE MESSAGE
========================= */
// Force column fixes just in case
$conn->query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id INT NULL");
$conn->query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
$conn->query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_path VARCHAR(255) NULL");
$conn->query("ALTER TABLE messages MODIFY order_id INT NULL");

$query = "INSERT INTO messages (order_id, user_id, sender, message, created_at) VALUES (?, ?, ?, ?, NOW())";
$stmt = $conn->prepare($query);

if (!$stmt) {
    error_log("DB PREPARE ERROR: " . $conn->error);
    echo json_encode(["success" => false, "message" => "DB Error: " . $conn->error]);
    exit();
}

$stmt->bind_param("iiss", $orderId, $userId, $sender, $message);

if ($stmt->execute()) {
    $stmt->close();
    error_log("SUCCESS: Message saved");

    echo json_encode(["success" => true, "message" => "Sent"]);
} else {
    error_log("DB EXECUTE ERROR: " . $stmt->error);
    echo json_encode(["success" => false, "message" => "Execute failed: " . $stmt->error]);
}

$conn->close();
