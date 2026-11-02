<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('customer_registration_phone_verifications')) {
            Schema::create('customer_registration_phone_verifications', function (Blueprint $table) {
                $table->char('id', 64)->primary();
                $table->string('phone');
                $table->string('phone_normalized', 20)->index();
                $table->string('code_hash');
                $table->unsignedTinyInteger('attempts')->default(0);
                $table->timestamp('expires_at')->index();
                $table->timestamp('verified_at')->nullable();
                $table->timestamp('consumed_at')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_registration_phone_verifications');
    }
};
