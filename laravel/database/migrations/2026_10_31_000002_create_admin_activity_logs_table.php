<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('admin_activity_logs')) {
            return;
        }

        Schema::create('admin_activity_logs', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('actor_name');
            $table->string('actor_email');
            $table->string('actor_role', 40);
            $table->string('action');
            $table->string('category', 80);
            $table->string('subject_type', 120)->nullable();
            $table->string('subject_id', 100)->nullable();
            $table->string('method', 10);
            $table->text('route');
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->unsignedSmallInteger('response_status');
            $table->json('details')->nullable();
            $table->timestamps();

            $table->index('created_at');
            $table->index(['category', 'created_at']);
            $table->index(['actor_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_activity_logs');
    }
};
