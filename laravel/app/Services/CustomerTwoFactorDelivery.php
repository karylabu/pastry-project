<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use RuntimeException;

class CustomerTwoFactorDelivery
{
    public function isConfigured(string $method): bool
    {
        if ($method === 'authenticator') {
            return true;
        }

        if ($method === 'email') {
            return in_array(config('mail.default'), ['smtp', 'ses', 'ses-v2', 'postmark', 'mailgun', 'resend', 'sendmail'], true);
        }

        return $method === 'sms' && is_string(config('services.iprogsms.api_token'))
            && trim(config('services.iprogsms.api_token')) !== '';
    }

    public function destination(string $method, string $email, ?string $phone): string
    {
        if ($method === 'email') {
            return $this->maskEmail($email);
        }

        if ($method === 'sms') {
            $digits = preg_replace('/\D+/', '', (string) $phone);
            return $digits === '' ? '' : '••••' . substr($digits, -4);
        }

        return '';
    }

    public function send(string $method, string $email, ?string $phone, string $code, string $purpose): void
    {
        if (!$this->isConfigured($method)) {
            throw new RuntimeException($method === 'sms'
                ? 'SMS verification is not configured. Please contact support or choose another method.'
                : 'Email verification is not configured. Please contact support or choose another method.');
        }

        if ($method === 'email') {
            $expiresIn = $purpose === 'sign-in' ? 5 : 10;
            Mail::html(
                '<p>Your Pastry Project verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">'
                    . e($code)
                    . '</p><p>This code expires in ' . $expiresIn . ' minutes. If you did not request it, you can ignore this email.</p>',
                function ($message) use ($email, $purpose) {
                    $message->to($email)->subject('Pastry Project ' . $purpose . ' code');
                }
            );

            return;
        }

        $phoneNumber = preg_replace('/\D+/', '', (string) $phone);
        if (str_starts_with($phoneNumber, '0')) {
            $phoneNumber = '63' . substr($phoneNumber, 1);
        } elseif (!str_starts_with($phoneNumber, '63')) {
            $phoneNumber = '63' . $phoneNumber;
        }

        $response = Http::asJson()
            ->timeout(15)
            ->post('https://www.iprogsms.com/api/v1/sms_messages', [
                'api_token' => config('services.iprogsms.api_token'),
                'phone_number' => $phoneNumber,
                'message' => 'Pastry Project: Your ' . strtolower($purpose) . ' code is ' . $code
                    . '. It expires in ' . ($purpose === 'sign-in' ? 5 : 10) . ' minutes.',
            ]);

        if (!$response->successful()) {
            throw new RuntimeException('The SMS provider could not deliver the verification code.');
        }
    }

    private function maskEmail(string $email): string
    {
        [$name, $domain] = array_pad(explode('@', $email, 2), 2, '');
        if ($name === '' || $domain === '') {
            return '';
        }

        return substr($name, 0, 1) . str_repeat('*', max(2, strlen($name) - 1)) . '@' . $domain;
    }
}
