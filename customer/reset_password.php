<?php

http_response_code(410);
header('Content-Type: application/json');
echo json_encode([
    'success' => false,
    'message' => 'This temporary password reset endpoint has been disabled. Use the secure password reset flow.',
]);
exit;
