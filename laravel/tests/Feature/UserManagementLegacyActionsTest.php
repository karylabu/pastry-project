<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserManagementLegacyActionsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('role');
            $table->string('status')->default('active');
        });

        DB::table('users')->insert([
            ['id' => 1, 'name' => 'Admin', 'email' => 'admin@example.com', 'role' => 'admin', 'status' => 'active'],
            ['id' => 2, 'name' => 'Customer', 'email' => 'customer@example.com', 'role' => 'customer', 'status' => 'active'],
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_admin_can_update_a_user_status(): void
    {
        $admin = new User();
        $admin->role = 'admin';

        $this->actingAs($admin)
            ->postJson('/api_users.php', ['action' => 'status', 'user_id' => 2, 'status' => 'inactive'])
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('users', ['id' => 2, 'status' => 'inactive']);
    }

    public function test_admin_delete_action_deactivates_instead_of_removing_user(): void
    {
        $admin = new User();
        $admin->role = 'admin';

        $this->actingAs($admin)
            ->postJson('/api_users.php', ['action' => 'delete', 'user_id' => 2])
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('users', ['id' => 2, 'status' => 'inactive']);
    }

    public function test_status_action_rejects_invalid_values(): void
    {
        $admin = new User();
        $admin->role = 'admin';

        $this->actingAs($admin)
            ->postJson('/api_users.php', ['action' => 'status', 'user_id' => 2, 'status' => 'deleted'])
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }
}