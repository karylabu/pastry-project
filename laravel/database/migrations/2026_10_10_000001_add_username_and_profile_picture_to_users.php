<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        if (!Schema::hasColumn('users', 'username')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('username', 100)->nullable();
            });
        }

        if (!Schema::hasColumn('users', 'profile_picture') && !Schema::hasColumn('users', 'profile_image')) {
            Schema::table('users', function (Blueprint $table) {
                $table->text('profile_picture')->nullable();
            });
        }
    }

    public function down(): void
    {
        // Keep profile data intact if this migration is rolled back.
    }
};
