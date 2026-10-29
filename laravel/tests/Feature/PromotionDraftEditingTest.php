<?php

namespace Tests\Feature;

use App\Mail\PromotionEmail;
use App\Models\Subscriber;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class PromotionDraftEditingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config()->set('app.url', 'http://localhost');
        URL::forceRootUrl('http://localhost');

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
            $table->decimal('discount_percent', 5, 2)->nullable();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('status', 30)->default('draft');
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->timestamps();
        });
        Schema::create('promotion_email_logs', function ($table) {
            $table->id();
            $table->foreignId('promotion_id')->constrained()->cascadeOnDelete();
            $table->string('email');
            $table->string('status', 30);
            $table->text('error_message')->nullable();
            $table->timestamp('attempted_at')->useCurrent();
        });
        Schema::create('admin_recycle_bin', function ($table) {
            $table->id();
            $table->string('item_type', 40);
            $table->string('label', 255);
            $table->longText('payload');
            $table->timestamp('deleted_at');
            $table->timestamp('expires_at')->index();
            $table->timestamps();
        });
        Schema::create('subscribers', function ($table) {
            $table->id();
            $table->string('email')->unique();
            $table->timestamp('unsubscribed_at')->nullable();
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
        Schema::dropIfExists('promotion_email_logs');
        Schema::dropIfExists('admin_recycle_bin');
        Schema::dropIfExists('promotions');
        Schema::dropIfExists('subscribers');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_admin_can_edit_a_draft_without_sending_it(): void
    {
        $promotionId = $this->createPromotion('draft');

        $this->withHeader('Authorization', 'Bearer admin-token')
            ->postJson("http://localhost/api/admin/promotions/{$promotionId}", [
                'title' => 'Updated draft',
                'message' => 'New draft copy',
                'coupon_code' => 'SAVE20',
                'discount_percent' => 20,
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
            'discount_percent' => 20,
            'status' => 'draft',
        ]);
    }

    public function test_admin_can_edit_a_sent_promotion(): void
    {
        $promotionId = $this->createPromotion('sent');

        $this->withHeader('Authorization', 'Bearer admin-token')
            ->postJson("http://localhost/api/admin/promotions/{$promotionId}", [
                'title' => 'Changed sent campaign',
                'message' => 'Updated campaign copy',
                'starts_at' => '2026-10-10 09:00:00',
                'ends_at' => '2026-10-12 18:00:00',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.title', 'Changed sent campaign');

        $this->assertDatabaseHas('promotions', [
            'id' => $promotionId,
            'title' => 'Changed sent campaign',
            'status' => 'sent',
        ]);
    }

    public function test_admin_can_move_a_promotion_and_its_delivery_history_to_the_recycle_bin(): void
    {
        $promotionId = $this->createPromotion('sent');
        $logId = DB::table('promotion_email_logs')->insertGetId([
            'promotion_id' => $promotionId,
            'email' => 'customer@example.com',
            'status' => 'sent',
            'attempted_at' => now(),
        ]);

        $this->withHeader('X-Auth-Token', 'admin-token')
            ->deleteJson("/api/admin/promotions/{$promotionId}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('promotions', ['id' => $promotionId]);
        $this->assertDatabaseMissing('promotion_email_logs', ['id' => $logId]);
        $this->assertDatabaseHas('admin_recycle_bin', ['item_type' => 'promotion', 'label' => 'Original campaign']);

        $entryId = (int) DB::table('admin_recycle_bin')->value('id');
        app(\App\Services\AdminRecycleBinService::class)->restore($entryId);

        $this->assertDatabaseHas('promotions', ['id' => $promotionId, 'title' => 'Original campaign']);
        $this->assertDatabaseHas('promotion_email_logs', ['id' => $logId, 'promotion_id' => $promotionId]);
    }

    public function test_draft_coupon_requires_a_discount_percent(): void
    {
        $promotionId = $this->createPromotion('draft');

        $this->withHeader('X-Auth-Token', 'admin-token')
            ->postJson("http://localhost/api/admin/promotions/{$promotionId}", [
                'title' => 'Updated draft',
                'message' => 'New draft copy',
                'coupon_code' => 'SAVE20',
                'starts_at' => '2026-10-10 09:00:00',
                'ends_at' => '2026-10-12 18:00:00',
            ])
            ->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('promotions', [
            'id' => $promotionId,
            'coupon_code' => null,
            'discount_percent' => null,
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
            ->postJson("http://localhost/api/admin/promotions/{$promotionId}/send")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.recipient_count', 1)
            ->assertJsonPath('data.sent_count', 1)
            ->assertJsonPath('data.failed_count', 0)
            ->assertJsonPath('data.promotion.status', 'sent');

        Mail::assertSent(PromotionEmail::class, function (PromotionEmail $mail) {
            return $mail->recipient->id === 2;
        });
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

    public function test_admin_sends_promotions_to_active_footer_subscribers_without_duplicate_emails(): void
    {
        Mail::fake();
        $promotionId = $this->createPromotion('draft');
        DB::table('users')->insert([
            'id' => 2,
            'name' => 'Newsletter Customer',
            'email' => 'reader@example.com',
            'password' => 'unused',
            'role' => 'customer',
            'subscribed_promo' => true,
        ]);
        DB::table('subscribers')->insert([
            [
                'email' => 'reader@example.com',
                'unsubscribed_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'email' => 'guest@example.com',
                'unsubscribed_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'email' => 'unsubscribed@example.com',
                'unsubscribed_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->withHeader('X-Auth-Token', 'admin-token')
            ->postJson("http://localhost/api/admin/promotions/{$promotionId}/send")
            ->assertOk()
            ->assertJsonPath('data.recipient_count', 2)
            ->assertJsonPath('data.sent_count', 2)
            ->assertJsonPath('data.failed_count', 0);

        Mail::assertSent(PromotionEmail::class, 2);
        Mail::assertSent(PromotionEmail::class, function (PromotionEmail $mail) {
            return $mail->recipient instanceof Subscriber
                && $mail->recipient->email === 'guest@example.com';
        });
        $this->assertDatabaseHas('promotion_email_logs', [
            'promotion_id' => $promotionId,
            'email' => 'reader@example.com',
            'status' => 'sent',
        ]);
        $this->assertDatabaseMissing('promotion_email_logs', [
            'promotion_id' => $promotionId,
            'email' => 'unsubscribed@example.com',
        ]);
    }

    public function test_admin_cannot_send_a_promotion_that_is_not_a_draft(): void
    {
        Mail::fake();
        $promotionId = $this->createPromotion('sent');

        $this->withHeader('X-Auth-Token', 'admin-token')
            ->postJson("http://localhost/api/admin/promotions/{$promotionId}/send")
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        Mail::assertNothingSent();
        $this->assertDatabaseHas('promotions', [
            'id' => $promotionId,
            'status' => 'sent',
        ]);
    }

    public function test_customer_can_unsubscribe_from_promotional_emails(): void
    {
        DB::table('users')->insert([
            'id' => 2,
            'name' => 'Subscribed Customer',
            'email' => 'customer@example.com',
            'password' => 'unused',
            'role' => 'customer',
            'subscribed_promo' => true,
        ]);

        $url = URL::signedRoute('promotions.unsubscribe', [
            'token' => Crypt::encryptString('2'),
        ]);

        $this->get($url)
            ->assertOk()
            ->assertSee('Confirm unsubscribe')
            ->assertSee('promotional emails');
        $this->assertDatabaseHas('users', [
            'id' => 2,
            'subscribed_promo' => true,
        ]);

        $this->post($url, ['unsubscribe' => '1'])
            ->assertOk()
            ->assertSee('You will no longer receive promotional emails.');

        $this->assertDatabaseHas('users', [
            'id' => 2,
            'subscribed_promo' => false,
        ]);

        Mail::fake();
        $promotionId = $this->createPromotion('draft');
        $this->withHeader('X-Auth-Token', 'admin-token')
            ->postJson("http://localhost/api/admin/promotions/{$promotionId}/send")
            ->assertOk()
            ->assertJsonPath('data.recipient_count', 0)
            ->assertJsonPath('data.sent_count', 0);

        Mail::assertNothingSent();
    }

    public function test_invalid_unsubscribe_link_does_not_change_subscription(): void
    {
        DB::table('users')->insert([
            'id' => 2,
            'name' => 'Subscribed Customer',
            'email' => 'customer@example.com',
            'password' => 'unused',
            'role' => 'customer',
            'subscribed_promo' => true,
        ]);

        $url = URL::signedRoute('promotions.unsubscribe', [
            'token' => Crypt::encryptString('2'),
        ]);
        $tamperedUrl = $url . '&tampered=1';

        $this->post($tamperedUrl)
            ->assertForbidden();

        $this->assertDatabaseHas('users', [
            'id' => 2,
            'subscribed_promo' => true,
        ]);
    }

    public function test_footer_subscriber_can_unsubscribe_from_promotional_emails(): void
    {
        $subscriberId = DB::table('subscribers')->insertGetId([
            'email' => 'reader@example.com',
            'unsubscribed_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $url = URL::signedRoute('promotions.unsubscribe', [
            'token' => Crypt::encryptString('subscriber:' . $subscriberId),
        ]);

        $this->get($url)
            ->assertOk()
            ->assertSee('Confirm unsubscribe');

        $this->post($url, ['unsubscribe' => '1'])
            ->assertOk()
            ->assertSee('You will no longer receive promotional emails.');

        $this->assertDatabaseHas('subscribers', [
            'id' => $subscriberId,
        ]);
        $this->assertNotNull(DB::table('subscribers')->where('id', $subscriberId)->value('unsubscribed_at'));

        Mail::fake();
        $promotionId = $this->createPromotion('draft');
        $this->withHeader('X-Auth-Token', 'admin-token')
            ->postJson("http://localhost/api/admin/promotions/{$promotionId}/send")
            ->assertOk()
            ->assertJsonPath('data.recipient_count', 0);

        Mail::assertNothingSent();
    }

    private function createPromotion(string $status): int
    {
        return DB::table('promotions')->insertGetId([
            'title' => 'Original campaign',
            'description' => 'Original copy',
            'coupon_code' => null,
            'discount_percent' => null,
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