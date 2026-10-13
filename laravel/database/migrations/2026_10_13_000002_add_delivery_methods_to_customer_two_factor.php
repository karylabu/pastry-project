<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_two_factor', function (Blueprint $table) {
            if (! Schema::hasColumn('customer_two_factor', 'method')) {
                $table->string('method', 20)->default('authenticator');
            }
            if (! Schema::hasColumn('customer_two_factor', 'pending_method')) {
                $table->string('pending_method', 20)->nullable();
            }
            if (! Schema::hasColumn('customer_two_factor', 'pending_code_hash')) {
                $table->string('pending_code_hash')->nullable();
            }
            if (! Schema::hasColumn('customer_two_factor', 'management_code_hash')) {
                $table->string('management_code_hash')->nullable();
            }
            if (! Schema::hasColumn('customer_two_factor', 'management_code_expires_at')) {
                $table->timestamp('management_code_expires_at')->nullable();
            }
        });

        Schema::table('customer_two_factor_login_challenges', function (Blueprint $table) {
            if (! Schema::hasColumn('customer_two_factor_login_challenges', 'code_hash')) {
                $table->string('code_hash')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('customer_two_factor_login_challenges', function (Blueprint $table) {
            if (Schema::hasColumn('customer_two_factor_login_challenges', 'code_hash')) {
                $table->dropColumn('code_hash');
            }
        });

        Schema::table('customer_two_factor', function (Blueprint $table) {
            foreach ([
                'method',
                'pending_method',
                'pending_code_hash',
                'management_code_hash',
                'management_code_expires_at',
            ] as $column) {
                if (Schema::hasColumn('customer_two_factor', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
