<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customized_cake_inventory_consumptions')) {
            return;
        }

        Schema::create('customized_cake_inventory_consumptions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('customized_cake_order_id');
            $table->unsignedBigInteger('order_id')->nullable();
            $table->string('status')->default('consumed');
            $table->longText('summary')->nullable();
            $table->timestamps();

            $table->unique('customized_cake_order_id', 'custom_cake_consumption_order_unique');
            $table->index('order_id', 'custom_cake_consumption_order_id_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customized_cake_inventory_consumptions');
    }
};
