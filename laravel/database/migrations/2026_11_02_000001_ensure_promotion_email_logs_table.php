<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('promotions')) {
            throw new RuntimeException('Cannot create promotion email logs before the promotions table exists.');
        }

        if (! Schema::hasTable('promotion_email_logs')) {
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
        // The table may have existed before this repair migration.
    }
};
