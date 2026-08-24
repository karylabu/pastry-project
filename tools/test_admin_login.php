<?php
$url = 'http://127.0.0.1/GitHub/Capstone--Development%20-%20Copy/admin/api/api_login.php';
$data = ['email' => 'admin@pastry.com', 'password' => 'password'];
$options = [
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($data),
    CURLOPT_TIMEOUT => 10,
];
$ch = curl_init();
curl_setopt_array($ch, $options);
$res = curl_exec($ch);
$err = curl_error($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($err) {
    echo "CURL_ERROR: $err\n";
} else {
    echo $res . "\nHTTP_CODE:$code\n";
}
?>