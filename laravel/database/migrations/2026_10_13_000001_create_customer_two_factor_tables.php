<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_two_factor')) {
            Schema::create('customer_two_factor', function (Blueprint $table) {
                $table->unsignedBigInteger('user_id')->primary();
                $table->text('secret')->nullable();
                $table->text('pending_secret')->nullable();
                $table->timestamp('pending_expires_at')->nullable();
                $table->timestamp('enabled_at')->nullable();
                $table->unsignedBigInteger('last_counter')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('customer_two_factor_recovery_codes')) {
            Schema::create('customer_two_factor_recovery_codes', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('code_hash');
                $table->timestamp('created_at')->nullable();
            });
        }

        if (! Schema::hasTable('customer_two_factor_login_challenges')) {
            Schema::create('customer_two_factor_login_challenges', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->index();
                $table->char('token_hash', 64)->unique();
                $table->timestamp('expires_at')->index();
                $table->unsignedTinyInteger('attempts')->default(0);
                $table->timestamp('used_at')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_two_factor_login_challenges');
        Schema::dropIfExists('customer_two_factor_recovery_codes');
        Schema::dropIfExists('customer_two_factor');
    }
};
