<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AdminAlertController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PromotionController;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\SalesImportController;
use App\Http\Controllers\NewsletterController;

Route::get('products', [ProductController::class, 'index']);
Route::post('sales/import-pdf', [SalesImportController::class, 'store']);
Route::post('newsletter/subscribe', [NewsletterController::class, 'subscribe']);

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
