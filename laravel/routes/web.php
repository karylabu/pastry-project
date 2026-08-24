<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CustomerApiController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\LegacyController;
use App\Http\Controllers\SalesImportController;

Route::middleware(['auth:sanctum', 'role:admin,staff'])
    ->prefix('staff')
    ->group(function () {
        Route::post('/sales/import-pdf', [SalesImportController::class, 'store']);
    });

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

// Redirect admin users to the legacy admin products page for the same behavior
Route::get('/admin-products', function () {
    return redirect('/admin_products.php');
})->name('admin.products');

// Legacy PHP fallback: serve any remaining .php file through Laravel
Route::any('{any}', [LegacyController::class, 'render'])
    ->where('any', '.*\.php');
