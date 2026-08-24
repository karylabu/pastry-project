<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('admin_alerts')) {
            Schema::create('admin_alerts', function (Blueprint $table) {
                $table->id();
                $table->integer('user_id')->nullable();
                $table->foreign('user_id')
                    ->references('id')
                    ->on('users')
                    ->cascadeOnDelete();
                $table->string('type', 50)->default('info');
                $table->string('title', 150);
                $table->text('message');
                $table->json('data')->nullable();
                $table->string('action_url', 255)->nullable();
                $table->boolean('is_read')->default(false);
                $table->timestamp('read_at')->nullable();
                $table->timestamps();

                $table->index(['user_id', 'read_at'], 'idx_admin_alerts_user_read');
                $table->index('type', 'idx_admin_alerts_type');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_alerts');
    }
};
