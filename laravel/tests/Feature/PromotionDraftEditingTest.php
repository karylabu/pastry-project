<?php

namespace Tests\Feature;

use App\Mail\PromotionEmail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
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
            $table->boolean('subscribed_promo')->default(false);
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
        Schema::create('promotion_email_logs', function ($table) {
            $table->id();
            $table->unsignedBigInteger('promotion_id');
            $table->string('email');
            $table->string('status', 30);
            $table->text('error_message')->nullable();
            $table->timestamp('attempted_at')->useCurrent();
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
        Schema::dropIfExists('promotion_email_logs');
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

    public function test_admin_can_send_a_saved_draft_to_subscribed_customers(): void
    {
        Mail::fake();
        $promotionId = $this->createPromotion('draft');
        DB::table('users')->insert([
            'id' => 2,
            'name' => 'Subscribed Customer',
            'email' => 'customer@example.com',
            'password' => 'unused',
            'role' => 'customer',
            'subscribed_promo' => true,
        ]);

        $this->withHeader('X-Auth-Token', 'admin-token')
            ->postJson("/api/admin/promotions/{$promotionId}/send")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.recipient_count', 1)
            ->assertJsonPath('data.sent_count', 1)
            ->assertJsonPath('data.failed_count', 0)
            ->assertJsonPath('data.promotion.status', 'sent');

        Mail::assertSent(PromotionEmail::class, 1);
        $this->assertDatabaseHas('promotion_email_logs', [
            'promotion_id' => $promotionId,
            'email' => 'customer@example.com',
            'status' => 'sent',
        ]);
        $this->assertDatabaseHas('promotions', [
            'id' => $promotionId,
            'status' => 'sent',
            'sent_count' => 1,
            'failed_count' => 0,
        ]);
    }

    public function test_admin_cannot_send_a_promotion_that_is_not_a_draft(): void
    {
        Mail::fake();
        $promotionId = $this->createPromotion('sent');

        $this->withHeader('X-Auth-Token', 'admin-token')
            ->postJson("/api/admin/promotions/{$promotionId}/send")
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        Mail::assertNothingSent();
        $this->assertDatabaseHas('promotions', [
            'id' => $promotionId,
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