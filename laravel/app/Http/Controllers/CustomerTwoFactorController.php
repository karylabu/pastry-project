<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\CustomerTwoFactor;
use App\Services\CustomerTwoFactorDelivery;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class CustomerTwoFactorController extends Controller
{
    public function status(Request $request)
    {
        $user = $this->customer($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $factor = DB::table('customer_two_factor')->where('user_id', $user->id)->first();

        return response()->json([
            'success' => true,
            'enabled' => $factor && $factor->enabled_at !== null
                && ($factor->secret !== null || in_array($factor->method ?? '', ['email', 'sms'], true)),
            'method' => $factor->method ?? 'authenticator',
            'recovery_codes_remaining' => DB::table('customer_two_factor_recovery_codes')
                ->where('user_id', $user->id)
                ->count(),
        ]);
    }

    public function setup(Request $request, CustomerTwoFactor $twoFactor, CustomerTwoFactorDelivery $delivery)
    {
        $user = $this->customer($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }
        if ($twoFactor->isEnabled((int) $user->id)) {
            return response()->json(['success' => false, 'message' => 'Two-factor authentication is already enabled.'], 409);
        }

        $method = (string) $request->input('method', 'authenticator');
        if ($method !== 'authenticator') {
            return response()->json(['success' => false, 'message' => 'Choose a valid verification method.'], 422);
        }
        if (!$delivery->isConfigured($method)) {
            return response()->json([
                'success' => false,
                'message' => $method === 'sms'
                    ? 'SMS verification is not configured. Please contact support or choose another method.'
                    : 'Email verification is not configured. Please contact support or choose another method.',
            ], 503);
        }

        if ($method === 'sms' && trim((string) ($user->phone ?? $user->phone_number ?? '')) === '') {
            return response()->json(['success' => false, 'message' => 'Add a phone number to your profile before choosing SMS verification.'], 422);
        }

        $secret = $method === 'authenticator' ? $twoFactor->generateSecret() : null;
        $pendingCode = $method === 'authenticator' ? null : $twoFactor->generateCode();
        DB::table('customer_two_factor')->updateOrInsert(
            ['user_id' => $user->id],
            [
                'pending_secret' => $secret === null ? null : $twoFactor->encryptSecret($secret),
                'pending_expires_at' => now()->addMinutes(10),
                'pending_method' => $method,
                'pending_code_hash' => $pendingCode === null ? null : Hash::make($pendingCode),
                'secret' => null,
                'enabled_at' => null,
                'last_counter' => null,
                'method' => $method,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        if ($pendingCode !== null) {
            try {
                $twoFactor->sendOtp($user, $method, $pendingCode, 'setup', $delivery);
            } catch (\Throwable $exception) {
                DB::table('customer_two_factor')
                    ->where('user_id', $user->id)
                    ->update(['pending_code_hash' => null, 'pending_expires_at' => null]);
                Log::warning('Customer two-factor setup code delivery failed.', ['user_id' => $user->id]);

                return response()->json(['success' => false, 'message' => $exception->getMessage()], 503);
            }
        }

        return response()->json([
            'success' => true,
            'method' => $method,
            'secret' => $secret,
            'otpauth_url' => $secret === null ? null : $twoFactor->provisioningUri($secret, $user->email),
            'destination' => $pendingCode === null ? null : $twoFactor->maskDestination($method, $user, $delivery),
        ]);
    }

    public function enable(Request $request, CustomerTwoFactor $twoFactor)
    {
        $user = $this->customer($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $attemptKey = $this->rateLimitKey('two-factor-enable', (string) $user->id);
        if ($response = $this->rateLimitResponse($attemptKey, 5)) {
            return $response;
        }

        $code = trim((string) $request->input('code', ''));
        $recoveryCodes = $twoFactor->generateRecoveryCodes();
        $result = DB::transaction(function () use ($user, $code, $twoFactor, $recoveryCodes) {
            $factor = DB::table('customer_two_factor')
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();
            if (!$factor || !$factor->pending_expires_at
                || now()->greaterThan($factor->pending_expires_at)) {
                return 'expired';
            }

            $method = $factor->pending_method ?? 'authenticator';
            if (($method === 'authenticator' && !$factor->pending_secret)
                || ($method !== 'authenticator' && !$factor->pending_code_hash)) {
                return 'expired';
            }
            $secret = $factor->pending_secret ? $twoFactor->decryptSecret($factor->pending_secret) : null;
            $counter = $method === 'authenticator' && $secret !== null
                ? $twoFactor->matchingCounter($secret, $code)
                : null;
            $codeValid = $method === 'authenticator'
                ? $counter !== null
                : ($factor->pending_code_hash && Hash::check($code, $factor->pending_code_hash));
            if (!$codeValid) {
                return 'invalid_code';
            }

            DB::table('customer_two_factor')
                ->where('user_id', $user->id)
                ->update([
                    'secret' => $secret === null ? null : $twoFactor->encryptSecret($secret),
                    'pending_secret' => null,
                    'pending_expires_at' => null,
                    'pending_method' => null,
                    'pending_code_hash' => null,
                    'enabled_at' => now(),
                    'last_counter' => null,
                    'method' => $method,
                    'updated_at' => now(),
                ]);

            DB::table('customer_two_factor_recovery_codes')->where('user_id', $user->id)->delete();
            foreach ($recoveryCodes as $recoveryCode) {
                DB::table('customer_two_factor_recovery_codes')->insert([
                    'user_id' => $user->id,
                    'code_hash' => Hash::make($twoFactor->normalizeRecoveryCode($recoveryCode)),
                    'created_at' => now(),
                ]);
            }

            return 'enabled';
        });

        if ($result === 'expired') {
            return response()->json(['success' => false, 'message' => 'Authenticator setup expired. Start setup again.'], 422);
        }
        if ($result === 'invalid_code') {
            $this->recordRateLimitAttempt($attemptKey, 900);
            return response()->json(['success' => false, 'message' => 'That verification code is invalid or expired. Request a new code or try again.'], 422);
        }
        $this->clearRateLimit($attemptKey);

        return response()->json([
            'success' => true,
            'enabled' => true,
            'method' => DB::table('customer_two_factor')->where('user_id', $user->id)->value('method'),
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    public function sendDisableCode(Request $request, CustomerTwoFactor $twoFactor, CustomerTwoFactorDelivery $delivery)
    {
        $user = $this->customer($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $factor = DB::table('customer_two_factor')
            ->where('user_id', $user->id)
            ->whereNotNull('enabled_at')
            ->first();
        $method = $factor->method ?? 'authenticator';
        if (!$factor || !in_array($method, ['email', 'sms'], true)) {
            return response()->json(['success' => false, 'message' => 'A delivery code is not needed for this method.'], 409);
        }
        if (!$delivery->isConfigured($method)) {
            return response()->json(['success' => false, 'message' => 'Code delivery is not configured. Please contact support.'], 503);
        }

        $code = $twoFactor->generateCode();
        DB::table('customer_two_factor')->where('user_id', $user->id)->update([
            'management_code_hash' => Hash::make($code),
            'management_code_expires_at' => now()->addMinutes(10),
        ]);

        try {
            $twoFactor->sendOtp($user, $method, $code, 'disable', $delivery);
        } catch (\Throwable $exception) {
            DB::table('customer_two_factor')->where('user_id', $user->id)->update([
                'management_code_hash' => null,
                'management_code_expires_at' => null,
            ]);
            Log::warning('Customer two-factor disable code delivery failed.', ['user_id' => $user->id]);

            return response()->json(['success' => false, 'message' => $exception->getMessage()], 503);
        }

        return response()->json([
            'success' => true,
            'destination' => $delivery->destination($method, $user->email, $user->phone ?? $user->phone_number ?? null),
        ]);
    }

    public function disable(Request $request, CustomerTwoFactor $twoFactor)
    {
        $user = $this->customer($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $attemptKey = $this->rateLimitKey('two-factor-disable', (string) $user->id);
        if ($response = $this->rateLimitResponse($attemptKey, 5)) {
            return $response;
        }

        $result = DB::transaction(function () use ($user, $request, $twoFactor) {
            $factor = DB::table('customer_two_factor')
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();
            if (!$factor || !$factor->enabled_at
                || (($factor->method ?? 'authenticator') === 'authenticator' && !$factor->secret)) {
                return 'not_enabled';
            }

            $method = $factor->method ?? 'authenticator';
            $code = trim((string) $request->input('code', ''));
            $valid = $method === 'authenticator'
                ? $twoFactor->matchingCounter(
                    $twoFactor->decryptSecret($factor->secret),
                    $code,
                    $factor->last_counter === null ? null : (int) $factor->last_counter
                ) !== null
                : ($factor->management_code_hash
                    && $factor->management_code_expires_at
                    && now()->lessThanOrEqualTo($factor->management_code_expires_at)
                    && Hash::check($code, $factor->management_code_hash));
            if (!$valid) {
                return 'invalid_code';
            }

            DB::table('customer_two_factor')->where('user_id', $user->id)->delete();
            DB::table('customer_two_factor_recovery_codes')->where('user_id', $user->id)->delete();

            return 'disabled';
        });

        if ($result === 'not_enabled') {
            return response()->json(['success' => false, 'message' => 'Two-factor authentication is not enabled.'], 409);
        }
        if ($result === 'invalid_code') {
            $this->recordRateLimitAttempt($attemptKey, 900);
            return response()->json(['success' => false, 'message' => 'That authenticator code is invalid or expired.'], 422);
        }
        $this->clearRateLimit($attemptKey);

        return response()->json(['success' => true, 'enabled' => false]);
    }

    public function verifyLogin(Request $request, CustomerTwoFactor $twoFactor)
    {
        $challengeToken = trim((string) $request->input('challenge_token', ''));
        $code = trim((string) $request->input('code', ''));
        if (!preg_match('/^[a-f0-9]{64}$/', $challengeToken) || $code === '') {
            return response()->json(['success' => false, 'message' => 'Enter a valid authenticator or recovery code.'], 422);
        }

        $result = DB::transaction(function () use ($challengeToken, $code, $twoFactor) {
            $challenge = DB::table('customer_two_factor_login_challenges')
                ->where('token_hash', hash('sha256', $challengeToken))
                ->lockForUpdate()
                ->first();
            if (!$challenge || $challenge->used_at !== null || now()->greaterThan($challenge->expires_at)) {
                return ['error' => 'challenge_expired'];
            }

            $user = User::find($challenge->user_id);
            if (!$user || strtolower((string) $user->role) !== 'customer'
                || strtolower(trim((string) ($user->status ?? 'active'))) !== 'active') {
                return ['error' => 'challenge_expired'];
            }

            $factor = DB::table('customer_two_factor')
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();
            if (!$factor || !$factor->enabled_at
                || (($factor->method ?? 'authenticator') === 'authenticator' && !$factor->secret)) {
                return ['error' => 'challenge_expired'];
            }

            $method = $factor->method ?? 'authenticator';
            $verifiedCounter = $method === 'authenticator' && $factor->secret
                ? $twoFactor->matchingCounter(
                    $twoFactor->decryptSecret($factor->secret),
                    $code,
                    $factor->last_counter === null ? null : (int) $factor->last_counter
                )
                : null;
            $verifiedDeliveryCode = $challenge->code_hash && Hash::check($code, $challenge->code_hash);
            $recoveryCodeId = null;

            if ($verifiedCounter === null && !$verifiedDeliveryCode) {
                $normalizedCode = $twoFactor->normalizeRecoveryCode($code);
                if (strlen($normalizedCode) >= 10 && strlen($normalizedCode) <= 20) {
                    $recoveryCodes = DB::table('customer_two_factor_recovery_codes')
                        ->where('user_id', $user->id)
                        ->lockForUpdate()
                        ->get();
                    foreach ($recoveryCodes as $recoveryCode) {
                        if (Hash::check($normalizedCode, $recoveryCode->code_hash)) {
                            $recoveryCodeId = $recoveryCode->id;
                            break;
                        }
                    }
                }
            }

            if ($verifiedCounter === null && !$verifiedDeliveryCode && $recoveryCodeId === null) {
                $attempts = (int) $challenge->attempts + 1;
                DB::table('customer_two_factor_login_challenges')
                    ->where('id', $challenge->id)
                    ->update([
                        'attempts' => $attempts,
                        'used_at' => $attempts >= 5 ? now() : null,
                    ]);

                return ['error' => $attempts >= 5 ? 'challenge_expired' : 'invalid_code'];
            }

            DB::table('customer_two_factor_login_challenges')
                ->where('id', $challenge->id)
                ->update(['used_at' => now()]);

            if ($verifiedCounter !== null) {
                DB::table('customer_two_factor')
                    ->where('user_id', $user->id)
                    ->update(['last_counter' => $verifiedCounter, 'updated_at' => now()]);
            } else {
                DB::table('customer_two_factor_recovery_codes')->where('id', $recoveryCodeId)->delete();
            }

            $token = bin2hex(random_bytes(32));
            DB::table('user_sessions')->updateOrInsert(
                ['user_id' => $user->id],
                [
                    'token' => $token,
                    'created_at' => now(),
                    'expires_at' => now()->addDays(30),
                ]
            );

            return [
                'token' => $token,
                'user' => [
                    'id' => (string) $user->id,
                    'name' => $user->name,
                    'username' => $user->username ?? '',
                    'email' => $user->email,
                    'role' => $user->role,
                    'phone' => $user->phone ?? '',
                    'profile_picture' => $user->profile_picture ?: $user->profile_image ?: '',
                    'profile_image' => $user->profile_picture ?: $user->profile_image ?: '',
                    'avatar' => $user->profile_picture ?: $user->profile_image ?: '',
                ],
            ];
        });

        if (isset($result['error'])) {
            if ($result['error'] === 'challenge_expired') {
                return response()->json(['success' => false, 'message' => 'This sign-in request expired. Please sign in again.'], 401);
            }

            return response()->json(['success' => false, 'message' => 'That code is invalid or already used. Try again.'], 422);
        }

        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $this->regenerateAuthenticationSession();
        $_SESSION['user'] = $result['user'];
        $_SESSION['auth_token'] = $result['token'];
        session(['user' => $result['user'], 'auth_token' => $result['token']]);

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'token' => $result['token'],
            'user' => $result['user'],
        ]);
    }

    private function customer(Request $request): ?User
    {
        $user = $this->getAuthenticatedUser($request);

        return $user && strtolower((string) $user->role) === 'customer' ? $user : null;
    }
}
