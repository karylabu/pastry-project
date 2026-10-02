<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomCakeBalancePaymentTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('status');
            $table->decimal('total', 10, 2);
            $table->decimal('downpayment_amount', 10, 2)->nullable();
            $table->string('payment');
            $table->string('payment_status')->default('pending');
            $table->string('payment_reference')->nullable();
            $table->string('payment_link')->nullable();
            $table->boolean('is_customized')->default(true);
            $table->string('order_type')->default('Customized');
        });
        Schema::create('custom_cake_orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->text('notes')->nullable();
        });

        putenv('PAYMONGO_SECRET=sk_test_balance_flow');
        $_ENV['PAYMONGO_SECRET'] = 'sk_test_balance_flow';
        Http::fake([
            'https://api.paymongo.com/v1/payment_links' => Http::response([
                'data' => ['id' => 'plink_balance_test', 'url' => 'https://checkout.example.test/balance'],
            ], 200),
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('custom_cake_orders');
        Schema::dropIfExists('orders');
        putenv('PAYMONGO_SECRET');
        unset($_ENV['PAYMONGO_SECRET']);

        parent::tearDown();
    }

    public function test_balance_link_uses_server_calculated_remaining_amount(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 24,
            'user_id' => 9,
            'status' => 'Awaiting Balance Payment',
            'total' => 2000,
            'downpayment_amount' => 1250,
            'payment' => 'QRPh',
            'payment_status' => 'pending',
            'is_customized' => true,
            'order_type' => 'Customized',
        ]);
        \Illuminate\Support\Facades\DB::table('custom_cake_orders')->insert(['order_id' => 24]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/create_payment.php', [
                'order_id' => 24,
                'amount' => 1,
                'payment_type' => 'balance',
                'payment_method' => 'QRPh',
            ])
            ->assertOk()
            ->assertJsonPath('data.url', 'https://checkout.example.test/balance');

        Http::assertSent(fn (ClientRequest $request) =>
            $request->url() === 'https://api.paymongo.com/v1/payment_links'
            && $request['amount'] === 75000
            && str_contains($request['description'], 'Remaining Balance')
        );
    }

    public function test_balance_link_is_rejected_outside_balance_payment_status(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 25,
            'user_id' => 9,
            'status' => 'Preparing',
            'total' => 2000,
            'downpayment_amount' => 1250,
            'payment' => 'QRPh',
            'payment_status' => 'paid',
            'is_customized' => true,
            'order_type' => 'Customized',
        ]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/create_payment.php', ['order_id' => 25, 'payment_type' => 'balance'])
            ->assertStatus(409);

        Http::assertNothingSent();
    }

    public function test_balance_link_recovers_deposit_from_legacy_custom_order_notes(): void
    {
        \Illuminate\Support\Facades\DB::table('orders')->insert([
            'id' => 26,
            'user_id' => 9,
            'status' => 'Awaiting Balance Payment',
            'total' => 2000,
            'downpayment_amount' => null,
            'payment' => 'QRPh',
            'payment_status' => 'pending',
            'is_customized' => true,
            'order_type' => 'Customized',
        ]);
        \Illuminate\Support\Facades\DB::table('custom_cake_orders')->insert([
            'order_id' => 26,
            'notes' => json_encode(['downpayment_amount' => 1250]),
        ]);

        $customer = new User();
        $customer->id = 9;
        $customer->role = 'customer';

        $this->actingAs($customer)
            ->postJson('/create_payment.php', ['order_id' => 26, 'payment_type' => 'balance'])
            ->assertOk();

        $this->assertDatabaseHas('orders', ['id' => 26, 'downpayment_amount' => 1250]);
        Http::assertSent(fn (ClientRequest $request) => $request['amount'] === 75000);
    }
}