<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\CustomerTwoFactor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

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
            'enabled' => $factor && $factor->enabled_at !== null && $factor->secret !== null,
            'recovery_codes_remaining' => DB::table('customer_two_factor_recovery_codes')
                ->where('user_id', $user->id)
                ->count(),
        ]);
    }

    public function setup(Request $request, CustomerTwoFactor $twoFactor)
    {
        $user = $this->customer($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }
        if ($twoFactor->isEnabled((int) $user->id)) {
            return response()->json(['success' => false, 'message' => 'Two-factor authentication is already enabled.'], 409);
        }

        $secret = $twoFactor->generateSecret();
        DB::table('customer_two_factor')->updateOrInsert(
            ['user_id' => $user->id],
            [
                'pending_secret' => $twoFactor->encryptSecret($secret),
                'pending_expires_at' => now()->addMinutes(10),
                'secret' => null,
                'enabled_at' => null,
                'last_counter' => null,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        return response()->json([
            'success' => true,
            'secret' => $secret,
            'otpauth_url' => $twoFactor->provisioningUri($secret, $user->email),
        ]);
    }

    public function enable(Request $request, CustomerTwoFactor $twoFactor)
    {
        $user = $this->customer($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $code = trim((string) $request->input('code', ''));
        $recoveryCodes = $twoFactor->generateRecoveryCodes();
        $result = DB::transaction(function () use ($user, $code, $twoFactor, $recoveryCodes) {
            $factor = DB::table('customer_two_factor')
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();
            if (!$factor || !$factor->pending_secret || !$factor->pending_expires_at
                || now()->greaterThan($factor->pending_expires_at)) {
                return 'expired';
            }

            $secret = $twoFactor->decryptSecret($factor->pending_secret);
            $counter = $twoFactor->matchingCounter($secret, $code);
            if ($counter === null) {
                return 'invalid_code';
            }

            DB::table('customer_two_factor')
                ->where('user_id', $user->id)
                ->update([
                    'secret' => $twoFactor->encryptSecret($secret),
                    'pending_secret' => null,
                    'pending_expires_at' => null,
                    'enabled_at' => now(),
                    'last_counter' => null,
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
            return response()->json(['success' => false, 'message' => 'That code is invalid or expired. Check your authenticator app and try again.'], 422);
        }

        return response()->json([
            'success' => true,
            'enabled' => true,
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    public function disable(Request $request, CustomerTwoFactor $twoFactor)
    {
        $user = $this->customer($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $result = DB::transaction(function () use ($user, $request, $twoFactor) {
            $factor = DB::table('customer_two_factor')
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();
            if (!$factor || !$factor->secret || !$factor->enabled_at) {
                return 'not_enabled';
            }

            $counter = $twoFactor->matchingCounter(
                $twoFactor->decryptSecret($factor->secret),
                trim((string) $request->input('code', '')),
                $factor->last_counter === null ? null : (int) $factor->last_counter
            );
            if ($counter === null) {
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
            return response()->json(['success' => false, 'message' => 'That authenticator code is invalid or expired.'], 422);
        }

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
            if (!$factor || !$factor->enabled_at || !$factor->secret) {
                return ['error' => 'challenge_expired'];
            }

            $verifiedCounter = $twoFactor->matchingCounter(
                $twoFactor->decryptSecret($factor->secret),
                $code,
                $factor->last_counter === null ? null : (int) $factor->last_counter
            );
            $recoveryCodeId = null;

            if ($verifiedCounter === null) {
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

            if ($verifiedCounter === null && $recoveryCodeId === null) {
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
        session_regenerate_id(true);
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
