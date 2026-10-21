<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('order_return_refund_requests')) {
            Schema::create('order_return_refund_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('order_id')->unique();
                $table->unsignedBigInteger('customer_id');
                $table->text('reason');
                $table->string('status')->default('Pending Review');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('order_return_refund_requests');
    }
};
