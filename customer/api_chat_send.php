<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once __DIR__ . '/../includes/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$raw = file_get_contents("php://input");
$data = json_decode($raw, true) ?? $_POST;

$uId = $data['user_id'] ?? $data['customer_id'] ?? 0;
$userId = (intval($uId) > 0) ? intval($uId) : null;
$oId = $data['order_id'] ?? 0;
$orderId = (intval($oId) > 0) ? intval($oId) : null;
$message = trim($data['message'] ?? "");
$sender  = $data['sender'] ?? "customer";
$conversationId = substr(trim($data['conversation_id'] ?? ''), 0, 64) ?: null;

if (empty($message) && !isset($_FILES['image'])) {
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

if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
    $targetDir = __DIR__ . "/uploads/chat/";
    if (!is_dir($targetDir)) mkdir($targetDir, 0777, true);
    $fileName = time() . "_" . basename($_FILES["image"]["name"]);
    $targetFile = $targetDir . $fileName;
    if (move_uploaded_file($_FILES["image"]["tmp_name"], $targetFile)) {
        $imagePath = "uploads/chat/" . $fileName;
    }
}

$query = "INSERT INTO messages (order_id, user_id, sender, message, image_path, conversation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())";
$stmt = $conn->prepare($query);

if ($stmt) {
    $stmt->bind_param("iissss", $orderId, $userId, $sender, $message, $imagePath, $conversationId);
    if ($stmt->execute()) {
        $insertedId = $stmt->insert_id;
        $stmt->close();

        $aiReply = null;
        if (false) {
            $lowerMessage = strtolower($message);
            $isTagalog = preg_match('/\b(po|opo|kumusta|nasaan|nasan|magkano|ano|alin|salamat|bakit|paano|paki|masarap|alin|ba|na|mga|ang|ng|sa|wala|ala|meron|merung|cge|sige|oo|hindi|de|bakit|kaya|lang|naman|rin|din|ito|yan|iyon|natin|kami|tayo|sila|yung|ung|mura|pede|pwede|itry|subukan)\b/i', $lowerMessage);

            $possibleOrderId = 0;
            if (is_numeric(trim($message))) {
                $possibleOrderId = intval(trim($message));
            } elseif (preg_match('/\b(?:order\s*(?:#|number|no\.?|id)?\s*)?(\d{1,8})\b/i', $message, $matches)) {
                $possibleOrderId = intval($matches[1]);
            }

            if ($possibleOrderId > 0) {
                $foundOrder = null;
                $res = $conn->query("SELECT status, method FROM orders WHERE id = $possibleOrderId");
                if ($res && $row = $res->fetch_assoc()) {
                    $foundOrder = (object)$row;
                }
                if ($foundOrder) {
                    $aiReply = $isTagalog
                        ? "Nakita ko ang Order #$possibleOrderId. Ang status nito ay: $foundOrder->status. Ang delivery method ay $foundOrder->method."
                        : "I found Order #$possibleOrderId. Its current status is: $foundOrder->status. The delivery method is $foundOrder->method.";

                    if ($orderId === null || $orderId === 0) {
                        $conn->query("UPDATE messages SET order_id = $possibleOrderId WHERE id = $insertedId");
                        $orderId = $possibleOrderId;
                    }
                }
            }

            if (!$aiReply) {
                if (str_contains($lowerMessage, 'hello') || str_contains($lowerMessage, 'hi') || str_contains($lowerMessage, 'kumusta')) {
                    $aiReply = $isTagalog ? "Kumusta! Welcome sa Pastry Project. 😊 Ano po ang maitutulong ko?" : "Hello! Welcome to Pastry Project. 😊 How can I help you?";
                } elseif (str_contains($lowerMessage, 'order') || str_contains($lowerMessage, 'track') || str_contains($lowerMessage, 'nasaan') || str_contains($lowerMessage, 'status')) {
                    $aiReply = $isTagalog ? "Matutulungan kita sa iyong order. Pakibigay lamang ang iyong order number." : "I can help with your order status. Please provide your order number.";
                } elseif (str_contains($lowerMessage, 'cake') || str_contains($lowerMessage, 'meal') || str_contains($lowerMessage, 'food') || str_contains($lowerMessage, 'masarap') || str_contains($lowerMessage, 'recommend') || str_contains($lowerMessage, 'affordable') || str_contains($lowerMessage, 'mura')) {
                    $aiReply = $isTagalog ? "Marami kaming masasarap at affordable na mga cakes at meals! Dapat mong subukan ang aming Chocolate Dream Cake." : "We have many delicious and affordable cakes and meals! You should definitely try our Chocolate Dream Cake.";
                } elseif (str_contains($lowerMessage, 'wala') || str_contains($lowerMessage, 'ala') || str_contains($lowerMessage, 'none')) {
                    $aiReply = $isTagalog ? "Sige po, salamat!" : "Alright, thank you!";
                }
            }

            if ($aiReply) {
                $aiStmt = $conn->prepare("INSERT INTO messages (order_id, user_id, sender, message, conversation_id, created_at) VALUES (?, ?, 'ai', ?, ?, NOW())");
                if ($aiStmt) {
                    $aiStmt->bind_param("iiss", $orderId, $userId, $aiReply, $conversationId);
                    $aiStmt->execute();
                    $aiStmt->close();
                }
            }
        }

        echo json_encode([
            "success" => true,
            "message" => "Sent",
            "ai_reply" => $aiReply,
            "order_id" => $orderId
        ]);
    } else {
        echo json_encode(["success" => false, "message" => "Execute error: " . $stmt->error]);
    }
} else {
    echo json_encode(["success" => false, "message" => "DB Prepare Error: " . $conn->error]);
}

$conn->close();
