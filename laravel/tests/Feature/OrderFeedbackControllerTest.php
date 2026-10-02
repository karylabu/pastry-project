<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OrderFeedbackControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('email');
        });
        Schema::create('order_feedback', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedTinyInteger('rating');
            $table->string('comment', 1000)->default('');
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        DB::table('users')->insert(['id' => 7, 'name' => 'Test Customer', 'email' => 'customer@example.com']);
        DB::table('order_feedback')->insert([
            'order_id' => 42,
            'user_id' => 7,
            'rating' => 5,
            'comment' => 'Excellent cake.',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('order_feedback');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_admin_can_view_reviews_with_customer_details(): void
    {
        $admin = new User();
        $admin->role = 'admin';

        $this->actingAs($admin)
            ->getJson('/api/admin/reviews')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('reviews.0.customer_name', 'Test Customer')
            ->assertJsonPath('reviews.0.order_id', 42)
            ->assertJsonPath('reviews.0.rating', 5);
    }

    public function test_non_admin_cannot_view_reviews(): void
    {
        $customer = new User();
        $customer->role = 'customer';

        $this->actingAs($customer)->getJson('/api/admin/reviews')->assertForbidden();
    }

    public function test_unauthenticated_request_cannot_view_reviews(): void
    {
        $this->getJson('/api/admin/reviews')->assertUnauthorized();
    }
}