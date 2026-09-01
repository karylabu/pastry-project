<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;

class AuthController extends Controller
{
    public function __construct()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    public function showLogin(Request $request)
    {
        return view('auth.login', [
            'error' => session('error', ''),
            'success' => session('auth_success', ''),
        ]);
    }

    public function login(Request $request)
    {
        $email = trim($request->input('email', ''));
        $password = trim($request->input('password', ''));
        $error = '';

        if (!$email || !$password) {
            $error = 'Please fill all fields.';
        } else {
            $user = DB::table('users')->where('email', $email)->first();

            if (!$user) {
                $error = 'User not found.';
            } elseif (!Hash::check($password, $user->password) && $password !== $user->password) {
                $error = 'Incorrect password.';
            } else {
                $userData = [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role ?? 'customer',
                ];

                $_SESSION['user'] = $userData;
                session(['user' => $userData]);

                // Redirect to React app on port 3000
                if (strtolower($userData['role']) === 'admin') {
                    return redirect('http://127.0.0.1:3000/admin');
                } elseif (strtolower($userData['role']) === 'staff') {
                    return redirect('http://127.0.0.1:3000/staff');
                }

                return redirect('http://127.0.0.1:3000/customer');
            }
        }

        return back()->withInput()->with('error', $error);
    }

    public function googleLogin(Request $request)
    {
        if ($request->isMethod('options')) {
            return $this->googleCorsResponse(['success' => true]);
        }

        $idToken = $request->input('id_token');

        if (!$idToken || !is_string($idToken)) {
            return $this->googleCorsResponse(['success' => false, 'message' => 'Firebase ID token is required.'], 422);
        }

        $firebaseResponse = Http::asJson()->post(
            'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' . config('services.firebase.api_key'),
            ['idToken' => $idToken]
        );

        if (!$firebaseResponse->successful()) {
            return $this->googleCorsResponse(['success' => false, 'message' => 'Firebase Google sign-in token is invalid.'], 401);
        }

        $firebaseUser = $firebaseResponse->json('users.0');
        $email = strtolower(trim($firebaseUser['email'] ?? ''));
        $name = trim($firebaseUser['displayName'] ?? '') ?: 'Google User';
        $profilePicture = trim($firebaseUser['photoUrl'] ?? '');

        if (!$email || empty($firebaseUser['emailVerified'])) {
            return $this->googleCorsResponse(['success' => false, 'message' => 'A verified Google email is required.'], 422);
        }

        $user = DB::table('users')->where('email', $email)->first();

        if (!$user) {
            DB::table('users')->insert([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make(bin2hex(random_bytes(16))),
                'role' => 'customer',
                'profile_picture' => $profilePicture ?: null,
                'created_at' => now(),
            ]);

            $user = DB::table('users')->where('email', $email)->first();
        } elseif (!$user->profile_picture && $profilePicture) {
            DB::table('users')->where('id', $user->id)->update(['profile_picture' => $profilePicture]);
            $user->profile_picture = $profilePicture;
        }

        $userData = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role ?? 'customer',
            'profile_picture' => $user->profile_picture ?? '',
            'avatar' => $user->profile_picture ?? '',
        ];

        $_SESSION['user'] = $userData;
        session(['user' => $userData]);

        return $this->googleCorsResponse(['success' => true, 'user' => $userData]);
    }

    private function googleCorsResponse(array $payload, int $status = 200)
    {
        $origin = request()->headers->get('Origin', '');
        $allowed = preg_match('/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/', $origin) === 1;

        $response = response()->json($payload, $status)
            ->header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With')
            ->header('Vary', 'Origin');

        if ($allowed) {
            $response->header('Access-Control-Allow-Origin', $origin)
                ->header('Access-Control-Allow-Credentials', 'true');
        }

        return $response;
    }

    private function buildFrontendAuthRedirect(Request $request, array $userData)
    {
        $redirect = $request->query('redirect');
        if (!$redirect || !filter_var($redirect, FILTER_VALIDATE_URL)) {
            $redirect = session('oauth_redirect');
        }

        if (!$redirect || !filter_var($redirect, FILTER_VALIDATE_URL)) {
            $configured = env('FRONTEND_URL');
            if ($configured) {
                $redirect = rtrim($configured, '/');
            } else {
                $redirect = $request->getSchemeAndHttpHost() . '/GitHub/Capstone--Development/customer_portal';
            }
        }

        $redirect = rtrim($redirect, '/');
        $query = http_build_query([
            'google_auth' => '1',
            'id' => $userData['id'] ?? 0,
            'name' => $userData['name'] ?? '',
            'email' => $userData['email'] ?? '',
            'role' => $userData['role'] ?? 'customer',
        ]);

        $separator = str_contains($redirect, '?') ? '&' : '?';
        return $redirect . $separator . $query;
    }

    private function resolveFrontendRedirect(Request $request, $role = 'customer')
    {
        $redirect = $request->query('redirect');
        if (!$redirect || !filter_var($redirect, FILTER_VALIDATE_URL)) {
            $redirect = session('oauth_redirect');
        }
        if ($redirect && filter_var($redirect, FILTER_VALIDATE_URL)) {
            return $redirect;
        }

        $configured = env('FRONTEND_URL');
        if ($configured) {
            $base = rtrim($configured, '/');
            if (strtolower($role) === 'admin') {
                return $base . '/admin';
            }
            if (strtolower($role) === 'staff') {
                return $base . '/staff';
            }
            return $base . '/customer';
        }

        $base = $request->getSchemeAndHttpHost() . '/GitHub/Capstone--Development';
        if (strtolower($role) === 'admin') {
            return $base . '/admin';
        }
        if (strtolower($role) === 'staff') {
            return $base . '/staff';
        }
        return $base . '/customer';
    }

    public function redirectToGoogle(Request $request)
    {
        $clientId = config('services.google.client_id');
        $clientSecret = config('services.google.client_secret');
        $redirectUri = config('services.google.redirect') ?: route('auth.google.callback');

        if (!$clientId || !$clientSecret) {
            return redirect()->route('auth.login')->with('error', 'Google login is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your Laravel .env file.');
        }

        // Check if in test mode (test credentials contain "test_")
        if (strpos($clientId, 'test_') === 0) {
            // Use test mode - redirect to test endpoint
            return redirect()->route('auth.google.test', ['redirect' => $request->query('redirect')]);
        }

        $state = bin2hex(random_bytes(16));
        session(['oauth_state' => $state]);
        session(['oauth_redirect' => $request->query('redirect')]);

        $query = http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'access_type' => 'offline',
            'prompt' => 'select_account',
            'redirect' => $request->query('redirect'),
        ]);

        return redirect('https://accounts.google.com/o/oauth2/v2/auth?' . $query);
    }

    public function handleGoogleCallback(Request $request)
    {
        if ($request->input('state') !== session('oauth_state')) {
            return redirect()->route('auth.login')->with('error', 'Invalid Google login state.');
        }

        if ($request->has('error')) {
            return redirect()->route('auth.login')->with('error', 'Google login failed: ' . $request->input('error'));
        }

        $tokenResponse = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'client_id' => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'redirect_uri' => route('auth.google.callback'),
            'grant_type' => 'authorization_code',
            'code' => $request->input('code'),
        ]);

        if (!$tokenResponse->successful()) {
            return redirect()->route('auth.login')->with('error', 'Unable to complete Google login.');
        }

        $tokenData = $tokenResponse->json();
        $accessToken = $tokenData['access_token'] ?? null;

        if (!$accessToken) {
            return redirect()->route('auth.login')->with('error', 'Google login response was invalid.');
        }

        $userInfoResponse = Http::withToken($accessToken)->get('https://www.googleapis.com/oauth2/v3/userinfo');
        if (!$userInfoResponse->successful()) {
            return redirect()->route('auth.login')->with('error', 'Unable to fetch Google profile.');
        }

        $userInfo = $userInfoResponse->json();
        $email = $userInfo['email'] ?? null;
        $name = $userInfo['name'] ?? ($userInfo['given_name'] ?? 'Google User');
        $emailVerified = filter_var($userInfo['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if (!$email || !$emailVerified) {
            return redirect()->route('auth.login')->with('error', 'Google account email is not available or not verified.');
        }

        $user = DB::table('users')->where('email', $email)->first();

        if (!$user) {
            DB::table('users')->insert([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make(bin2hex(random_bytes(16))),
                'role' => 'customer',
                'created_at' => now(),
            ]);

            $user = DB::table('users')->where('email', $email)->first();
        }

        $userData = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role ?? 'customer',
        ];

        $_SESSION['user'] = $userData;
        session(['user' => $userData]);
        session()->forget('oauth_state');

        return redirect($this->buildFrontendAuthRedirect($request, $userData));
    }

    public function showRegister(Request $request)
    {
        return view('auth.register', [
            'error' => session('error', ''),
            'success' => session('auth_success', ''),
        ]);
    }

    public function register(Request $request)
    {
        $name = trim($request->input('name', ''));
        $email = trim($request->input('email', ''));
        $password = trim($request->input('password', ''));
        $agreeTerms = $request->has('agree_terms');
        $agreePrivacy = $request->has('agree_privacy');
        $error = '';

        if (!$agreeTerms || !$agreePrivacy) {
            $error = 'You must agree to the Terms & Conditions and Privacy Policy.';
        } elseif (!$name || !$email || !$password) {
            $error = 'Please fill all fields.';
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $error = 'Enter a valid email address.';
        } elseif (strlen($password) < 8) {
            $error = 'Password must be at least 8 characters.';
        } elseif (DB::table('users')->where('email', $email)->exists()) {
            $error = 'Email already exists.';
        } else {
            DB::table('users')->insert([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password),
                'role' => 'customer',
                'created_at' => now(),
            ]);

            // Redirect to React login with success message
            return redirect('http://127.0.0.1:3000/customer/login?registered=true');
        }

        return back()->withInput()->with('error', $error);
    }

    public function logout()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        unset($_SESSION['user']);
        session()->forget('user');
        session()->flush();

        return redirect('http://127.0.0.1:3000/customer/login');
    }

    public function testGoogleLogin(Request $request)
    {
        // Test mode: simulate successful Google login
        // In production, this would be replaced with real Google OAuth

        $testEmail = 'testgoogle' . time() . '@gmail.com';
        $testName = 'Test Google User';

        $user = DB::table('users')->where('email', $testEmail)->first();

        if (!$user) {
            DB::table('users')->insert([
                'name' => $testName,
                'email' => $testEmail,
                'password' => Hash::make(bin2hex(random_bytes(16))),
                'role' => 'customer',
                'created_at' => now(),
            ]);

            $user = DB::table('users')->where('email', $testEmail)->first();
        }

        $userData = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role ?? 'customer',
        ];

        $_SESSION['user'] = $userData;
        session(['user' => $userData]);

        return redirect($this->buildFrontendAuthRedirect($request, $userData));
    }
}
