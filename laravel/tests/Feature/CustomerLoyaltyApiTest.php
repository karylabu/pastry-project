<?php

namespace Tests\Feature;

use App\Http\Controllers\CustomerLoyaltyController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerLoyaltyApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('loyalty_transactions');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');

        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('password');
            $table->string('role');
            $table->string('status')->nullable();
        });
        Schema::create('user_sessions', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('token');
            $table->timestamp('expires_at')->nullable();
        });
        Schema::create('orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('email')->nullable();
            $table->decimal('total', 10, 2)->default(0);
            $table->string('status');
            $table->string('payment')->nullable();
            $table->string('payment_status')->nullable();
        });

        DB::table('users')->insert([
            'id' => 7,
            'name' => 'Test Customer',
            'email' => 'customer@example.com',
            'password' => 'unused',
            'role' => 'customer',
            'status' => 'active',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 7,
            'token' => 'test-customer-token',
            'expires_at' => now()->addHour(),
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('loyalty_transactions');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_completed_paid_orders_earn_points_once(): void
    {
        DB::table('orders')->insert([
            [
                'user_id' => 7,
                'email' => 'customer@example.com',
                'total' => 250,
                'status' => 'Completed',
                'payment' => 'cash',
                'payment_status' => 'pending',
            ],
            [
                'user_id' => 7,
                'email' => 'customer@example.com',
                'total' => 2000,
                'status' => 'Completed',
                'payment' => 'gcash',
                'payment_status' => 'pending',
            ],
        ]);

        $response = $this->callLoyalty();
        $data = $response->getData(true);
        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(20, $data['balance']);
        $this->assertSame(20, $data['earned']);
        $this->assertCount(1, $data['history']);

        $this->assertSame(20, $this->callLoyalty()->getData(true)['balance']);
    }

    public function test_customer_can_redeem_one_thousand_points(): void
    {
        DB::table('orders')->insert([
            'user_id' => 7,
            'email' => 'customer@example.com',
            'total' => 10000,
            'status' => 'Completed',
            'payment' => 'cash',
            'payment_status' => 'paid',
        ]);

        $response = $this->callLoyalty('redeem', ['points' => 1000]);
        $data = $response->getData(true);
        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($data['success']);
        $this->assertSame(1000, $data['points']);

        $refreshed = $this->callLoyalty()->getData(true);
        $this->assertSame(0, $refreshed['balance']);
        $this->assertSame('5% OFF reward', $refreshed['history'][0]['label']);
    }

    public function test_loyalty_endpoints_require_customer_authentication(): void
    {
        $response = app(CustomerLoyaltyController::class)->index(Request::create('/api/loyalty', 'GET'));
        $this->assertSame(401, $response->getStatusCode());
        $this->assertFalse($response->getData(true)['success']);
    }

    private function callLoyalty(string $action = 'index', array $payload = []): JsonResponse
    {
        $request = Request::create('/api/loyalty', $action === 'redeem' ? 'POST' : 'GET', $payload, [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer test-customer-token',
        ]);

        $controller = app(CustomerLoyaltyController::class);

        return $action === 'redeem'
            ? $controller->redeem($request)
            : $controller->index($request);
    }
}
