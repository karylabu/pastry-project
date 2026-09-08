<?php
require_once __DIR__ . '/cors.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

function loadWebhookSecret() {
    $value = getenv('PAYMONGO_WEBHOOK_SECRET') ?: ($_SERVER['PAYMONGO_WEBHOOK_SECRET'] ?? '') ?: ($_ENV['PAYMONGO_WEBHOOK_SECRET'] ?? '');
    if ($value !== '') {
        return $value;
    }

    foreach ([__DIR__ . '/.env', __DIR__ . '/../.env'] as $envFile) {
        if (!is_readable($envFile)) {
            continue;
        }
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }
            [$key, $envValue] = array_pad(explode('=', $line, 2), 2, '');
            if (trim($key) === 'PAYMONGO_WEBHOOK_SECRET') {
                return trim($envValue, " \t\r\n\"'");
            }
        }
    }

    return '';
}

$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_PAYMONGO_SIGNATURE'] ?? '';
$webhookSecret = loadWebhookSecret();

if ($webhookSecret === '') {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'PAYMONGO_WEBHOOK_SECRET is not configured.']);
    exit;
}

$parts = [];
foreach (explode(',', $signature) as $part) {
    [$key, $value] = array_pad(explode('=', $part, 2), 2, '');
    $parts[trim($key)] = trim($value);
}
$timestamp = $parts['t'] ?? '';
$providedSignature = $parts['li'] ?? ($parts['te'] ?? '');
$expectedSignature = hash_hmac('sha256', $timestamp . '.' . $payload, $webhookSecret);

if ($timestamp === '' || $providedSignature === '' || !hash_equals($expectedSignature, $providedSignature)) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Invalid webhook signature.']);
    exit;
}

$data = json_decode($payload, true);
$eventType = strtolower((string)($data['data']['attributes']['type'] ?? $data['type'] ?? ''));
$successfulEvents = ['link.payment.paid', 'payment.paid'];
if (!in_array($eventType, $successfulEvents, true)) {
    echo json_encode(['status' => 'ignored']);
    exit;
}

$orderId = 0;
$json = json_encode($data);
if ($json && preg_match('/Pastry Order #(\d+)/i', $json, $matches)) {
    $orderId = (int) $matches[1];
}

if ($orderId <= 0) {
    echo json_encode(['status' => 'ignored', 'message' => 'Order reference not found.']);
    exit;
}

$conn = @mysqli_connect('localhost', 'root', '', 'pastry_db');
if (!$conn) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed.']);
    exit;
}

$stmt = $conn->prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ? AND LOWER(payment) = 'gcash'");
$stmt->bind_param('i', $orderId);
$stmt->execute();
$stmt->close();
$conn->close();

echo json_encode(['status' => 'success', 'order_id' => $orderId]);
