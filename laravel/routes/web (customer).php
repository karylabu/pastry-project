<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CustomerApiController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\StaffApiController;
use App\Http\Controllers\AdminApiController;
use App\Http\Controllers\AuthController;

Route::post('/api/google-login', [AuthController::class, 'googleLogin']);

Route::get('/api/db-test', function() {
    try {
        \Illuminate\Support\Facades\DB::connection()->getPdo();
        return response()->json(['status' => 'connected', 'database' => \Illuminate\Support\Facades\DB::getDatabaseName()]);
    } catch (\Exception $e) {
        return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
    }
});
Route::get('/api/google-login', function() { return response()->json(['message' => 'Use POST method'], 405); });

use App\Http\Controllers\LegacyController;

Route::redirect('/', '/products');
Route::get('/products', [ProductController::class, 'index'])->name('products.index');

Route::get('/login.php', [AuthController::class, 'showLogin'])->name('auth.login');
Route::post('/login.php', [AuthController::class, 'login'])->name('auth.login.submit');
Route::get('/auth/google', [AuthController::class, 'redirectToGoogle'])->name('auth.google.redirect');
Route::get('/auth/google/callback', [AuthController::class, 'handleGoogleCallback'])->name('auth.google.callback');
Route::get('/auth/google/test', [AuthController::class, 'testGoogleLogin'])->name('auth.google.test');
Route::get('/register.php', [AuthController::class, 'showRegister'])->name('auth.register');
Route::post('/register.php', [AuthController::class, 'register'])->name('auth.register.submit');

Route::redirect('/index.php', '/products');
Route::get('/customer_index.php', [CustomerController::class, 'dashboard']);
Route::get('/inventory.php', [StaffController::class, 'inventory']);
Route::any('/recipes.php', [LegacyController::class, 'render']);
Route::any('/variance.php', [LegacyController::class, 'render']);
Route::any('/update_categories.php', [LegacyController::class, 'render']);
// lightweight auth check used by legacy scripts
Route::any('/check_auth.php', function () {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $user = $_SESSION['user'] ?? null;
    return response()->json([ 'logged_in' => $user !== null, 'user' => $user ]);
});
Route::get('/products.php', [ProductController::class, 'index']);

// Legacy customer pages converted into Laravel controllers
Route::get('/dashboard.php', [CustomerController::class, 'dashboard']);
Route::match(['get', 'post'], '/staff_login.php', [StaffController::class, 'login']);
Route::get('/staff/logout.php', [StaffController::class, 'logout']);
Route::get('/staff/dashboard.php', [StaffController::class, 'dashboard']);
Route::get('/staff/products.php', [StaffController::class, 'products']);
Route::get('/staff/orders.php', [StaffController::class, 'orders']);
Route::post('/staff/orders.php', [StaffController::class, 'updateOrderStatus']);
Route::get('/staff_orders.php', [StaffController::class, 'orders']);
Route::post('/staff_orders.php', [StaffController::class, 'updateOrderStatus']);
Route::get('/staff/inventory.php', [StaffController::class, 'inventory']);
Route::post('/staff/inventory_update.php', [StaffController::class, 'inventoryUpdate']);
Route::get('/analytics.php', [StaffController::class, 'analytics']);
Route::get('/reports.php', [StaffController::class, 'reports']);
Route::get('/recipes.php', [StaffController::class, 'recipes']);
Route::post('/recipes.php', [StaffController::class, 'saveRecipe']);
Route::get('/variance.php', [StaffController::class, 'variance']);
Route::post('/variance.php', [StaffController::class, 'logVariance']);
Route::get('/update_categories.php', [StaffController::class, 'updateCategoriesForm']);
Route::post('/update_categories.php', [StaffController::class, 'updateCategories']);
Route::get('/admin_products.php', [StaffController::class, 'products']);
Route::match(['get', 'post'], '/cart.php', [CustomerController::class, 'cart']);
Route::match(['get', 'post'], '/customer/cart.php', [CustomerController::class, 'cart']);
Route::match(['get', 'post'], '/checkout.php', [CustomerController::class, 'checkout']);
Route::post('/place_order.php', [CustomerController::class, 'placeOrder']);
Route::get('/orders.php', [CustomerController::class, 'orders']);
Route::get('/notifications.php', [CustomerController::class, 'notifications']);
Route::get('/logout.php', [CustomerController::class, 'logout']);
Route::get('/find_config.php', [CustomerController::class, 'findConfig']);

Route::any('/api_custom_cake.php', function(\Illuminate\Http\Request $request) {
    $filePath = base_path('../customer/api_custom_cake.php');
    if (!file_exists($filePath)) abort(404);

    // Provide DB connection for legacy script
    require_once base_path('../includes/db.php');

    ob_start();
    include $filePath;
    return response(ob_get_clean());
})->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);

Route::any('/api_favorites.php', [CustomerApiController::class, 'favorites'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/api_products.php', [CustomerApiController::class, 'products'])

    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/api_login.php', [CustomerApiController::class, 'login'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/api_forgot_password.php', [CustomerApiController::class, 'forgotPassword'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/api_verify_reset_password.php', [CustomerApiController::class, 'verifyResetCode'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/api_reset_password.php', [CustomerApiController::class, 'resetPassword'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/api_orders.php', [CustomerApiController::class, 'createOrder'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/api_place_order.php', [CustomerApiController::class, 'createOrder'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/api_addresses.php', [CustomerApiController::class, 'addresses'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::get('/api_get_orders.php', [CustomerApiController::class, 'getOrders'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::post('/api_cancel_order.php', [CustomerApiController::class, 'cancelOrder'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::post('/api_confirm_received.php', [CustomerApiController::class, 'confirmReceived'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/api_users.php', [CustomerApiController::class, 'users'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::get('/api_chat_fetch.php', [CustomerApiController::class, 'chatFetch'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::post('/api_chat_send.php', [CustomerApiController::class, 'chatSend'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/create_payment.php', [CustomerApiController::class, 'createPayment'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/cart_api.php', [CustomerApiController::class, 'cartApi'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::get('/api_user.php', [CustomerApiController::class, 'user'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);

// New Laravel API Routes
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductApiController;
use App\Http\Controllers\FavoriteController;
use App\Http\Controllers\AuthApiController;
use App\Http\Controllers\AddressController;
use App\Http\Controllers\NotificationController;

Route::prefix('api')->group(function () {
    // Auth
    Route::post('/login', [AuthApiController::class, 'login']);
    Route::post('/register', [AuthApiController::class, 'register']);
    Route::post('/update-profile', [AuthApiController::class, 'updateProfile']);
    Route::post('/forgot-password', [AuthApiController::class, 'forgotPassword']);
    Route::post('/verify-reset-code', [AuthApiController::class, 'verifyResetCode']);
    Route::post('/reset-password', [AuthApiController::class, 'resetPassword']);

    // Orders
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::post('/orders/customize', [OrderController::class, 'customize']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);
    Route::post('/orders/{id}/cancel', [OrderController::class, 'cancel']);
    Route::put('/orders/{id}/status', [OrderController::class, 'updateStatus']);

    Route::get('/user', function (\Illuminate\Http\Request $request) {
        $token = $request->bearerToken();
        if ($token) {
            // Remove 'Bearer ' if present
            $token = str_replace('Bearer ', '', $token);

            // 1. Try hex token (user_sessions)
            $session = \Illuminate\Support\Facades\DB::table('user_sessions')
                ->where('token', $token)
                ->where('expires_at', '>', now())
                ->first();

            $userId = null;
            if ($session) {
                $userId = $session->user_id;
            } else {
                // 2. Try legacy base64 token
                try {
                    $decoded = json_decode(base64_decode($token), true);
                    if ($decoded && isset($decoded['id'])) {
                        $userId = $decoded['id'];
                    }
                } catch (\Exception $e) {}
            }

            if ($userId) {
                $user = \App\Models\User::find($userId);
                if ($user) {
                    return response()->json([
                        'success' => true,
                        'user' => [
                            'id' => (string)$user->id,
                            'name' => $user->name,
                            'email' => $user->email,
                            'role' => $user->role,
                            'phone' => $user->phone ?? '',
                            'profile_image' => $user->profile_picture ?? '',
                        ]
                    ]);
                }
            }
        }
        return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
    });

    // Products
    Route::get('/products', [ProductApiController::class, 'index']);
    Route::get('/products/{id}', [ProductApiController::class, 'show']);

    // Favorites
    Route::get('/favorites', [FavoriteController::class, 'index']);
    Route::post('/favorites/toggle', [FavoriteController::class, 'toggle']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);

    // Addresses
    Route::get('/addresses', [AddressController::class, 'index']);
    Route::post('/addresses', [AddressController::class, 'store']);
    Route::put('/addresses/{id}', [AddressController::class, 'update']);
    Route::delete('/addresses/{id}', [AddressController::class, 'destroy']);
})->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);

Route::any('/staff/api_products.php', [LegacyController::class, 'render'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/staff/api_update_stocks.php', [LegacyController::class, 'render'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/staff/api_orders.php', [LegacyController::class, 'render'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/staff/api_update_order_status.php', [LegacyController::class, 'render'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::any('/staff/api_chat_fetch_all.php', [LegacyController::class, 'render'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);

// Staff API routes (for Flutter app)
Route::match(['post', 'options'], '/staff/api/login', [StaffApiController::class, 'login'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['get', 'options'], '/staff/api/orders', [StaffApiController::class, 'getOrders'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['get', 'post', 'options'], '/staff/api/products', [StaffApiController::class, 'getProducts'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['get', 'options'], '/staff/api/ingredients', [StaffApiController::class, 'getIngredients'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['get', 'options'], '/staff/api/custom-cakes', [StaffApiController::class, 'getCustomCakes'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['get', 'options'], '/staff/api/dashboard', [StaffApiController::class, 'getDashboardStats'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['get', 'options'], '/staff/api/reports', [StaffApiController::class, 'getReports'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['get', 'options'], '/staff/api/waste-logs', [StaffApiController::class, 'getWasteLogs'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['get', 'options'], '/staff/api/waste-catalogue', [StaffApiController::class, 'getWasteCatalogue'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['post', 'options'], '/staff/api/create-waste', [StaffApiController::class, 'createWasteEntry'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['post', 'options'], '/staff/api/update-stock', [StaffApiController::class, 'updateStock'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['post', 'options'], '/staff/api/update-order-status', [StaffApiController::class, 'updateOrderStatus'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['post', 'options'], '/staff/api/save-ingredient', [StaffApiController::class, 'saveIngredient'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['post', 'options'], '/staff/api/delete-ingredient', [StaffApiController::class, 'deleteIngredient'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['get', 'options'], '/staff/api/ingredient-history', [StaffApiController::class, 'getIngredientHistory'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['get', 'options'], '/staff/api/notifications', [StaffApiController::class, 'getNotifications'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['post', 'options'], '/staff/api/mark-notification-read', [StaffApiController::class, 'markNotificationRead'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);

// Admin API routes (for Flutter app)
Route::match(['post', 'options'], '/admin/api/login', [AdminApiController::class, 'login'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['get', 'options'], '/admin/api/orders', [AdminApiController::class, 'getOrders'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['get', 'options'], '/admin/api/products', [AdminApiController::class, 'getProducts'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['get', 'options'], '/admin/api/customers', [AdminApiController::class, 'getCustomers'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);
Route::match(['get', 'options'], '/admin/api/dashboard', [AdminApiController::class, 'getDashboardStats'])
    ->withoutMiddleware([Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class]);

// Redirect admin users to the legacy admin products page for the same behavior
Route::get('/admin-products', function () {
    return redirect('/admin_products.php');
})->name('admin.products');

// Legacy PHP fallback: serve any remaining .php file through Laravel
Route::any('{any}', [LegacyController::class, 'render'])
    ->where('any', '.*\.php');
