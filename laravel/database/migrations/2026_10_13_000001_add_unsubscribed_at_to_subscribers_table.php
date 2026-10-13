<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('subscribers') && ! Schema::hasColumn('subscribers', 'unsubscribed_at')) {
            Schema::table('subscribers', function (Blueprint $table) {
                $table->timestamp('unsubscribed_at')->nullable()->after('email');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('subscribers') && Schema::hasColumn('subscribers', 'unsubscribed_at')) {
            Schema::table('subscribers', function (Blueprint $table) {
                $table->dropColumn('unsubscribed_at');
            });
        }
    }
};
