<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\CustomerTwoFactor;
use App\Services\CustomerTwoFactorDelivery;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\QueryException;
use App\Services\AdminSessionGuard;

class AuthApiController extends Controller
{
    public function status(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Authentication required.',
            ], 401);
        }

        return response()->json([
            'success' => true,
            'user' => [
                'id' => (int) $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
            ],
        ]);
    }

    /**
     * Register a new user.
     */
    public function register(Request $request)
    {
        $request->merge(['email' => strtolower(trim((string) $request->input('email', '')))]);
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'email' => 'required|string|email|max:150',
            'password' => 'required|string|min:6',
            'phone' => 'nullable|string',
            'agree_privacy' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        if ($response = $this->existingAccountResponse($request->email)) {
            return $response;
        }

        try {
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => 'customer',
                'phone' => $request->phone,
                'subscribed_promo' => $request->boolean('agree_privacy'),
            ]);
        } catch (QueryException $exception) {
            if ($response = $this->existingAccountResponse($request->email)) {
                return $response;
            }

            throw $exception;
        }

        $token = bin2hex(random_bytes(32));

        $this->ensureSessionsTable();

        // Sync with legacy user_sessions table
        DB::table('user_sessions')->updateOrInsert(
            ['user_id' => $user->id],
            [
                'token' => $token,
                'created_at' => now(),
                'expires_at' => now()->addDays(30)
            ]
        );

        $userData = $this->formatUserData($user);
        $jwtToken = base64_encode(json_encode(array_merge($userData, ['exp' => time() + 86400])));

        return response()->json([
            'success' => true,
            'message' => 'Registration successful',
            'token' => $token,
            'jwt_token' => $jwtToken,
            'user' => $userData,
        ], 201);
    }

    private function existingAccountResponse(string $email): ?\Illuminate\Http\JsonResponse
    {
        $existingUser = User::whereRaw('LOWER(email) = ?', [$email])->first();
        if (!$existingUser) {
            return null;
        }

        if (strtolower((string) $existingUser->role) === 'admin') {
            return response()->json([
                'success' => false,
                'code' => 'admin_account_not_allowed',
                'message' => 'This is an admin account. Please continue to the admin login page.',
            ], 403);
        }

        return response()->json([
            'success' => false,
            'code' => 'account_already_registered',
            'message' => 'This account is already registered. Please login.',
        ], 409);
    }

    /**
     * Login compatible with both Laravel and legacy systems.
     */
    public function login(Request $request, CustomerTwoFactor $twoFactor, CustomerTwoFactorDelivery $delivery)
    {
        $email = strtolower(trim((string) $request->input('email', '')));
        $password = (string) $request->input('password', '');
        $attemptKey = $this->rateLimitKey('login-email', $email);

        $validator = Validator::make(['email' => $email, 'password' => $password], [
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Invalid input'], 422);
        }

        if ($response = $this->rateLimitResponse($attemptKey, 10)) {
            return $response;
        }

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (!$user) {
            $this->recordRateLimitAttempt($attemptKey, 900);
            return response()->json([
                'success' => false,
                'message' => 'Account not found. Please register first.'
            ], 200);
        }

        if (!in_array(strtolower((string) $user->role), ['customer', 'admin'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'This account is not eligible for access.',
            ], 403);
        }

        if (strtolower(trim((string) ($user->status ?? 'active'))) !== 'active') {
            return response()->json(['success' => false, 'message' => 'This account is deactivated.'], 403);
        }

        $storedPassword = (string) $user->getRawOriginal('password');
        $isLegacyPassword = hash_equals($storedPassword, $password);
        $passwordValid = !$isLegacyPassword
            && (Hash::info($storedPassword)['algoName'] ?? 'unknown') !== 'unknown'
            && Hash::check($password, $storedPassword);

        if (!$passwordValid && !$isLegacyPassword) {
            $this->recordRateLimitAttempt($attemptKey, 900);
            return response()->json([
                'success' => false,
                'message' => 'Incorrect password. Please try again.'
            ], 200); // Using 200 to ensure message delivery
        }

        if ($isLegacyPassword) {
            DB::table('users')
                ->where('id', $user->id)
                ->update(['password' => Hash::make($password)]);
        }
        $this->clearRateLimit($attemptKey);

        if (strtolower((string) $user->role) === 'customer' && $twoFactor->isEnabled((int) $user->id)) {
            try {
                $challenge = $twoFactor->createLoginChallenge((int) $user->id, $delivery);
            } catch (\RuntimeException $exception) {
                Log::warning('Customer two-factor login code delivery failed.', ['user_id' => $user->id]);

                return response()->json([
                    'success' => false,
                    'message' => $exception->getMessage(),
                ], 503);
            }

            return response()->json([
                'success' => true,
                'requires_two_factor' => true,
                'challenge_token' => $challenge['token'],
                'two_factor_method' => $challenge['method'],
                'delivery_destination' => $challenge['destination'],
            ]);
        }

        if (strtolower((string) $user->role) === 'admin') {
            try {
                $token = app(AdminSessionGuard::class)->claim((int) $user->id, $request);
            } catch (\Throwable $exception) {
                Log::error('Admin session claim failed.', [
                    'user_id' => $user->id,
                    'error' => $exception->getMessage(),
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Unable to verify the current admin session. Please try again.',
                ], 503);
            }

            if ($token === null) {
                return response()->json([
                    'success' => false,
                    'code' => 'ADMIN_SESSION_ACTIVE',
                    'message' => 'This account is already signed in on a web browser. Sign out on that device before signing in here.',
                ], 409);
            }
        } else {
            try {
                $this->ensureSessionsTable();
                $token = bin2hex(random_bytes(32));
                DB::table('user_sessions')->updateOrInsert(
                    ['user_id' => $user->id],
                    [
                        'token' => $token,
                        'created_at' => now(),
                        'expires_at' => now()->addDays(30)
                    ]
                );
            } catch (\Throwable $exception) {
                Log::error('Customer session creation failed: ' . $exception->getMessage());

                return response()->json([
                    'success' => false,
                    'message' => 'Unable to create your session. Please try again.',
                ], 503);
            }
        }

        $userData = $this->formatUserData($user);

        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $this->regenerateAuthenticationSession();
        $_SESSION['user'] = $userData;
        $_SESSION['auth_token'] = $token;
        session(['user' => $userData]);
        session(['auth_token' => $token]);

        $response = [
            'success' => true,
            'message' => 'Login successful',
            'token' => $token,
            'user' => $userData,
        ];

        Log::info('Login response sent', ['user_id' => $user->id]);
        return response()->json($response);
    }

    /**
     * Update user profile details.
     */
    public function updateProfile(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $data = $request->all();
        if (!array_key_exists('name', $data) && array_key_exists('full_name', $data)) {
            $data['name'] = $data['full_name'];
        }
        if (!array_key_exists('profile_picture', $data) && array_key_exists('profile_image', $data)) {
            $data['profile_picture'] = $data['profile_image'];
        }
        if (isset($data['email'])) {
            $data['email'] = strtolower(trim((string) $data['email']));
        }

        $hasProfilePhoto = $request->hasFile('profile_picture');
        $validator = Validator::make($data, [
            'name' => 'sometimes|string|max:100',
            'phone' => 'sometimes|nullable|string|max:20',
            'email' => 'sometimes|email|max:150|unique:users,email,' . $user->id,
            'username' => 'sometimes|nullable|string|max:100',
            'profile_picture' => $hasProfilePhoto
                ? ['sometimes', 'file', 'image', 'mimes:jpeg,png,webp', $this->allowedFileExtensions(['jpg', 'jpeg', 'png', 'webp']), 'max:5120']
                : 'sometimes|nullable|string|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $updates = [];
        foreach (['name', 'phone', 'email'] as $field) {
            if (array_key_exists($field, $data)) {
                $updates[$field] = $data[$field];
            }
        }
        if (array_key_exists('username', $data) && Schema::hasColumn('users', 'username')) {
            $updates['username'] = $data['username'];
        }
        $profileColumn = Schema::hasColumn('users', 'profile_picture')
            ? 'profile_picture'
            : (Schema::hasColumn('users', 'profile_image') ? 'profile_image' : null);
        $oldProfilePicture = $profileColumn ? ($user->{$profileColumn} ?? null) : null;
        if ($hasProfilePhoto && $profileColumn) {
            $uploadDirectory = public_path('uploads/profile');
            if (!is_dir($uploadDirectory) && !mkdir($uploadDirectory, 0755, true) && !is_dir($uploadDirectory)) {
                Log::error('Unable to create customer profile photo upload directory.', ['user_id' => $user->id]);
                return response()->json(['success' => false, 'message' => 'Unable to save profile photo. Please try again.'], 500);
            }

            $photo = $request->file('profile_picture');
            $filename = bin2hex(random_bytes(16)) . '.' . $photo->extension();
            try {
                $photo->move($uploadDirectory, $filename);
            } catch (\Throwable $exception) {
                Log::error('Unable to save customer profile photo.', [
                    'user_id' => $user->id,
                    'error' => $exception->getMessage(),
                ]);
                return response()->json(['success' => false, 'message' => 'Unable to save profile photo. Please try again.'], 500);
            }

            $data['profile_picture'] = url('uploads/profile/' . $filename);
        }
        if ($profileColumn && array_key_exists('profile_picture', $data)) {
            $updates[$profileColumn] = $data['profile_picture'];
        }
        $profileFieldLabels = [
            'name' => ['your full name', 'full_name'],
            'username' => ['your username', 'username'],
            'email' => ['your email address', 'email'],
            'phone' => ['your phone number', 'phone'],
        ];
        if ($profileColumn) {
            $profileFieldLabels[$profileColumn] = ['your profile photo', 'profile-photo'];
        }
        $changedFields = [];
        foreach ($updates as $field => $value) {
            if ((string) ($user->{$field} ?? '') !== (string) $value && isset($profileFieldLabels[$field])) {
                $changedFields[] = $profileFieldLabels[$field];
            }
        }

        if ($updates) {
            DB::table('users')->where('id', $user->id)->update($updates);
            $user->refresh();
            if ($hasProfilePhoto && $oldProfilePicture) {
                $oldPath = parse_url($oldProfilePicture, PHP_URL_PATH) ?: $oldProfilePicture;
                if (preg_match('~(?:^|/)uploads/profile/([A-Za-z0-9._-]+)$~', $oldPath, $matches)) {
                    $oldPhotoPath = $uploadDirectory . DIRECTORY_SEPARATOR . $matches[1];
                    if (is_file($oldPhotoPath)) {
                        unlink($oldPhotoPath);
                    }
                }
            }
            foreach ($changedFields as [$label, $anchor]) {
                $this->notifyCustomerAccountUpdate(
                    $user,
                    'Account Updated',
                    'You successfully edited ' . $label . '.',
                    '/customer/account-settings?section=profile#' . $anchor
                );
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully',
            'user' => $this->formatUserData($user)
        ]);
    }

    /**
     * Forgot password - send code to email.
     */
    public function forgotPassword(Request $request)
    {
        $email = strtolower(trim((string) $request->input('email', '')));
        $validator = Validator::make(['email' => $email], ['email' => 'required|email|max:255']);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Please enter a valid email address.'], 422);
        }

        $requestKey = $this->rateLimitKey('password-reset-request', $email);
        $ipKey = $this->rateLimitKey('password-reset-request-ip', $request->ip() ?? 'unknown');
        if ($response = $this->rateLimitResponse($ipKey, 10) ?? $this->rateLimitResponse($requestKey, 3)) {
            return $response;
        }
        $this->recordRateLimitAttempt($ipKey, 3600);
        $this->recordRateLimitAttempt($requestKey, 3600);

        $user = User::where('email', $email)->first();
        if (!$user) {
            return response()->json(['success' => true]);
        }

        $this->ensurePasswordResetsTable();

        $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::table('password_resets')->updateOrInsert(
            ['email' => $email],
            [
                'token' => $code,
                'expires_at' => now()->addMinutes(15),
                'used' => 0,
                'created_at' => now()
            ]
        );

        try {
            Mail::html("Your code is: <b>{$code}</b>. It expires in 15 minutes.", function ($message) use ($email) {
                $message->to($email)
                    ->subject('Your Password Reset Code');
            });
            Log::info("Reset code sent successfully to: " . $email);
        } catch (\Exception $e) {
            Log::error("Mail failed to {$email}: " . $e->getMessage());
            // Return true anyway so we don't leak account existence,
            // but the log will show us the real error.
        }

        return response()->json(['success' => true]);
    }

    /**
     * Verify reset code.
     */
    public function verifyResetCode(Request $request)
    {
        $this->ensurePasswordResetsTable();
        $email = strtolower(trim((string) $request->input('email', '')));
        $code = trim((string) $request->input('code', ''));
        $validator = Validator::make(['email' => $email, 'code' => $code], [
            'email' => 'required|email|max:255',
            'code' => 'required|string|size:6',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Invalid or expired code'], 422);
        }

        $attemptKey = $this->rateLimitKey('password-reset-code', $email);
        $ipKey = $this->rateLimitKey('password-reset-code-ip', $request->ip() ?? 'unknown');
        if ($response = $this->rateLimitResponse($ipKey, 10) ?? $this->rateLimitResponse($attemptKey, 5)) {
            return $response;
        }
        $this->recordRateLimitAttempt($ipKey, 900);
        $this->recordRateLimitAttempt($attemptKey, 900);

        $valid = DB::table('password_resets')
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('token', $code)
            ->where('used', 0)
            ->where('expires_at', '>', now())
            ->exists();

        return response()->json(['success' => $valid, 'message' => $valid ? null : 'Invalid or expired code']);
    }

    /**
     * Reset password.
     */
    public function resetPassword(Request $request)
    {
        $this->ensurePasswordResetsTable();
        $email = strtolower(trim((string) $request->input('email', '')));
        $code = trim((string) $request->input('code', ''));
        $newPassword = (string) $request->input('new_password', '');
        $validator = Validator::make([
            'email' => $email,
            'code' => $code,
            'new_password' => $newPassword,
        ], [
            'email' => 'required|email|max:255',
            'code' => 'required|string|size:6',
            'new_password' => 'required|string|min:6',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Please provide a valid code and password.'], 422);
        }

        $attemptKey = $this->rateLimitKey('password-reset-code', $email);
        $ipKey = $this->rateLimitKey('password-reset-code-ip', $request->ip() ?? 'unknown');
        if ($response = $this->rateLimitResponse($ipKey, 10) ?? $this->rateLimitResponse($attemptKey, 5)) {
            return $response;
        }
        $this->recordRateLimitAttempt($ipKey, 900);
        $this->recordRateLimitAttempt($attemptKey, 900);

        $reset = DB::table('password_resets')
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('token', $code)
            ->where('used', 0)
            ->where('expires_at', '>', now())
            ->first();

        if (!$reset) {
            return response()->json(['success' => false, 'message' => 'Code expired or invalid'], 400);
        }

        $user = User::where('email', $email)->first();
        if ($user) {
            DB::transaction(function () use ($user, $newPassword) {
                DB::table('users')->where('id', $user->id)->update(['password' => Hash::make($newPassword)]);
                $this->revokeUserTokens((int) $user->id);
                DB::table('password_resets')->whereRaw('LOWER(email) = ?', [strtolower((string) $user->email)])
                    ->update(['used' => 1]);
            });
            unset($_SESSION['user'], $_SESSION['auth_token']);
            session()->forget(['user', 'auth_token']);
            $this->notifyCustomerAccountUpdate(
                $user,
                'Password Changed',
                'Your account password was changed. If you did not make this change, contact support.'
            );
        }

        return response()->json(['success' => true]);
    }

    public function changePassword(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user || !in_array(strtolower((string) $user->role), ['customer', 'admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:6',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Please provide a valid current and new password.'], 422);
        }
        if (!$this->passwordMatches($user, (string) $request->input('current_password'))) {
            return response()->json(['success' => false, 'message' => 'Current password is incorrect.'], 422);
        }

        DB::transaction(function () use ($request, $user) {
            DB::table('users')->where('id', $user->id)->update([
                'password' => Hash::make((string) $request->input('new_password')),
            ]);
            $this->revokeUserTokens((int) $user->id);
        });
        unset($_SESSION['user'], $_SESSION['auth_token']);
        session()->forget(['user', 'auth_token']);
        $this->notifyCustomerAccountUpdate(
            $user,
            'Password Changed',
            'Your account password was changed. If you did not make this change, contact support.'
        );

        return response()->json(['success' => true, 'message' => 'Password updated successfully.']);
    }

    public function logout(Request $request)
    {
        $this->revokeCurrentToken($request);
        unset($_SESSION['user'], $_SESSION['auth_token']);
        session()->invalidate();
        session()->regenerateToken();

        return response()->json(['success' => true, 'message' => 'Logged out successfully.']);
    }

    private function notifyCustomerAccountUpdate(
        User $user,
        string $title,
        string $message,
        string $actionUrl = '/customer/account-settings'
    ): void
    {
        if (!Schema::hasTable('notifications')) {
            return;
        }

        DB::table('notifications')->insert([
            'user_id' => $user->id,
            'title' => $title,
            'message' => $message,
            'type' => 'Info',
            'is_read' => 0,
            'action_url' => $actionUrl,
            'created_at' => now(),
        ]);
    }

    public function deleteAccount(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user || strtolower((string) $user->role) !== 'customer') {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $password = (string) $request->input('password', '');
        if ($password === '' || !$this->passwordMatches($user, $password)) {
            return response()->json(['success' => false, 'message' => 'Password is incorrect.'], 422);
        }

        DB::transaction(function () use ($user) {
            if (Schema::hasTable('user_sessions')) {
                DB::table('user_sessions')->where('user_id', $user->id)->delete();
            }
            if (Schema::hasTable('favorites')) {
                DB::table('favorites')->where('customer_id', $user->id)->delete();
            }
            if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'user_id')) {
                DB::table('orders')->where('user_id', $user->id)->update(['user_id' => null]);
            }
            $user->delete();
        });

        return response()->json(['success' => true, 'message' => 'Account deleted successfully.']);
    }

    public function sessions(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user || strtolower((string) $user->role) !== 'customer') {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }
        if (!Schema::hasTable('user_sessions')) {
            return response()->json(['success' => true, 'sessions' => []]);
        }

        $token = $request->bearerToken() ?: trim((string) $request->header('X-Auth-Token', ''));
        $sessions = DB::table('user_sessions')
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($session) => [
                'id' => (int) $session->id,
                'device_name' => $session->device_name ?: 'Unknown device',
                'ip_address' => $session->ip_address ?: 'Unknown IP',
                'created_at' => $session->created_at,
                'expires_at' => $session->expires_at,
                'current' => $token !== '' && hash_equals((string) $session->token, $token),
            ]);

        return response()->json(['success' => true, 'sessions' => $sessions]);
    }

    private function passwordMatches(User $user, string $password): bool
    {
        $storedPassword = (string) $user->getRawOriginal('password');
        try {
            if (Hash::check($password, $storedPassword)) {
                return true;
            }
        } catch (\Throwable) {
        }

        return $storedPassword !== '' && hash_equals($storedPassword, $password);
    }

    private function ensureSessionsTable()
    {
        if (!Schema::hasTable('user_sessions')) {
            Schema::create('user_sessions', function ($table) {
                $table->id();
                $table->integer('user_id');
                $table->string('token')->unique();
                $table->timestamp('created_at')->useCurrent();
                $table->timestamp('expires_at')->nullable();
            });
        }
    }

    private function ensurePasswordResetsTable()
    {
        if (!Schema::hasTable('password_resets')) {
            Schema::create('password_resets', function ($table) {
                $table->id();
                $table->string('email')->index();
                $table->string('token');
                $table->timestamp('expires_at');
                $table->boolean('used')->default(0);
                $table->timestamp('created_at')->useCurrent();
            });
        }
    }

    private function formatUserData($user)
    {
        $profilePicture = $user->profile_picture ?: $user->profile_image ?: '';

        return [
            'id' => (string)$user->id,
            'name' => $user->name,
            'username' => $user->username ?? '',
            'email' => $user->email,
            'role' => $user->role,
            'phone' => $user->phone ?? '',
            'profile_image' => $profilePicture,
            'profile_picture' => $profilePicture,
            'avatar' => $profilePicture,
            'address' => $user->address ?? '',
        ];
    }
}
