<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminActivityLogCategoryFilterTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function ($table): void {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('password');
            $table->string('role');
        });
        Schema::create('user_sessions', function ($table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('token');
            $table->timestamp('expires_at')->nullable();
        });
        Schema::create('admin_activity_logs', function ($table): void {
            $table->id();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('actor_name');
            $table->string('actor_email');
            $table->string('actor_role');
            $table->string('action');
            $table->string('category');
            $table->string('subject_type')->nullable();
            $table->string('subject_id')->nullable();
            $table->string('method');
            $table->text('route');
            $table->string('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->unsignedSmallInteger('response_status');
            $table->json('details')->nullable();
            $table->timestamps();
        });

        DB::table('users')->insert([
            'id' => 1,
            'name' => 'Shop Owner',
            'email' => 'owner@example.com',
            'password' => 'unused',
            'role' => 'super_admin',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 1,
            'token' => 'owner-token',
            'expires_at' => now()->addHour(),
        ]);

        $now = now();
        foreach ([
            ['Products', 'api/staff/products'],
            ['Ingredients', 'api/staff/ingredients'],
            ['Recipe', 'api/staff/products/1/recipe'],
            ['Orders', 'api/staff/orders/1/status'],
            ['Custom Cake', 'api/staff/customized-cakes/request-status'],
            ['Inventory', 'api/staff/ingredients/1/adjust-stock'],
            ['Products', 'api/staff/customized-cakes/recipes'],
            ['Custom cakes', 'api/staff/customized-cakes/request-status'],
        ] as [$category, $route]) {
            DB::table('admin_activity_logs')->insert([
                'actor_name' => 'Admin',
                'actor_email' => 'admin@example.com',
                'actor_role' => 'admin',
                'action' => 'Test activity',
                'category' => $category,
                'method' => 'POST',
                'route' => $route,
                'response_status' => 200,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach ([
            ['System', 'api/login'],
            ['Products', 'api/staff/ingredients/sync-recipes'],
        ] as [$category, $route]) {
            DB::table('admin_activity_logs')->insert([
                'actor_name' => 'Shop Owner',
                'actor_email' => 'owner@example.com',
                'actor_role' => 'super_admin',
                'action' => $route === 'api/login' ? 'Created Login' : 'Synchronized product',
                'category' => $category,
                'method' => 'POST',
                'route' => $route,
                'response_status' => 200,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('admin_activity_logs');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_super_admin_can_filter_activity_by_the_five_categories(): void
    {
        $expectedTotals = [
            'Products' => 1,
            'Ingredients' => 2,
            'Recipe' => 2,
            'Orders' => 1,
            'Custom Cake' => 2,
        ];

        foreach ($expectedTotals as $category => $total) {
            $this->withHeader('X-Auth-Token', 'owner-token')
                ->getJson('http://localhost/api/admin-management/activity-logs?category=' . urlencode($category))
                ->assertOk()
                ->assertJsonPath('pagination.total', $total);
        }
    }

    public function test_login_and_recipe_sync_entries_are_hidden_from_the_audit_trail(): void
    {
        $this->withHeader('X-Auth-Token', 'owner-token')
            ->getJson('http://localhost/api/admin-management/activity-logs')
            ->assertOk()
            ->assertJsonPath('pagination.total', 8)
            ->assertJsonMissing(['action' => 'Created Login'])
            ->assertJsonMissing(['action' => 'Synchronized product']);
    }
}
