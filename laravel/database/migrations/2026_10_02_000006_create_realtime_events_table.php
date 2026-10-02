<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('realtime_events', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->enum('audience', ['admins', 'user']);
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('event_name', 48);
            $table->unsignedBigInteger('order_id')->nullable();
            $table->string('conversation_id', 64)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['audience', 'id'], 'idx_realtime_admin_stream');
            $table->index(['audience', 'user_id', 'id'], 'idx_realtime_user_stream');
            $table->index('created_at', 'idx_realtime_created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('realtime_events');
    }
};