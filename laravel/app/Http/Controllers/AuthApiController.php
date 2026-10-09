<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

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
            'email' => 'required|string|email|max:150|unique:users',
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

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => 'customer',
            'phone' => $request->phone,
            'subscribed_promo' => $request->boolean('agree_privacy'),
        ]);

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

    /**
     * Login compatible with both Laravel and legacy systems.
     */
    public function login(Request $request)
    {
        $email = strtolower(trim((string) $request->input('email', '')));
        $password = (string) $request->input('password', '');

        $validator = Validator::make(['email' => $email, 'password' => $password], [
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Invalid input'], 422);
        }

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (!$user) {
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

        try {
            $this->ensureSessionsTable();
        } catch (\Exception $e) {
            Log::error('Failed to ensure sessions table: ' . $e->getMessage());
        }

        $token = bin2hex(random_bytes(32));

        try {
            // Sync with legacy user_sessions table
            DB::table('user_sessions')->updateOrInsert(
                ['user_id' => $user->id],
                [
                    'token' => $token,
                    'created_at' => now(),
                    'expires_at' => now()->addDays(30)
                ]
            );
        } catch (\Exception $e) {
            Log::error('Failed to update user_sessions: ' . $e->getMessage());
            // Continue anyway as we still have the token for the app
        }

        $userData = $this->formatUserData($user);

        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
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
                ? 'sometimes|file|image|mimes:jpeg,png,webp|max:5120'
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
            $this->notifyCustomerAccountUpdate(
                $user,
                'Profile Updated',
                'Your account profile details were updated.'
            );
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
            DB::table('users')->where('id', $user->id)->update(['password' => Hash::make($newPassword)]);
            DB::table('password_resets')->whereRaw('LOWER(email) = ?', [$email])->update(['used' => 1]);
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

        DB::table('users')->where('id', $user->id)->update([
            'password' => Hash::make((string) $request->input('new_password')),
        ]);
        $this->notifyCustomerAccountUpdate(
            $user,
            'Password Changed',
            'Your account password was changed. If you did not make this change, contact support.'
        );

        return response()->json(['success' => true, 'message' => 'Password updated successfully.']);
    }

    private function notifyCustomerAccountUpdate(User $user, string $title, string $message): void
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
            'action_url' => '/customer/account-settings',
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
        return [
            'id' => (string)$user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'phone' => $user->phone ?? '',
            'profile_image' => $user->profile_picture ?? $user->profile_image ?? '',
            'profile_picture' => $user->profile_picture ?? $user->profile_image ?? '',
            'avatar' => $user->profile_picture ?? $user->profile_image ?? '',
            'address' => $user->address ?? '',
        ];
    }
}
