<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PromotionDraftEditingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('password');
            $table->string('role');
        });
        Schema::create('user_sessions', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('token');
            $table->timestamp('expires_at')->nullable();
        });
        Schema::create('promotions', function ($table) {
            $table->id();
            $table->string('title', 150);
            $table->text('description');
            $table->string('image_url')->nullable();
            $table->string('coupon_code', 50)->nullable();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('status', 30)->default('draft');
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->timestamps();
        });

        DB::table('users')->insert([
            'id' => 1,
            'name' => 'Admin User',
            'email' => 'admin@example.com',
            'password' => 'unused',
            'role' => 'admin',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 1,
            'token' => 'admin-token',
            'expires_at' => now()->addHour(),
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('promotions');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_admin_can_edit_a_draft_without_sending_it(): void
    {
        $promotionId = $this->createPromotion('draft');

        $this->withHeader('Authorization', 'Bearer admin-token')
            ->postJson("/api/admin/promotions/{$promotionId}", [
                'title' => 'Updated draft',
                'message' => 'New draft copy',
                'coupon_code' => 'SAVE20',
                'starts_at' => '2026-10-10 09:00:00',
                'ends_at' => '2026-10-12 18:00:00',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.title', 'Updated draft');

        $this->assertDatabaseHas('promotions', [
            'id' => $promotionId,
            'title' => 'Updated draft',
            'description' => 'New draft copy',
            'coupon_code' => 'SAVE20',
            'status' => 'draft',
        ]);
    }

    public function test_admin_cannot_edit_a_sent_promotion(): void
    {
        $promotionId = $this->createPromotion('sent');

        $this->withHeader('Authorization', 'Bearer admin-token')
            ->postJson("/api/admin/promotions/{$promotionId}", [
                'title' => 'Changed sent campaign',
                'message' => 'Should remain unchanged',
                'starts_at' => '2026-10-10 09:00:00',
                'ends_at' => '2026-10-12 18:00:00',
            ])
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('promotions', [
            'id' => $promotionId,
            'title' => 'Original campaign',
            'status' => 'sent',
        ]);
    }

    private function createPromotion(string $status): int
    {
        return DB::table('promotions')->insertGetId([
            'title' => 'Original campaign',
            'description' => 'Original copy',
            'coupon_code' => null,
            'starts_at' => '2026-10-10 09:00:00',
            'ends_at' => '2026-10-12 18:00:00',
            'status' => $status,
            'sent_count' => 0,
            'failed_count' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}