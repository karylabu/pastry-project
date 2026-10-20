<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shop_settings', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->json('settings');
            $table->timestamps();
        });

        DB::table('shop_settings')->insert([
            'id' => 1,
            'settings' => json_encode([
                'shopName' => 'Pastry Project',
                'shopEmail' => '',
                'shopPhone' => '',
                'shopAddress' => '',
                'openingHours' => '08:00 - 20:00',
                'minimumOrder' => '0',
                'preparationTime' => '30',
                'lowStockThreshold' => '5',
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Schema::create('admin_notification_preferences', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->primary();
            $table->boolean('order_alerts')->default(true);
            $table->boolean('low_stock_alerts')->default(true);
            $table->boolean('message_alerts')->default(true);
            $table->boolean('promotion_alerts')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_notification_preferences');
        Schema::dropIfExists('shop_settings');
    }
};
