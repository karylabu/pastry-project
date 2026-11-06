<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Throwable;

class RegistrationPhoneVerification
{
    public function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if (strlen($digits) === 12 && str_starts_with($digits, '63')) {
            return '0' . substr($digits, 2);
        }

        if (strlen($digits) === 10 && str_starts_with($digits, '9')) {
            return '0' . $digits;
        }

        return $digits;
    }

    public function sendCode(string $phone, CustomerTwoFactorDelivery $delivery): string
    {
        $normalizedPhone = $this->normalizePhone($phone);
        $rateLimitKey = 'customer-registration-phone-otp:' . hash('sha256', $normalizedPhone);

        if (RateLimiter::tooManyAttempts($rateLimitKey, 1)) {
            throw new RuntimeException('Please wait before requesting another verification code.');
        }

        RateLimiter::hit($rateLimitKey, 60);

        $verificationId = bin2hex(random_bytes(32));
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        DB::table('customer_registration_phone_verifications')
            ->where('phone_normalized', $normalizedPhone)
            ->whereNull('consumed_at')
            ->delete();
        DB::table('customer_registration_phone_verifications')->insert([
            'id' => $verificationId,
            'phone' => $phone,
            'phone_normalized' => $normalizedPhone,
            'code_hash' => Hash::make($code),
            'attempts' => 0,
            'expires_at' => now()->addMinutes(10),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            $delivery->send('sms', '', $phone, $code, 'registration');
        } catch (Throwable $exception) {
            DB::table('customer_registration_phone_verifications')
                ->where('id', $verificationId)
                ->delete();

            throw new RuntimeException(
                'The verification code could not be sent. Please try again later.',
                0,
                $exception
            );
        }

        return $verificationId;
    }

    public function verifyCode(string $verificationId, string $phone, string $code): bool
    {
        $normalizedPhone = $this->normalizePhone($phone);

        return DB::transaction(function () use ($verificationId, $normalizedPhone, $code) {
            $challenge = DB::table('customer_registration_phone_verifications')
                ->where('id', $verificationId)
                ->where('phone_normalized', $normalizedPhone)
                ->lockForUpdate()
                ->first();

            if (
                ! $challenge
                || $challenge->consumed_at !== null
                || now()->greaterThanOrEqualTo($challenge->expires_at)
                || (int) $challenge->attempts >= 5
                || $challenge->verified_at !== null
            ) {
                return false;
            }

            if (! Hash::check($code, $challenge->code_hash)) {
                DB::table('customer_registration_phone_verifications')
                    ->where('id', $verificationId)
                    ->increment('attempts', 1, ['updated_at' => now()]);

                return false;
            }

            DB::table('customer_registration_phone_verifications')
                ->where('id', $verificationId)
                ->update(['verified_at' => now(), 'updated_at' => now()]);

            return true;
        });
    }

    public function isVerified(string $verificationId, string $phone): bool
    {
        $challenge = DB::table('customer_registration_phone_verifications')
            ->where('id', $verificationId)
            ->where('phone_normalized', $this->normalizePhone($phone))
            ->whereNotNull('verified_at')
            ->whereNull('consumed_at')
            ->first();

        return $challenge !== null && now()->lessThan($challenge->expires_at);
    }

    public function consumeVerified(string $verificationId, string $phone): bool
    {
        return DB::table('customer_registration_phone_verifications')
            ->where('id', $verificationId)
            ->where('phone_normalized', $this->normalizePhone($phone))
            ->whereNotNull('verified_at')
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->update(['consumed_at' => now(), 'updated_at' => now()]) === 1;
    }

    public function isPhoneRegistered(string $phone): bool
    {
        $normalizedPhone = $this->normalizePhone($phone);
        $columns = array_filter(['phone', 'phone_number'], fn ($column) => Schema::hasColumn('users', $column));

        foreach ($columns as $column) {
            $users = DB::table('users')->whereNotNull($column);
            if (Schema::hasColumn('users', 'deleted_at')) {
                $users->whereNull('deleted_at');
            }

            $registeredPhones = $users->pluck($column);
            if ($registeredPhones->contains(fn ($savedPhone) => $this->normalizePhone((string) $savedPhone) === $normalizedPhone)) {
                return true;
            }
        }

        return false;
    }

}
