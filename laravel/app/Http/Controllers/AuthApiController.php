<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class AuthApiController extends Controller
{
    /**
     * Register a new user.
     */
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'email' => 'required|string|email|max:150|unique:users',
            'password' => 'required|string|min:6',
            'phone' => 'nullable|string',
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
        Log::info('Login attempt', [
            'email' => $request->email,
            'ip' => $request->ip(),
            'all' => $request->all()
        ]);

        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if ($validator->fails()) {
            Log::warning('Login validation failed', $validator->errors()->toArray());
            return response()->json(['success' => false, 'message' => 'Invalid input'], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            Log::warning('Login failed: User not found', ['email' => $request->email]);
            return response()->json([
                'success' => false,
                'message' => 'Account not found. Please register first.'
            ], 200);
        }

        // Support both plain-text (old) and hashed passwords
        $passwordValid = (
            $request->password === $user->password ||
            password_verify($request->password, $user->password) ||
            Hash::check($request->password, $user->password)
        );

        if (!$passwordValid) {
            Log::warning('Login failed: Incorrect password', ['email' => $request->email]);
            return response()->json([
                'success' => false,
                'message' => 'Incorrect password. Please try again.'
            ], 200); // Using 200 to ensure message delivery
        }

        Log::info('Login successful', ['user_id' => $user->id, 'email' => $user->email]);

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
        $jwtToken = base64_encode(json_encode(array_merge($userData, ['exp' => time() + 86400])));

        $response = [
            'success' => true,
            'message' => 'Login successful',
            'token' => $token,
            'jwt_token' => $jwtToken,
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

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:100',
            'phone' => 'sometimes|string|max:20',
            'email' => 'sometimes|email|max:150|unique:users,email,' . $user->id,
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        if ($request->has('name')) $user->name = $request->name;
        if ($request->has('phone')) $user->phone = $request->phone;
        if ($request->has('email')) $user->email = $request->email;

        $user->save();

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
        $email = trim($request->input('email', ''));
        if (!$email) {
            return response()->json(['success' => false, 'message' => 'Email is required'], 400);
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
        $email = $request->input('email');
        $code = $request->input('code');

        $valid = DB::table('password_resets')
            ->where('email', $email)
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
        $email = $request->input('email');
        $code = $request->input('code');
        $newPassword = $request->input('new_password');

        $reset = DB::table('password_resets')
            ->where('email', $email)
            ->where('token', $code)
            ->where('used', 0)
            ->where('expires_at', '>', now())
            ->first();

        if (!$reset) {
            return response()->json(['success' => false, 'message' => 'Code expired or invalid'], 400);
        }

        $user = User::where('email', $email)->first();
        if ($user) {
            $user->update(['password' => Hash::make($newPassword)]);
            DB::table('password_resets')->where('email', $email)->update(['used' => 1]);
        }

        return response()->json(['success' => true]);
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
            'profile_image' => $user->profile_picture ?? '',
            'address' => $user->address ?? '',
        ];
    }
}
