<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use RuntimeException;
use Throwable;

class RegistrationEmailVerification
{
    public function normalizeEmail(string $email): string
    {
        return strtolower(trim($email));
    }

    public function sendCode(string $email, CustomerTwoFactorDelivery $delivery): string
    {
        $normalizedEmail = $this->normalizeEmail($email);
        $rateLimitKey = 'customer-registration-email-otp:' . hash('sha256', $normalizedEmail);
        if (RateLimiter::tooManyAttempts($rateLimitKey, 1)) {
            throw new RuntimeException('Please wait before requesting another verification code.');
        }
        RateLimiter::hit($rateLimitKey, 60);

        $verificationId = bin2hex(random_bytes(32));
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        DB::table('customer_registration_email_verifications')
            ->where('email_normalized', $normalizedEmail)
            ->whereNull('consumed_at')
            ->delete();
        DB::table('customer_registration_email_verifications')->insert([
            'id' => $verificationId,
            'email' => $email,
            'email_normalized' => $normalizedEmail,
            'code_hash' => Hash::make($code),
            'attempts' => 0,
            'expires_at' => now()->addMinutes(10),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            $delivery->send('email', $email, null, $code, 'registration');
        } catch (Throwable $exception) {
            DB::table('customer_registration_email_verifications')->where('id', $verificationId)->delete();
            throw new RuntimeException('The verification code could not be sent. Please try again later.', 0, $exception);
        }

        return $verificationId;
    }

    public function verifyCode(string $verificationId, string $email, string $code): bool
    {
        $normalizedEmail = $this->normalizeEmail($email);

        return DB::transaction(function () use ($verificationId, $normalizedEmail, $code) {
            $challenge = DB::table('customer_registration_email_verifications')
                ->where('id', $verificationId)
                ->where('email_normalized', $normalizedEmail)
                ->lockForUpdate()
                ->first();

            if (
                !$challenge
                || $challenge->consumed_at !== null
                || now()->greaterThanOrEqualTo($challenge->expires_at)
                || (int) $challenge->attempts >= 5
                || $challenge->verified_at !== null
            ) {
                return false;
            }

            if (!Hash::check($code, $challenge->code_hash)) {
                DB::table('customer_registration_email_verifications')
                    ->where('id', $verificationId)
                    ->increment('attempts', 1, ['updated_at' => now()]);

                return false;
            }

            DB::table('customer_registration_email_verifications')
                ->where('id', $verificationId)
                ->update(['verified_at' => now(), 'updated_at' => now()]);

            return true;
        });
    }

    public function isVerified(string $verificationId, string $email): bool
    {
        $challenge = DB::table('customer_registration_email_verifications')
            ->where('id', $verificationId)
            ->where('email_normalized', $this->normalizeEmail($email))
            ->whereNotNull('verified_at')
            ->whereNull('consumed_at')
            ->first();

        return $challenge !== null && now()->lessThan($challenge->expires_at);
    }

    public function consumeVerified(string $verificationId, string $email): bool
    {
        return DB::table('customer_registration_email_verifications')
            ->where('id', $verificationId)
            ->where('email_normalized', $this->normalizeEmail($email))
            ->whereNotNull('verified_at')
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->update(['consumed_at' => now(), 'updated_at' => now()]) === 1;
    }
}
