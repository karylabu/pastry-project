<?php
$url = 'http://127.0.0.1/GitHub/Capstone--Development%20-%20Copy/laravel/public/api/admin/promotions/send';
$data = json_encode([
    'user_id' => 1,
    'title' => 'Test Promo',
    'message' => 'Test message',
    'starts_at' => '2026-07-20T00:00:00Z',
    'ends_at' => '2026-07-27T00:00:00Z',
]);
$opts = [
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => $data,
        'ignore_errors' => true,
    ],
];
$context = stream_context_create($opts);
$response = file_get_contents($url, false, $context);
echo "Status Headers:\n";
if (isset($http_response_header) && is_array($http_response_header)) {
    foreach ($http_response_header as $header) {
        echo "$header\n";
    }
} else {
    echo "(no response headers available)\n";
}
echo "\nResponse Body:\n";
echo $response;
