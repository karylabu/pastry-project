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

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$raw = file_get_contents("php://input");
$data = json_decode($raw, true) ?? $_POST;

// DEBUG LOGGING
$clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
error_log("[$clientIP] RAW: $raw");

// Fallback for customer_id if user_id is missing (Legacy support)
$uId = $data['user_id'] ?? $data['customer_id'] ?? 0;
$userId = (intval($uId) > 0) ? intval($uId) : null;

$oId = $data['order_id'] ?? 0;
$orderId = (intval($oId) > 0) ? intval($oId) : null;

$message = trim($data['message'] ?? "");
$sender  = $data['sender'] ?? "customer";

if (empty($message)) {
    echo json_encode(["success" => false, "message" => "Empty message"]);
    exit();
}

/* =========================
   SAVE MESSAGE
========================= */
/*
| SCHEMA NOTE: The messages table columns (user_id, updated_at) are maintained
| through versioned migrations in database/migrations/. This API must never run
| ALTER TABLE statements at request time.
*/

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
