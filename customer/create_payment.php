<?php
require_once __DIR__ . '/cors.php';

// Debug logging
$debugLog = __DIR__ . '/debug_create_payment.log';
$entry = date('c') . " | METHOD=" . ($_SERVER['REQUEST_METHOD'] ?? '') . " | ORIGIN=" . ($origin ?? '') . "\n";
$entry .= "Headers: " . json_encode(getallheaders()) . "\n";
$entry .= "Cookies: " . json_encode($_COOKIE) . "\n";
file_put_contents($debugLog, $entry, FILE_APPEND);

// ─── PREFLIGHT ────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── SECRET KEY ───────────────────────────────────────────────────────────────
// The PayMongo secret can be provided via environment, server variables, or a local .env file.
function loadSecretKey($key) {
    $value = getenv($key);
    if ($value !== false && $value !== "") {
        return $value;
    }
    if (!empty($_SERVER[$key])) {
        return $_SERVER[$key];
    }
    if (!empty($_ENV[$key])) {
        return $_ENV[$key];
    }

    $envFiles = [
        __DIR__ . '/.env',
        __DIR__ . '/../.env',
    ];

    foreach ($envFiles as $envFile) {
        if (!file_exists($envFile) || !is_readable($envFile)) {
            continue;
        }
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (strpos(trim($line), '#') === 0) {
                continue;
            }
            [$envKey, $envValue] = array_map('trim', explode('=', $line, 2) + [null, null]);
            if ($envKey === $key && $envValue !== null) {
                return trim($envValue, " \t\r\n\"'");
            }
        }
    }

    return null;
}

$secretKey = loadSecretKey('PAYMONGO_SECRET');

if (!$secretKey) {
    http_response_code(500);
    echo json_encode(["error" => "Payment gateway secret is not configured. Please set PAYMONGO_SECRET in the server environment or a .env file."]);
    exit;
}

// ─── PARSE INPUT ──────────────────────────────────────────────────────────────
$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON payload"]);
    exit;
}

$orderId = isset($data['order_id']) ? trim($data['order_id']) : null;
$amount  = isset($data['amount'])   ? floatval($data['amount'])  : 0;
$paymentMethod = isset($data['payment_method']) ? trim($data['payment_method']) : 'card';

if (!$orderId || $amount <= 0) {
    http_response_code(400);
    echo json_encode(["error" => "Missing order_id or invalid amount"]);
    exit;
}

// ─── AMOUNT VALIDATION ────────────────────────────────────────────────────────
// FIX: PayMongo minimum is ₱20.00 (2000 centavos); reject anything below.
$amountCents = (int) round($amount * 100);

if ($amountCents < 2000) {
    http_response_code(400);
    echo json_encode(["error" => "Amount must be at least ₱20.00"]);
    exit;
}

// ─── BUILD PAYMONGO PAYLOAD ───────────────────────────────────────────────────
// Map our payment methods to PayMongo's source types
$sourceTypeMap = [
    'GCash'    => 'gcash',
    'PayMaya'  => 'paymaya',
    'COD'      => 'card',  // Default to card for COD (won't be used)
    'Credit Card' => 'card'
];

$sourceType = $sourceTypeMap[$paymentMethod] ?? 'card';

$payload = [
    "data" => [
        "attributes" => [
            "amount"      => $amountCents,
            "currency"    => "PHP",
            "description" => "Pastry Order #" . $orderId,
            "remarks"     => "Pastry Shop Order",
            "source" => [
                "type" => $sourceType
            ]
        ]
    ]
];

// ─── CALL PAYMONGO API ────────────────────────────────────────────────────────
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL,            "https://api.paymongo.com/v1/links");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST,           true);
curl_setopt($ch, CURLOPT_TIMEOUT,        15); // FIX: add timeout so it doesn't hang forever
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "accept: application/json",
    "content-type: application/json",
    "authorization: Basic " . base64_encode($secretKey . ":")
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

$response = curl_exec($ch);
$curlErr  = curl_error($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// ─── CURL ERROR ───────────────────────────────────────────────────────────────
if ($response === false) {
    @file_put_contents(
        __DIR__ . '/paymongo_errors.log',
        date('c') . " - curl error: " . $curlErr . "\n",
        FILE_APPEND
    );
    http_response_code(500);
    echo json_encode(["error" => "Could not reach payment gateway. Please try again."]);
    exit;
}

// ─── PARSE PAYMONGO RESPONSE ──────────────────────────────────────────────────
$decoded = json_decode($response, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    @file_put_contents(
        __DIR__ . '/paymongo_errors.log',
        date('c') . " - invalid json from paymongo: " . $response . "\n",
        FILE_APPEND
    );
    http_response_code(502);
    echo json_encode(["error" => "Invalid response from payment gateway."]);
    exit;
}

// ─── FIX: Explicitly forward the exact HTTP status from PayMongo ──────────────
// Previously: only returned 200 for 2xx, but forwarded other codes as-is.
// Now: we explicitly set the status and always return the decoded body.
// This ensures the frontend can catch 422/4xx errors from PayMongo properly.
if ($httpCode >= 200 && $httpCode < 300) {
    http_response_code(200);
} else {
    // Log non-2xx responses from PayMongo for debugging
    @file_put_contents(
        __DIR__ . '/paymongo_errors.log',
        date('c') . " - paymongo error ($httpCode): " . $response . "\n",
        FILE_APPEND
    );
    http_response_code($httpCode);
}

echo json_encode($decoded);