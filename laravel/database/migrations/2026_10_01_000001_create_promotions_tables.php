<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('promotions')) {
            Schema::create('promotions', function (Blueprint $table) {
                $table->id();
                $table->string('title', 150);
                $table->text('description');
                $table->string('image_url')->nullable();
                $table->string('coupon_code', 50)->nullable();
                $table->dateTime('starts_at');
                $table->dateTime('ends_at');
                $table->string('status', 30)->default('draft');
                $table->unsignedInteger('sent_count')->default(0);
                $table->unsignedInteger('failed_count')->default(0);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('promotion_email_logs')) {
            Schema::create('promotion_email_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('promotion_id')->constrained('promotions')->cascadeOnDelete();
                $table->string('email');
                $table->string('status', 30);
                $table->text('error_message')->nullable();
                $table->timestamp('attempted_at')->useCurrent();

                $table->index(['promotion_id', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_email_logs');
        Schema::dropIfExists('promotions');
    }
};