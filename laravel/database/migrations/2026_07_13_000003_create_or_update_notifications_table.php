<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')
                    ->nullable()
                    ->constrained('users')
                    ->cascadeOnDelete();
                $table->string('type', 50)->default('info');
                $table->string('title', 150);
                $table->text('message');
                $table->json('data')->nullable();
                $table->string('action_url', 255)->nullable();
                $table->timestamp('read_at')->nullable();
                $table->timestamps();

                $table->index(['user_id', 'read_at'], 'idx_notifications_user_read');
                $table->index('type', 'idx_notifications_type');
            });

            return;
        }

        if (!Schema::hasColumn('notifications', 'data')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->json('data')->nullable()->after('message');
            });
        }

        if (!Schema::hasColumn('notifications', 'action_url')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->string('action_url', 255)->nullable()->after('data');
            });
        }

        if (!Schema::hasColumn('notifications', 'read_at')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->timestamp('read_at')->nullable()->after('message');
            });
        }

        if (!Schema::hasColumn('notifications', 'updated_at')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->timestamp('updated_at')->nullable()->after('created_at');
            });
        }

        if (Schema::hasColumn('notifications', 'user_id')) {
            try {
                DB::statement('ALTER TABLE notifications MODIFY COLUMN user_id INT NULL');
            } catch (\Exception $e) {
                // The column may already be nullable or require DBAL; ignore if an alternate schema is present.
            }
        }

        if (!Schema::hasColumn('notifications', 'idx_notifications_user_read')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->index(['user_id', 'read_at'], 'idx_notifications_user_read');
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('notifications')) {
            return;
        }

        Schema::table('notifications', function (Blueprint $table) {
            if (Schema::hasColumn('notifications', 'data')) {
                $table->dropColumn('data');
            }

            if (Schema::hasColumn('notifications', 'action_url')) {
                $table->dropColumn('action_url');
            }

            if (Schema::hasColumn('notifications', 'read_at')) {
                $table->dropColumn('read_at');
            }

            if (Schema::hasColumn('notifications', 'updated_at')) {
                $table->dropColumn('updated_at');
            }

            if (Schema::hasColumn('notifications', 'idx_notifications_user_read')) {
                $table->dropIndex('idx_notifications_user_read');
            }
        });
    }
};