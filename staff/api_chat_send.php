<?php
ini_set('display_errors', 0);
error_reporting(0);
while (ob_get_level()) ob_end_clean();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../includes/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['success' => true]);
    exit();
}

if (!$conn) {
    echo json_encode(['success' => false, 'message' => 'DB error']);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);
$orderId = intval($data['order_id'] ?? 0);
$message = trim($data['message'] ?? '');
$sender = $data['sender'] ?? 'admin';
$imagePath = null;

if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
    if ($_FILES['image']['size'] > 5 * 1024 * 1024) {
        echo json_encode(['success' => false, 'message' => 'Image must be 5MB or smaller']);
        exit();
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($_FILES['image']['tmp_name']);
    $extensions = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
    ];
    if (!isset($extensions[$mime])) {
        echo json_encode(['success' => false, 'message' => 'Only JPG, PNG, GIF, and WEBP images are allowed']);
        exit();
    }

    $uploadDir = __DIR__ . '/../customer/uploads/chat';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
    if (!move_uploaded_file($_FILES['image']['tmp_name'], $uploadDir . '/' . $filename)) {
        echo json_encode(['success' => false, 'message' => 'Could not save image']);
        exit();
    }
    $imagePath = 'uploads/chat/' . $filename;
}

if ($orderId <= 0 || ($message === '' && $imagePath === null)) {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit();
}

if (!in_array($sender, ['admin', 'staff', 'customer'], true)) {
    $sender = 'admin';
}

if ($sender === 'staff' || $sender === 'customer') {
    $sender = 'admin';
}

$columnCheck = $conn->query("SHOW COLUMNS FROM messages LIKE 'sender'");
if ($columnCheck && $columnCheck->num_rows > 0) {
    $column = $columnCheck->fetch_assoc();
    if ($column && strpos($column['Type'], 'admin') === false) {
        $conn->query("ALTER TABLE messages MODIFY sender ENUM('customer','staff','ai','admin') NOT NULL");
    }
}

$stmt = $conn->prepare('INSERT INTO messages (order_id, sender, message, image_path, is_read, created_at) VALUES (?, ?, ?, ?, 1, NOW())');
$stmt->bind_param('isss', $orderId, $sender, $message, $imagePath);
$stmt->execute();
$stmt->close();

$conn->close();

echo json_encode(['success' => true, 'message' => 'Saved']);
exit();
