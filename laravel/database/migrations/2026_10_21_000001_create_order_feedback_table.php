<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('order_feedback')) {
            return;
        }

        Schema::create('order_feedback', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedTinyInteger('rating');
            $table->string('comment', 1000)->default('');
            $table->timestamps();
            $table->unique(['order_id', 'user_id'], 'unique_order_feedback');
            $table->index('order_id', 'idx_feedback_order');
            $table->index('user_id', 'idx_feedback_user');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_feedback');
    }
};
