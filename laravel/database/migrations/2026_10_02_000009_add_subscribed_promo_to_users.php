<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'subscribed_promo')) {
            Schema::table('users', function (Blueprint $table) {
                $table->boolean('subscribed_promo')->default(false);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('users') && Schema::hasColumn('users', 'subscribed_promo')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('subscribed_promo');
            });
        }
    }
};