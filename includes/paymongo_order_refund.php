<?php

function requestPayMongoOrderRefund(array $orderRow, int $orderId, string $reason = 'requested_by_customer'): array
{
    $paymentStatus = strtolower(trim((string) ($orderRow['payment_status'] ?? '')));
    if (!in_array($paymentStatus, ['paid', 'downpayment_paid'], true)) {
        return ['status' => null, 'reference' => null, 'amount' => null];
    }

    $amount = (float) ($orderRow['total'] ?? 0);
    $downpaymentAmount = (float) ($orderRow['downpayment_amount'] ?? 0);
    if (
        $downpaymentAmount > 0
        && (
            $paymentStatus === 'downpayment_paid'
            || (int) ($orderRow['is_customized'] ?? 0) === 1
            || strcasecmp((string) ($orderRow['order_type'] ?? ''), 'Customized') === 0
        )
    ) {
        $amount = $downpaymentAmount;
    }

    $paymentMethod = strtolower((string) preg_replace('/[^a-z0-9]/i', '', (string) ($orderRow['payment'] ?? '')));
    $paymentReference = trim((string) ($orderRow['payment_reference'] ?? ''));
    if (!in_array($paymentMethod, ['gcash', 'qrph'], true) || $paymentReference === '') {
        return ['status' => 'manual_required', 'reference' => null, 'amount' => $amount];
    }

    $secret = getenv('PAYMONGO_SECRET') ?: ($_SERVER['PAYMONGO_SECRET'] ?? '') ?: ($_ENV['PAYMONGO_SECRET'] ?? '');
    if ($secret === '') {
        foreach ([__DIR__ . '/../customer/.env', __DIR__ . '/../.env', __DIR__ . '/../laravel/.env'] as $envFile) {
            if (!is_readable($envFile)) {
                continue;
            }
            foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#') {
                    continue;
                }
                [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
                if (trim($key) === 'PAYMONGO_SECRET') {
                    $secret = trim($value, " \t\r\n\"'");
                    break 2;
                }
            }
        }
    }
    if ($secret === '' || !function_exists('curl_init')) {
        throw new RuntimeException('PayMongo refund service is unavailable.');
    }

    $paymentsRequest = curl_init('https://api.paymongo.com/v1/payment_links/' . rawurlencode($paymentReference) . '/payments');
    curl_setopt_array($paymentsRequest, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_USERPWD => $secret . ':',
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_TIMEOUT => 15,
    ]);
    $paymentsBody = curl_exec($paymentsRequest);
    $paymentsHttpStatus = (int) curl_getinfo($paymentsRequest, CURLINFO_HTTP_CODE);
    $paymentsError = curl_error($paymentsRequest);
    curl_close($paymentsRequest);
    $paymentsData = is_string($paymentsBody) ? json_decode($paymentsBody, true) : null;
    if ($paymentsBody === false || $paymentsHttpStatus < 200 || $paymentsHttpStatus >= 300 || !is_array($paymentsData['data'] ?? null)) {
        error_log("PayMongo payment lookup failed for cancellation of order #{$orderId}: {$paymentsHttpStatus} {$paymentsError}");
        throw new RuntimeException('Unable to verify the PayMongo payment for refund.');
    }

    $paymentId = '';
    $refundAmount = 0;
    foreach ($paymentsData['data'] as $payment) {
        $attributes = $payment['attributes'] ?? $payment;
        if (in_array(strtolower((string) ($attributes['status'] ?? '')), ['paid', 'succeeded'], true)) {
            $paymentId = (string) ($payment['id'] ?? '');
            $refundAmount = (int) ($attributes['amount'] ?? 0);
            break;
        }
    }
    if ($paymentId === '' || $refundAmount < 100) {
        throw new RuntimeException('No refundable completed PayMongo payment was found.');
    }

    $refundRequest = curl_init('https://api.paymongo.com/v1/refunds');
    curl_setopt_array($refundRequest, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'data' => [
                'attributes' => [
                    'amount' => $refundAmount,
                    'payment_id' => $paymentId,
                    'reason' => $reason,
                    'notes' => "Order #{$orderId} cancelled",
                ],
            ],
        ]),
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_USERPWD => $secret . ':',
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/json'],
        CURLOPT_TIMEOUT => 15,
    ]);
    $refundBody = curl_exec($refundRequest);
    $refundHttpStatus = (int) curl_getinfo($refundRequest, CURLINFO_HTTP_CODE);
    $refundError = curl_error($refundRequest);
    curl_close($refundRequest);
    $refundData = is_string($refundBody) ? json_decode($refundBody, true) : null;
    if ($refundBody === false || $refundHttpStatus < 200 || $refundHttpStatus >= 300) {
        error_log("PayMongo refund failed for cancellation of order #{$orderId}: {$refundHttpStatus} {$refundError}");
        throw new RuntimeException('PayMongo did not accept the refund request.');
    }

    $refundReference = (string) ($refundData['data']['id'] ?? '');
    $refundStatus = strtolower((string) ($refundData['data']['attributes']['status'] ?? 'pending'));
    if ($refundReference === '' || !in_array($refundStatus, ['pending', 'succeeded', 'refunded'], true)) {
        throw new RuntimeException('PayMongo returned an invalid refund response.');
    }

    return [
        'status' => $refundStatus,
        'reference' => $refundReference,
        'amount' => $refundAmount / 100,
    ];
}

function sendPayMongoOrderRefundSms(?string $phone, int $orderId, array $refundResult): bool
{
    $status = strtolower((string) ($refundResult['status'] ?? ''));
    if ($status === '') {
        return true;
    }

    if (empty($phone)) {
        error_log("Refund SMS was not sent for order #{$orderId}: customer phone number is missing.");
        return false;
    }

    $phone = preg_replace('/\D/', '', $phone);
    if (substr($phone, 0, 2) === '63') {
        $phone = substr($phone, 2);
    } elseif (substr($phone, 0, 1) === '0') {
        $phone = substr($phone, 1);
    }
    if (strlen($phone) !== 10 || !function_exists('curl_init')) {
        error_log("Refund SMS was not sent for order #{$orderId}: invalid phone number or cURL is unavailable.");
        return false;
    }
    $phone = '63' . $phone;

    $messages = [
        'pending' => "Order #{$orderId} cancelled. Your refund request is being processed by PayMongo.",
        'succeeded' => "Order #{$orderId} cancelled. PayMongo confirmed your refund was returned.",
        'refunded' => "Order #{$orderId} cancelled. PayMongo confirmed your refund was returned.",
        'manual_required' => "Order #{$orderId} cancelled. Your refund is not yet returned; the shop has been asked to process it manually.",
    ];
    if (!isset($messages[$status])) {
        error_log("Refund SMS was not sent for order #{$orderId}: unrecognized refund status '{$status}'.");
        return false;
    }

    $apiToken = getenv('IPROGSMS_API_TOKEN') ?: ($_SERVER['IPROGSMS_API_TOKEN'] ?? '') ?: ($_ENV['IPROGSMS_API_TOKEN'] ?? '');
    if ($apiToken === '') {
        foreach ([__DIR__ . '/../customer/.env', __DIR__ . '/../.env', __DIR__ . '/../laravel/.env'] as $envFile) {
            if (!is_readable($envFile)) {
                continue;
            }
            foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#') {
                    continue;
                }
                [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
                if (trim($key) === 'IPROGSMS_API_TOKEN') {
                    $apiToken = trim($value, " \t\r\n\"'");
                    break 2;
                }
            }
        }
    }
    if ($apiToken === '') {
        error_log("Refund SMS was not sent for order #{$orderId}: iProgSMS token is not configured.");
        return false;
    }

    $request = curl_init('https://www.iprogsms.com/api/v1/sms_messages');
    curl_setopt_array($request, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'api_token' => $apiToken,
            'phone_number' => $phone,
            'message' => $messages[$status],
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 15,
    ]);
    $responseBody = curl_exec($request);
    $httpStatus = (int) curl_getinfo($request, CURLINFO_HTTP_CODE);
    $error = curl_error($request);
    curl_close($request);

    if ($responseBody === false || $httpStatus < 200 || $httpStatus >= 300) {
        error_log("Refund SMS failed for order #{$orderId}: HTTP {$httpStatus} {$error}");
        return false;
    }

    return true;
}
