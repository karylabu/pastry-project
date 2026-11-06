<?php

namespace App\Http\Controllers;

use App\Services\CustomerTwoFactor;
use App\Services\AdminSessionGuard;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

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

    public function login(Request $request, CustomerTwoFactor $twoFactor)
    {
        $email = trim($request->input('email', ''));
        $password = trim($request->input('password', ''));
        $error = '';
        $attemptKey = $this->rateLimitKey('web-login-email', $email);

        if (!$email || !$password) {
            $error = 'Please fill all fields.';
        } elseif ($response = $this->rateLimitResponse($attemptKey, 10)) {
            $error = $response->getData(true)['message'];
        } else {
            $user = DB::table('users')
                ->whereRaw('LOWER(email) = ?', [$email])
                ->first();

            if (!$user) {
                $error = 'User not found.';
            } elseif (Schema::hasColumn('users', 'deleted_at')
                && $user->deleted_at !== null
                && strtolower((string) ($user->role ?? '')) !== 'customer') {
                $error = 'This account is in the Recycle Bin and cannot log in.';
            } elseif (strtolower((string) ($user->role ?? '')) !== 'customer' && !User::isAdminRole($user->role ?? '')) {
                $error = 'This account is not eligible for access.';
            } elseif (strtolower(trim((string) ($user->status ?? 'active'))) !== 'active') {
                $error = 'This account is deactivated.';
            } elseif (!Hash::check($password, $user->password)) {
                $error = 'Incorrect password.';
            } elseif (strtolower((string) ($user->role ?? '')) === 'customer'
                && $twoFactor->isEnabled((int) $user->id)) {
                $error = 'Two-factor authentication is enabled. Please sign in through the customer portal to verify your code.';
            } else {
                $adminToken = null;
                if (User::isAdminRole($user->role ?? '')) {
                    try {
                        $adminToken = app(AdminSessionGuard::class)->claim((int) $user->id, $request);
                    } catch (\Throwable $exception) {
                        \Illuminate\Support\Facades\Log::error('Web admin session claim failed.', [
                            'user_id' => $user->id,
                            'error' => $exception->getMessage(),
                        ]);
                        $error = 'Unable to verify the current admin session. Please try again.';
                    }
                    if ($adminToken === null && $error === '') {
                        $error = 'This account is already signed in on a web browser. Sign out on that device before signing in here.';
                    }
                }

                if ($error !== '') {
                    $this->recordRateLimitAttempt($attemptKey, 900);
                    return back()->withInput()->with('error', $error);
                }

                $this->clearRateLimit($attemptKey);
                $this->regenerateAuthenticationSession();
                $userData = [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role ?? 'customer',
                ];

                $_SESSION['user'] = $userData;
                session(['user' => $userData]);
                if ($adminToken !== null) {
                    $_SESSION['auth_token'] = $adminToken;
                    session(['auth_token' => $adminToken]);
                }

                // Redirect to React app on port 3000
                if (User::isAdminRole($userData['role'])) {
                    return redirect('http://127.0.0.1:3000/admin');
                }
                return redirect('http://127.0.0.1:3000/customer');
            }

            if ($error !== '') {
                $this->recordRateLimitAttempt($attemptKey, 900);
            }
        }

        return back()->withInput()->with('error', $error);
    }

    public function verifyRecaptcha(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'captcha_token' => ['required', 'string', 'max:4096'],
        ]);

        if ($validator->fails()) {
            return $this->googleCorsResponse([
                'success' => false,
                'message' => 'Please complete the “I’m not a robot” check.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $secretKey = config('services.recaptcha.secret_key');
        if (!is_string($secretKey) || trim($secretKey) === '') {
            return $this->googleCorsResponse([
                'success' => false,
                'message' => 'reCAPTCHA is not configured on the server.',
            ], 503);
        }

        try {
            $verification = Http::asForm()
                ->acceptJson()
                ->timeout(10)
                ->post('https://www.google.com/recaptcha/api/siteverify', [
                    'secret' => $secretKey,
                    'response' => $request->input('captcha_token'),
                    'remoteip' => $request->ip(),
                ]);
        } catch (ConnectionException $exception) {
            error_log('Google reCAPTCHA verification connection failed: ' . $exception->getMessage());
            return $this->googleCorsResponse([
                'success' => false,
                'message' => 'The robot check could not be verified right now. Please try again.',
            ], 503);
        }

        if (!$verification->successful()) {
            return $this->googleCorsResponse([
                'success' => false,
                'message' => 'The robot check could not be verified right now. Please try again.',
            ], 503);
        }

        $result = $verification->json();
        $hostname = strtolower((string) ($result['hostname'] ?? ''));
        $allowedHostnames = ['pastryproject.shop', 'www.pastryproject.shop', 'localhost', '127.0.0.1'];

        if (
            empty($result['success'])
            || !in_array($hostname, $allowedHostnames, true)
            || !is_string(config('app.key'))
            || config('app.key') === ''
        ) {
            return $this->googleCorsResponse([
                'success' => false,
                'message' => 'Please complete the robot check again.',
            ], 422);
        }

        $proofPayload = json_encode([
            'exp' => now()->addMinutes(20)->timestamp,
            'nonce' => bin2hex(random_bytes(16)),
        ], JSON_THROW_ON_ERROR);
        $encodedPayload = rtrim(strtr(base64_encode($proofPayload), '+/', '-_'), '=');
        $signature = hash_hmac('sha256', $encodedPayload, config('app.key'));

        return $this->googleCorsResponse([
            'success' => true,
            'proof' => $encodedPayload . '.' . $signature,
        ]);
    }

    public function googleLogin(
        Request $request,
        CustomerTwoFactor $twoFactor,
        \App\Services\CustomerTwoFactorDelivery $delivery,
        \App\Services\RegistrationPhoneVerification $phoneVerification
    )
    {
        if ($request->isMethod('options')) {
            return $this->googleCorsResponse(['success' => true]);
        }

        $intent = $request->input('intent');
        if ($intent === 'signup') {
            $validator = Validator::make($request->all(), [
                'phone' => ['required', 'string', 'max:30', 'regex:/^\+?[0-9\s-]{7,15}$/'],
                'phone_verification_id' => ['required', 'string', 'size:64', 'regex:/^[a-f0-9]{64}$/'],
                'agree_terms' => ['accepted'],
                'agree_privacy' => ['accepted'],
            ]);

            if ($validator->fails()) {
                return $this->googleCorsResponse([
                    'success' => false,
                    'message' => 'A valid phone number and acceptance of both policies are required.',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $requestedEmail = strtolower(trim((string) $request->input('email', '')));
            if ($requestedEmail !== '') {
                $existingUser = DB::table('users')->whereRaw('LOWER(email) = ?', [$requestedEmail])->first();
                if ($existingUser) {
                    if (User::isAdminRole($existingUser->role ?? '')) {
                        return $this->googleCorsResponse([
                            'success' => false,
                            'code' => 'admin_account_not_allowed',
                            'message' => 'This is an admin account. Please continue to the admin login page.',
                        ], 403);
                    }

                    if (!Schema::hasColumn('users', 'deleted_at') || $existingUser->deleted_at === null) {
                        return $this->googleCorsResponse([
                            'success' => false,
                            'code' => 'account_already_exists',
                            'message' => 'An account with this Google email already exists. Please log in instead.',
                        ], 409);
                    }
                }
            }

            if ($phoneVerification->isPhoneRegistered((string) $request->input('phone'))) {
                return $this->googleCorsResponse([
                    'success' => false,
                    'code' => 'phone_already_registered',
                    'message' => 'This phone number is already linked to an account. Please log in to your existing account.',
                ], 409);
            }

        } elseif ($intent === 'complete_phone') {
            $validator = Validator::make($request->all(), [
                'phone' => ['required', 'string', 'max:30', 'regex:/^\+?[0-9\s-]{7,15}$/'],
                'phone_verification_id' => ['required', 'string', 'size:64', 'regex:/^[a-f0-9]{64}$/'],
            ]);

            if ($validator->fails()) {
                return $this->googleCorsResponse([
                    'success' => false,
                    'message' => 'A valid phone number and phone verification are required.',
                    'errors' => $validator->errors(),
                ], 422);
            }
        }

        $idToken = $request->input('id_token');

        if (!$idToken || !is_string($idToken)) {
            return $this->googleCorsResponse(['success' => false, 'message' => 'Firebase ID token is required.'], 422);
        }

        if (!$this->isValidRecaptchaProof($request->input('recaptcha_proof'))) {
            return $this->googleCorsResponse([
                'success' => false,
                'code' => 'recaptcha_required',
                'message' => 'Please complete the robot check before continuing with Google.',
            ], 422);
        }

        try {
            $curl = curl_init('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' . config('services.firebase.api_key'));
            $curlOptions = [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS => json_encode(['idToken' => $idToken]),
                CURLOPT_TIMEOUT => 15,
            ];
            $caPath = $this->firebaseCaPath();
            if ($caPath !== null) {
                $curlOptions[CURLOPT_CAINFO] = $caPath;
            }
            curl_setopt_array($curl, $curlOptions);
            $firebaseBody = curl_exec($curl);
            $curlError = curl_error($curl);
            $firebaseStatus = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
            curl_close($curl);
            if ($firebaseBody === false) {
                throw new \RuntimeException($curlError ?: 'Firebase request failed.');
            }
            $firebaseData = json_decode($firebaseBody, true) ?: [];
        } catch (\Throwable $e) {
            error_log('Firebase Google login verification error: ' . $e->getMessage());
            return $this->googleCorsResponse([
                'success' => false,
                'message' => 'Google sign-in verification failed on the server. Please check the PHP cURL and SSL configuration.',
            ], 500);
        }

        if ($firebaseStatus < 200 || $firebaseStatus >= 300) {
            return $this->googleCorsResponse(['success' => false, 'message' => 'Firebase Google sign-in token is invalid.'], 401);
        }

        $firebaseUser = $firebaseData['users'][0] ?? null;
        $email = strtolower(trim($firebaseUser['email'] ?? ''));
        $name = trim($firebaseUser['displayName'] ?? '') ?: 'Google User';
        $profilePicture = trim($firebaseUser['photoUrl'] ?? '');
        if ($profilePicture === '') {
            $requestedPhotoUrl = trim((string) $request->input('photoUrl', ''));
            $photoHost = strtolower((string) parse_url($requestedPhotoUrl, PHP_URL_HOST));
            if (
                filter_var($requestedPhotoUrl, FILTER_VALIDATE_URL)
                && ($photoHost === 'googleusercontent.com' || str_ends_with($photoHost, '.googleusercontent.com'))
            ) {
                $profilePicture = $requestedPhotoUrl;
            }
        }

        if (!$email || empty($firebaseUser['emailVerified'])) {
            return $this->googleCorsResponse(['success' => false, 'message' => 'A verified Google email is required.'], 422);
        }

        if (in_array($intent, ['signup', 'complete_phone'], true)) {
            $verificationId = trim((string) $request->input('phone_verification_id', ''));
            $verifiedPhone = (string) $request->input('phone', '');
            if (!$phoneVerification->isVerified($verificationId, $verifiedPhone)) {
                return $this->googleCorsResponse([
                    'success' => false,
                    'code' => 'phone_verification_required',
                    'message' => 'Verify your phone number before continuing.',
                ], 422);
            }
        }

        $user = DB::table('users')->whereRaw('LOWER(email) = ?', [$email])->first();
        $isTrashedUser = $user && Schema::hasColumn('users', 'deleted_at') && $user->deleted_at !== null;
        if ($isTrashedUser && !in_array($intent, ['signup', 'signup_check'], true)) {
            return $this->googleCorsResponse([
                'success' => false,
                'code' => 'account_deactivated',
                'message' => 'This account is in the Recycle Bin and cannot log in.',
            ], 403);
        }
        $profileColumn = Schema::hasColumn('users', 'profile_picture')
            ? 'profile_picture'
            : (Schema::hasColumn('users', 'profile_image') ? 'profile_image' : null);

        if ($intent === 'signup_check') {
            if ($user && User::isAdminRole($user->role ?? '')) {
                return $this->googleCorsResponse([
                    'success' => false,
                    'code' => 'admin_account_not_allowed',
                    'message' => 'This is an admin account. Please continue to the admin login page.',
                ], 403);
            }

            if ($user && !$isTrashedUser) {
                return $this->googleCorsResponse([
                    'success' => false,
                    'code' => 'account_already_exists',
                    'message' => 'This account is already registered. Please continue to the login page.',
                ], 409);
            }

            return $this->googleCorsResponse([
                'success' => false,
                'code' => 'user_not_found',
                'message' => 'User not found. Please create an account.',
            ], 404);
        }

        if ($intent === 'signup' && $user && User::isAdminRole($user->role ?? '')) {
            return $this->googleCorsResponse([
                'success' => false,
                'code' => 'admin_account_not_allowed',
                'message' => 'This is an admin account. Please continue to the admin login page.',
            ], 403);
        }

        if ($intent === 'signup' && $user && !$isTrashedUser) {
            return $this->googleCorsResponse([
                'success' => false,
                'code' => 'account_already_exists',
                'message' => 'An account with this Google email already exists. Please log in instead.',
            ], 409);
        }

        if (!$user || ($intent === 'signup' && $isTrashedUser)) {
            if ($intent !== 'signup') {
                return $this->googleCorsResponse([
                    'success' => false,
                    'code' => 'user_not_found',
                    'message' => 'User not found. Please create an account.',
                ], 404);
            }

            $newUser = [
                'name' => $name,
                'email' => $email,
                'password' => Hash::make(bin2hex(random_bytes(16))),
                'role' => 'customer',
                'created_at' => now(),
            ];
            $newUser['phone'] = trim((string) $request->input('phone'));
            $newUser['terms_accepted_at'] = now();
            $newUser['privacy_accepted_at'] = now();
            if ($profileColumn) {
                $newUser[$profileColumn] = $profilePicture ?: null;
            }
            try {
                DB::transaction(function () use ($phoneVerification, $request, $newUser, $email, $isTrashedUser) {
                    if (!$phoneVerification->consumeVerified(
                        (string) $request->input('phone_verification_id'),
                        (string) $request->input('phone')
                    )) {
                        throw new \DomainException('The phone verification has expired or was already used.');
                    }

                    if ($isTrashedUser) {
                        app(\App\Services\AdminRecycleBinService::class)
                            ->discardTrashedUserForRegistration($email);
                    }

                    DB::table('users')->insert($newUser);
                });
            } catch (\DomainException $exception) {
                return $this->googleCorsResponse([
                    'success' => false,
                    'code' => 'phone_verification_required',
                    'message' => 'Verify your phone number before creating an account.',
                ], 422);
            }

            $user = DB::table('users')->where('email', $email)->first();
        } elseif ($profilePicture && $profileColumn) {
            $savedPicture = trim((string) ($user->profile_picture ?? ''))
                ?: trim((string) ($user->profile_image ?? ''));
            if ($savedPicture === '') {
                DB::table('users')->where('id', $user->id)->update([$profileColumn => $profilePicture]);
                $user->{$profileColumn} = $profilePicture;
            }
        }

        if ($intent === 'complete_phone') {
            if (!$user) {
                return $this->googleCorsResponse([
                    'success' => false,
                    'code' => 'user_not_found',
                    'message' => 'We could not find an account for this Google sign-in.',
                ], 404);
            }

            if (User::isAdminRole($user->role ?? '')) {
                return $this->googleCorsResponse([
                    'success' => false,
                    'code' => 'admin_account_not_allowed',
                    'message' => 'This is an admin account. Please continue to the admin login page.',
                ], 403);
            }

            if (strtolower((string) ($user->role ?? '')) !== 'customer') {
                return $this->googleCorsResponse([
                    'success' => false,
                    'message' => 'This account is not eligible for access.',
                ], 403);
            }

            if (strtolower(trim((string) ($user->status ?? 'active'))) !== 'active') {
                return $this->googleCorsResponse([
                    'success' => false,
                    'message' => 'This account is deactivated.',
                ], 403);
            }

            $phone = trim((string) $request->input('phone'));
            $verificationId = trim((string) $request->input('phone_verification_id'));
            $existingPhone = trim((string) ($user->phone ?? ''))
                ?: trim((string) ($user->phone_number ?? ''));

            if ($existingPhone === '') {
                if ($phoneVerification->isPhoneRegistered($phone)) {
                    return $this->googleCorsResponse([
                        'success' => false,
                        'code' => 'phone_already_registered',
                        'message' => 'This phone number is already linked to an account. Please log in to your existing account.',
                    ], 409);
                }

                try {
                    DB::transaction(function () use ($user, $phone, $verificationId, $phoneVerification) {
                        $lockedUser = DB::table('users')->where('id', $user->id)->lockForUpdate()->first();
                        $lockedPhone = trim((string) ($lockedUser->phone ?? ''))
                            ?: trim((string) ($lockedUser->phone_number ?? ''));

                        if ($lockedPhone !== '') {
                            return;
                        }

                        if (!$phoneVerification->consumeVerified($verificationId, $phone)) {
                            throw new \DomainException('The phone verification has expired or was already used.');
                        }

                        DB::table('users')->where('id', $user->id)->update(['phone' => $phone]);
                    });
                } catch (\DomainException $exception) {
                    return $this->googleCorsResponse([
                        'success' => false,
                        'code' => 'phone_verification_required',
                        'message' => 'Verify your phone number before continuing.',
                    ], 422);
                }
            }

            $user = DB::table('users')->where('id', $user->id)->first();
        }

        if (strtolower((string) ($user->role ?? '')) !== 'customer' && !User::isAdminRole($user->role ?? '')) {
            return $this->googleCorsResponse(['success' => false, 'message' => 'This account is not eligible for access.'], 403);
        }
        if (strtolower(trim((string) ($user->status ?? 'active'))) !== 'active') {
            return $this->googleCorsResponse(['success' => false, 'message' => 'This account is deactivated.'], 403);
        }

        if (
            $intent === 'login_or_signup'
            && strtolower((string) ($user->role ?? '')) === 'customer'
            && trim((string) ($user->phone ?? '')) === ''
            && trim((string) ($user->phone_number ?? '')) === ''
        ) {
            return $this->googleCorsResponse([
                'success' => false,
                'code' => 'phone_required',
                'message' => 'Add and verify your phone number to continue.',
            ], 409);
        }

        if (strtolower((string) ($user->role ?? '')) === 'customer' && $twoFactor->isEnabled((int) $user->id)) {
            try {
                $challenge = $twoFactor->createLoginChallenge((int) $user->id, $delivery);
            } catch (\RuntimeException $exception) {
                \Illuminate\Support\Facades\Log::warning('Customer two-factor login code delivery failed.', ['user_id' => $user->id]);

                return $this->googleCorsResponse([
                    'success' => false,
                    'message' => $exception->getMessage(),
                ], 503);
            }

            return $this->googleCorsResponse([
                'success' => true,
                'requires_two_factor' => true,
                'challenge_token' => $challenge['token'],
                'two_factor_method' => $challenge['method'],
                'delivery_destination' => $challenge['destination'],
            ]);
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

        $profilePicture = trim((string) ($user->profile_picture ?? ''))
            ?: trim((string) ($user->profile_image ?? ''));
        $userData = [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username ?? '',
            'email' => $user->email,
            'role' => $user->role ?? 'customer',
            'profile_picture' => $profilePicture,
            'profile_image' => $profilePicture,
            'avatar' => $profilePicture,
        ];

        $this->regenerateAuthenticationSession();
        $_SESSION['user'] = $userData;
        $_SESSION['auth_token'] = $token;
        session(['user' => $userData]);
        session(['auth_token' => $token]);

        return $this->googleCorsResponse(['success' => true, 'token' => $token, 'user' => $userData]);
    }

    private function isValidRecaptchaProof($proof): bool
    {
        if (!is_string($proof) || !is_string(config('app.key')) || config('app.key') === '') {
            return false;
        }

        $parts = explode('.', $proof);
        if (count($parts) !== 2) {
            return false;
        }

        [$encodedPayload, $providedSignature] = $parts;
        $expectedSignature = hash_hmac('sha256', $encodedPayload, config('app.key'));
        if (!hash_equals($expectedSignature, $providedSignature)) {
            return false;
        }

        $payloadBase64 = strtr($encodedPayload, '-_', '+/');
        $payloadBase64 .= str_repeat('=', (4 - strlen($payloadBase64) % 4) % 4);
        $payloadJson = base64_decode($payloadBase64, true);
        if (!is_string($payloadJson)) {
            return false;
        }

        $payload = json_decode($payloadJson, true);

        return is_array($payload)
            && is_int($payload['exp'] ?? null)
            && $payload['exp'] >= now()->timestamp
            && $payload['exp'] <= now()->addMinutes(20)->timestamp
            && is_string($payload['nonce'] ?? null)
            && preg_match('/^[a-f0-9]{32}$/', $payload['nonce']) === 1;
    }

    private function firebaseHttpClient()
    {
        $candidatePaths = [
            env('PHP_CACERT_PATH'),
            env('FIREBASE_CA_BUNDLE'),
            'C:\\xampp\\php\\extras\\ssl\\cacert.pem',
            'C:\\xampp\\apache\\bin\\curl-ca-bundle.crt',
            'C:\\Users\\Jerickson Abistado\\cacert.pem',
            'C:\\Users\\Jerickson Abistado\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.2_Microsoft.Winget.Source_8wekyb3d8bbwe\\cacert.pem',
        ];

        foreach ($candidatePaths as $path) {
            if (is_string($path) && trim($path) !== '' && file_exists($path)) {
                return Http::withOptions(['verify' => $path]);
            }
        }

        throw new \RuntimeException('No valid cacert.pem CA bundle was found for PHP cURL. Configure C:\\xampp\\php\\php.ini with curl.cainfo and openssl.cafile, then restart Apache.');
    }

    private function firebaseCaPath(): ?string
    {
        $candidatePaths = [
            env('PHP_CACERT_PATH'),
            env('FIREBASE_CA_BUNDLE'),
            ini_get('curl.cainfo'),
            ini_get('openssl.cafile'),
            'C:\\xampp\\php\\extras\\ssl\\cacert.pem',
            'C:\\Users\\Jerickson Abistado\\cacert.pem',
            '/etc/ssl/certs/ca-certificates.crt',
            '/etc/pki/tls/certs/ca-bundle.crt',
            '/etc/ssl/cert.pem',
        ];

        foreach ($candidatePaths as $path) {
            if (is_string($path) && trim($path) !== '' && is_readable($path)) {
                return $path;
            }
        }

        return null;
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
            if (User::isAdminRole($role)) {
                return $base . '/admin';
            }
            if (strtolower($role) === 'staff') {
                return $base . '/staff';
            }
            return $base . '/customer';
        }

        $base = $request->getSchemeAndHttpHost() . '/GitHub/Capstone--Development';
        if (User::isAdminRole($role)) {
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
            return redirect(rtrim($this->resolveFrontendRedirect($request, 'customer'), '/') . '/register')
                ->with('error', 'Verify your email through customer registration before creating an account.');
        }

        if (Schema::hasColumn('users', 'deleted_at') && $user->deleted_at !== null) {
            return redirect()->route('auth.login')->with('error', 'This account is in the Recycle Bin and cannot log in.');
        }

        if ((strtolower((string) ($user->role ?? '')) !== 'customer' && !User::isAdminRole($user->role ?? ''))
            || strtolower(trim((string) ($user->status ?? 'active'))) !== 'active') {
            return redirect()->route('auth.login')->with('error', 'This account is not eligible for access.');
        }

        $userData = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role ?? 'customer',
        ];

        $this->regenerateAuthenticationSession();
        $_SESSION['user'] = $userData;
        session(['user' => $userData]);
        session()->forget('oauth_state');

        return redirect($this->buildFrontendAuthRedirect($request, $userData));
    }

    public function showRegister(Request $request)
    {
        return redirect(rtrim($this->resolveFrontendRedirect($request, 'customer'), '/') . '/register');
    }

    public function register(Request $request)
    {
        return redirect(rtrim($this->resolveFrontendRedirect($request, 'customer'), '/') . '/register');
    }

    public function logout(Request $request)
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $this->revokeCurrentToken($request);
        unset($_SESSION['user']);
        unset($_SESSION['auth_token']);
        session()->invalidate();
        session()->regenerateToken();

        return redirect('http://127.0.0.1:3000/customer/login');
    }

}
