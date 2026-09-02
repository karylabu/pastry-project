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
use App\Http\Controllers\SalesImportController;
use App\Http\Controllers\NewsletterController;
use App\Http\Controllers\StaffApiController;
use App\Http\Controllers\AuthController;

Route::get('products', [ProductController::class, 'index']);
Route::match(['get', 'options'], 'staff/dashboard', [StaffApiController::class, 'getDashboard']);
Route::post('google-login', [AuthController::class, 'googleLogin']);
Route::options('google-login', [AuthController::class, 'googleLogin']);
Route::post('sales/import-pdf', [SalesImportController::class, 'store']);
Route::post('newsletter/subscribe', [NewsletterController::class, 'subscribe']);

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
    });
});
