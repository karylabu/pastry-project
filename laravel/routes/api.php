<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AdminAlertController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PromotionController;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\IngredientBatchController;
use App\Http\Controllers\Api\IngredientInventoryController;
use App\Http\Controllers\Api\IngredientController;
use App\Http\Controllers\Api\DiscardRequestController;
use App\Http\Controllers\Api\WasteLogController;
use App\Http\Controllers\Api\RecipeController;
use App\Http\Controllers\Api\ProductionController;
use App\Http\Controllers\Api\CustomizedCakeController;
use App\Http\Controllers\Api\CakeSalesAnalyticsController;
use App\Http\Controllers\Api\OrderFeedbackController;
use App\Http\Controllers\FavoriteController;
use App\Http\Controllers\AddressController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\SalesImportController;
use App\Http\Controllers\NewsletterController;
use App\Http\Controllers\CustomerApiController;
use App\Http\Controllers\StaffApiController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AuthApiController;

Route::options('{any}', fn () => response()->noContent())->where('any', '.*');

Route::get('products', [ProductController::class, 'index']);
Route::get('reviews', [OrderFeedbackController::class, 'publicIndex']);
Route::match(['get', 'post'], 'customer/products', [CustomerApiController::class, 'products']);
Route::match(['get', 'options'], 'staff/dashboard', [StaffApiController::class, 'getDashboard']);
Route::post('login', [AuthApiController::class, 'login']);
Route::post('register', [AuthApiController::class, 'register']);
Route::post('profile', [AuthApiController::class, 'updateProfile']);
Route::post('password/forgot', [AuthApiController::class, 'forgotPassword'])
    ->middleware(\Illuminate\Routing\Middleware\ThrottleRequests::class . ':5,15');
Route::post('password/verify', [AuthApiController::class, 'verifyResetCode'])
    ->middleware(\Illuminate\Routing\Middleware\ThrottleRequests::class . ':10,15');
Route::post('password/reset', [AuthApiController::class, 'resetPassword'])
    ->middleware(\Illuminate\Routing\Middleware\ThrottleRequests::class . ':10,15');
Route::post('password/change', [AuthApiController::class, 'changePassword']);
Route::post('account/delete', [AuthApiController::class, 'deleteAccount']);
Route::get('sessions', [AuthApiController::class, 'sessions']);
Route::post('google-login', [AuthController::class, 'googleLogin']);
Route::options('google-login', [AuthController::class, 'googleLogin']);
Route::get('orders', [OrderController::class, 'index']);
Route::post('orders', [OrderController::class, 'store']);
Route::post('orders/{orderId}/cancel', [OrderController::class, 'cancel']);
Route::post('orders/{orderId}/confirm-received', [OrderController::class, 'confirmReceived']);
Route::post('orders/{orderId}/payment-proof', [OrderController::class, 'submitPaymentProof']);
Route::post('orders/{orderId}/payment-failure', [OrderController::class, 'markPaymentFailed']);
Route::post('sales/import-pdf', [SalesImportController::class, 'store']);
Route::post('sales/import-csv', [SalesImportController::class, 'storeCsv']);
Route::post('sales/import', [SalesImportController::class, 'storeRows']);
Route::get('sales/import/history', [SalesImportController::class, 'history']);
Route::get('sales/import/{importId}/status', [SalesImportController::class, 'importStatus']);
Route::post('newsletter/subscribe', [NewsletterController::class, 'subscribe']);
Route::post('orders', [OrderController::class, 'store']);
Route::get('user', [CustomerApiController::class, 'user']);
Route::get('customer/notifications', [CustomerApiController::class, 'notifications']);
Route::post('customer/notifications/{id}/read', [CustomerApiController::class, 'markNotificationRead']);
Route::get('customer/chat/messages', [CustomerApiController::class, 'chatFetch']);
Route::post('customer/chat/messages', [CustomerApiController::class, 'chatSend']);
Route::post('customer/payments', [CustomerApiController::class, 'createPayment']);
Route::get('staff/chat/conversations', [CustomerApiController::class, 'chatConversations']);
Route::get('staff/chat/messages', [CustomerApiController::class, 'chatFetch']);
Route::post('staff/chat/messages', [CustomerApiController::class, 'chatSend']);
Route::get('favorites', [FavoriteController::class, 'index']);
Route::post('favorites/toggle', [FavoriteController::class, 'toggle']);
Route::get('addresses', [AddressController::class, 'index']);
Route::post('addresses', [AddressController::class, 'store']);
Route::put('addresses/{id}', [AddressController::class, 'update']);
Route::delete('addresses/{id}', [AddressController::class, 'destroy']);
Route::get('staff/orders/{orderId}/discount-id', [StaffApiController::class, 'viewOrderDiscountId']);
Route::get('staff/orders/{orderId}/payment-proof', [StaffApiController::class, 'viewOrderPaymentProof']);
Route::get('admin/analytics/cake-sales', [CakeSalesAnalyticsController::class, 'index']);
Route::get('admin/reviews', [OrderFeedbackController::class, 'index']);

// Staff inventory routes
Route::post('staff/inventory/batches', [IngredientBatchController::class, 'store']);
Route::get('staff/inventory/ingredients', [IngredientInventoryController::class, 'index']);
Route::get('staff/inventory/batches', [IngredientInventoryController::class, 'allBatches']);
Route::get('staff/inventory/ingredients/{ingredient}/batches', [IngredientInventoryController::class, 'batches']);
Route::post('staff/ingredients', [IngredientController::class, 'store']);
Route::put('staff/ingredients/{ingredient}', [IngredientController::class, 'update']);
Route::delete('staff/ingredients/{ingredient}', [IngredientController::class, 'destroy']);
Route::post('staff/ingredients/{ingredient}/adjust-stock', [IngredientController::class, 'adjustStock']);
Route::post('staff/ingredients/sync-recipes', [IngredientController::class, 'syncFromRecipes']);

// Staff discard routes
Route::get('staff/inventory/discards', [DiscardRequestController::class, 'index']);
Route::post('staff/inventory/discards', [DiscardRequestController::class, 'store']);
Route::post('staff/inventory/discards/{discard}/approve', [DiscardRequestController::class, 'approve']);
Route::post('staff/inventory/discards/{discard}/reject', [DiscardRequestController::class, 'reject']);

// Staff waste routes
Route::get('staff/inventory/waste', [WasteLogController::class, 'index']);
Route::get('staff/inventory/waste/catalogue', [WasteLogController::class, 'catalogue']);
Route::post('staff/inventory/waste', [WasteLogController::class, 'store']);

// Staff production routes
Route::get('staff/products/{product}/recipe', [RecipeController::class, 'show']);
Route::put('staff/products/{product}/recipe', [RecipeController::class, 'update']);
Route::get('staff/production/availability/{product}', [ProductionController::class, 'availability']);
Route::post('staff/production', [ProductionController::class, 'store']);

Route::get('customized-cakes/flavors', [CustomizedCakeController::class, 'flavors']);
Route::get('customized-cakes/sizes', [CustomizedCakeController::class, 'sizes']);
Route::get('customized-cakes/recipes', [CustomizedCakeController::class, 'recipes']);
Route::get('staff/customized-cakes/catalog', [CustomizedCakeController::class, 'adminCatalog']);
Route::post('staff/customized-cakes/flavors', [CustomizedCakeController::class, 'saveFlavor']);
Route::patch('staff/customized-cakes/flavors/{flavor}/toggle', [CustomizedCakeController::class, 'toggleFlavor']);
Route::post('staff/customized-cakes/sizes', [CustomizedCakeController::class, 'saveSize']);
Route::patch('staff/customized-cakes/sizes/{size}/toggle', [CustomizedCakeController::class, 'toggleSize']);
Route::put('staff/customized-cakes/recipes', [CustomizedCakeController::class, 'saveRecipe']);
Route::post('customized-cakes/preview', [CustomizedCakeController::class, 'preview']);
Route::post('customized-cakes/order', [CustomizedCakeController::class, 'storeOrder']);
Route::post('customized-cakes/consume-inventory', [CustomizedCakeController::class, 'consume']);

Route::middleware(['api'])->group(function () {
    Route::apiResource('users', UserController::class);

    Route::prefix('admin')->group(function () {
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::patch('notifications/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::post('notifications/mark-all-read', [NotificationController::class, 'markAllRead']);
        Route::post('device-token', [NotificationController::class, 'registerDeviceToken']);
        Route::post('notifications/send', [NotificationController::class, 'dispatchPushNotification']);
        Route::post('stock/mutate', [StockController::class, 'mutate']);

        Route::get('alerts', [AdminAlertController::class, 'index']);
        Route::post('alerts', [AdminAlertController::class, 'store']);
        Route::patch('alerts/{id}/read', [AdminAlertController::class, 'markAsRead']);
        Route::post('alerts/mark-all-read', [AdminAlertController::class, 'markAllRead']);
        Route::get('promotions', [PromotionController::class, 'index']);
        Route::post('promotions/send', [PromotionController::class, 'send']);
        Route::post('promotions/{promotion}', [PromotionController::class, 'update']);
    });
});
