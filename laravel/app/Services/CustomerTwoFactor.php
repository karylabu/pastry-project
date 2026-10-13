<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CustomerTwoFactor
{
    private const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public function isEnabled(int $userId): bool
    {
        if (!Schema::hasTable('customer_two_factor')) {
            throw new \RuntimeException('Customer two-factor storage is unavailable.');
        }

        if (!DB::table('customer_two_factor')->where('user_id', $userId)->exists()) {
            return false;
        }

        return DB::table('customer_two_factor')
            ->where('user_id', $userId)
            ->whereNotNull('enabled_at')
            ->whereNotNull('secret')
            ->exists();
    }

    public function createLoginChallenge(int $userId): string
    {
        $token = bin2hex(random_bytes(32));

        DB::table('customer_two_factor_login_challenges')->insert([
            'user_id' => $userId,
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addMinutes(5),
            'created_at' => now(),
        ]);

        return $token;
    }

    public function generateSecret(): string
    {
        $bytes = random_bytes(20);
        $buffer = 0;
        $bits = 0;
        $encoded = '';

        foreach (str_split($bytes) as $byte) {
            $buffer = ($buffer << 8) | ord($byte);
            $bits += 8;

            while ($bits >= 5) {
                $bits -= 5;
                $encoded .= self::BASE32_ALPHABET[($buffer >> $bits) & 31];
                $buffer &= (1 << $bits) - 1;
            }
        }

        if ($bits > 0) {
            $encoded .= self::BASE32_ALPHABET[($buffer << (5 - $bits)) & 31];
        }

        return $encoded;
    }

    public function encryptSecret(string $secret): string
    {
        return Crypt::encryptString($secret);
    }

    public function decryptSecret(string $encryptedSecret): string
    {
        return Crypt::decryptString($encryptedSecret);
    }

    public function provisioningUri(string $secret, string $email): string
    {
        $issuer = 'Pastry Project';
        $label = rawurlencode($issuer . ':' . $email);

        return 'otpauth://totp/' . $label . '?secret=' . $secret
            . '&issuer=' . rawurlencode($issuer) . '&algorithm=SHA1&digits=6&period=30';
    }

    public function matchingCounter(string $secret, string $code, ?int $lastCounter = null): ?int
    {
        if (!preg_match('/^\d{6}$/', $code)) {
            return null;
        }

        $currentCounter = intdiv(time(), 30);
        for ($counter = max(0, $currentCounter - 1); $counter <= $currentCounter + 1; $counter++) {
            if ($lastCounter !== null && $counter <= $lastCounter) {
                continue;
            }

            if (hash_equals($this->totpCode($secret, $counter), $code)) {
                return $counter;
            }
        }

        return null;
    }

    public function generateRecoveryCodes(int $count = 10): array
    {
        $codes = [];
        for ($index = 0; $index < $count; $index++) {
            $value = strtoupper(bin2hex(random_bytes(5)));
            $codes[] = implode('-', str_split($value, 5));
        }

        return $codes;
    }

    public function normalizeRecoveryCode(string $code): string
    {
        return strtoupper((string) preg_replace('/[^a-zA-Z0-9]/', '', $code));
    }

    private function totpCode(string $secret, int $counter): string
    {
        $key = $this->decodeBase32($secret);
        $counterBytes = pack('N2', ($counter >> 32) & 0xffffffff, $counter & 0xffffffff);
        $hash = hash_hmac('sha1', $counterBytes, $key, true);
        $offset = ord($hash[strlen($hash) - 1]) & 0x0f;
        $binary = (
            ((ord($hash[$offset]) & 0x7f) << 24)
            | ((ord($hash[$offset + 1]) & 0xff) << 16)
            | ((ord($hash[$offset + 2]) & 0xff) << 8)
            | (ord($hash[$offset + 3]) & 0xff)
        );

        return str_pad((string) ($binary % 1000000), 6, '0', STR_PAD_LEFT);
    }

    private function decodeBase32(string $encoded): string
    {
        $buffer = 0;
        $bits = 0;
        $decoded = '';

        foreach (str_split(strtoupper(rtrim($encoded, '='))) as $character) {
            $value = strpos(self::BASE32_ALPHABET, $character);
            if ($value === false) {
                throw new \InvalidArgumentException('Invalid authenticator secret.');
            }

            $buffer = ($buffer << 5) | $value;
            $bits += 5;

            if ($bits >= 8) {
                $bits -= 8;
                $decoded .= chr(($buffer >> $bits) & 0xff);
                $buffer &= (1 << $bits) - 1;
            }
        }

        return $decoded;
    }
}
