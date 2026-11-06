<?php

namespace Tests\Feature;

use App\Http\Controllers\StaffApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StaffOrdersApiTest extends TestCase
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
            $table->string('status')->nullable();
            $table->timestamps();
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
            $table->string('customer')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->text('address')->nullable();
            $table->text('items')->nullable();
            $table->decimal('total', 10, 2)->default(0);
            $table->string('method')->nullable();
            $table->string('payment')->nullable();
            $table->string('payment_status')->nullable();
            $table->string('paymongo_payment_id')->nullable();
            $table->string('refund_reference')->nullable();
            $table->string('refund_status')->nullable();
            $table->decimal('refund_amount', 10, 2)->nullable();
            $table->text('refund_transfer_link')->nullable();
            $table->string('status')->nullable();
            $table->string('order_type')->default('Standard');
            $table->boolean('is_customized')->default(false);
            $table->string('discount_type')->nullable();
            $table->decimal('discount', 10, 2)->default(0);
            $table->string('discount_id_path')->nullable();
            $table->string('payment_proof_path')->nullable();
            $table->string('customer_payment_reference', 100)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
        });
        Schema::create('products', function ($table) {
            $table->id();
            $table->string('category')->nullable();
        });
        Schema::create('product_sizes', function ($table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('size');
        });
        Schema::create('order_items', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('product_size_id')->nullable();
            $table->string('product')->nullable();
            $table->string('variant')->nullable();
            $table->integer('qty')->default(1);
            $table->decimal('price', 10, 2)->default(0);
            $table->text('details')->nullable();
        });
        Schema::create('custom_cake_orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->string('cake_size')->nullable();
            $table->integer('quantity')->default(1);
            $table->string('flavor')->nullable();
            $table->string('filling')->nullable();
            $table->string('frosting')->nullable();
            $table->string('occasion')->nullable();
            $table->string('theme_design')->nullable();
            $table->string('preferred_colors')->nullable();
            $table->string('tiers')->nullable();
            $table->text('dedication')->nullable();
            $table->text('notes')->nullable();
            $table->decimal('estimated_price', 10, 2)->default(0);
            $table->text('inspo_images')->nullable();
        });
        Schema::create('customized_cake_orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->string('cake_type')->default('single');
            $table->string('status')->default('pending');
            $table->text('notes')->nullable();
            $table->text('inspo_images')->nullable();
            $table->timestamps();
        });
        Schema::create('waste_log', function ($table) {
            $table->id();
            $table->dateTime('datetime');
            $table->string('item');
            $table->decimal('qty', 10, 3);
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->string('item_type')->default('Raw Material');
            $table->string('reason');
            $table->unsignedBigInteger('ingredient_id')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->unsignedBigInteger('ingredient_batch_id')->nullable();
            $table->string('unit')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('ingredients', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('unit');
        });
        Schema::create('ingredient_batches', function ($table) {
            $table->id();
            $table->string('batch_number')->nullable();
        });

        DB::table('users')->insert([
            'id' => 1,
            'name' => 'Test Admin',
            'email' => 'admin@example.com',
            'password' => 'unused',
            'role' => 'admin',
            'status' => 'active',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 1,
            'token' => 'test-admin-token',
            'expires_at' => now()->addHour(),
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('ingredient_batches');
        Schema::dropIfExists('ingredients');
        Schema::dropIfExists('waste_log');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('customized_cake_orders');
        Schema::dropIfExists('custom_cake_orders');
        Schema::dropIfExists('product_sizes');
        Schema::dropIfExists('products');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_admin_can_load_live_orders_with_items_and_payment_review_data(): void
    {
        DB::table('orders')->insert([
            'id' => 21,
            'customer' => 'Ari Customer',
            'email' => 'ari@example.com',
            'phone' => '09123456789',
            'address' => 'Manila',
            'items' => '[]',
            'total' => 450,
            'method' => 'Delivery',
            'payment' => 'GCash',
            'payment_status' => 'proof_submitted',
            'status' => 'Awaiting Payment',
            'payment_proof_path' => 'payment-proofs/order-21.jpg',
            'customer_payment_reference' => 'QRPH_ABC-123',
            'created_at' => now(),
        ]);
        DB::table('products')->insert(['id' => 3, 'category' => 'Cakes']);
        DB::table('product_sizes')->insert([
            'id' => 7,
            'product_id' => 3,
            'size' => 'Big',
        ]);
        DB::table('order_items')->insert([
            'order_id' => 21,
            'product_id' => 3,
            'product_size_id' => 7,
            'product' => 'Chocolate Cake',
            'qty' => 2,
            'price' => 225,
        ]);
        DB::table('orders')->insert([
            'id' => 22,
            'customer' => 'Unpaid Customer',
            'payment' => 'GCash',
            'payment_status' => 'pending',
            'status' => 'Awaiting Payment',
            'created_at' => now(),
        ]);

        $this->withHeader('Authorization', 'Bearer test-admin-token')
            ->getJson('/api/staff/orders')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'orders')
            ->assertJsonPath('orders.0.id', 21)
            ->assertJsonPath('orders.0.order_number', 21)
            ->assertJsonPath('orders.0.is_customized', false)
            ->assertJsonPath('orders.0.order_type', 'Standard')
            ->assertJsonPath('orders.0.has_payment_proof', true)
            ->assertJsonPath('orders.0.customer_payment_reference', 'QRPH_ABC-123')
            ->assertJsonPath('orders.0.has_payment_reference', true)
            ->assertJsonPath('orders.0.items.0.name', 'Chocolate Cake')
            ->assertJsonPath('orders.0.items.0.qty', 2)
            ->assertJsonPath('orders.0.items.0.size', 'Big');
    }

    public function test_admin_can_sync_failed_paymongo_refund_without_creating_another_refund(): void
    {
        config(['services.paymongo.secret' => 'sk_test_refund']);
        Http::fake([
            'https://api.paymongo.com/v1/refunds/ref_282' => Http::response([
                'data' => [
                    'id' => 'ref_282',
                    'attributes' => [
                        'status' => 'failed',
                        'transfer_link' => 'https://transfer.paymongo.com/expired',
                    ],
                ],
            ]),
        ]);
        DB::table('orders')->insert([
            'id' => 282,
            'user_id' => 7,
            'payment_status' => 'paid',
            'refund_reference' => 'ref_282',
            'refund_status' => 'pending',
            'refund_transfer_link' => 'https://transfer.paymongo.com/expired',
            'status' => 'Cancellation Pending',
        ]);

        $this->withHeader('X-Auth-Token', 'test-admin-token')
            ->postJson('/api/staff/orders/282/refund/status')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('refund_status', 'failed');

        $this->assertDatabaseHas('orders', [
            'id' => 282,
            'status' => 'Cancellation Pending',
            'payment_status' => 'paid',
            'refund_status' => 'failed',
            'refund_transfer_link' => null,
        ]);
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request->method() === 'GET'
            && $request->url() === 'https://api.paymongo.com/v1/refunds/ref_282');
    }

    public function test_admin_refund_sync_keeps_pending_refund_pending_and_refreshes_claim_link(): void
    {
        config(['services.paymongo.secret' => 'sk_test_refund']);
        Http::fake([
            'https://api.paymongo.com/v1/refunds/ref_283' => Http::response([
                'data' => [
                    'id' => 'ref_283',
                    'attributes' => [
                        'status' => 'refunding',
                        'transfer_link' => 'https://transfer.paymongo.com/claim-283',
                    ],
                ],
            ]),
        ]);
        DB::table('orders')->insert([
            'id' => 283,
            'user_id' => 7,
            'payment_status' => 'paid',
            'refund_reference' => 'ref_283',
            'refund_status' => 'pending',
            'status' => 'Cancellation Pending',
        ]);

        $this->withHeader('X-Auth-Token', 'test-admin-token')
            ->postJson('/api/staff/orders/283/refund/status')
            ->assertOk()
            ->assertJsonPath('refund_status', 'pending')
            ->assertJsonPath('refund_transfer_link', 'https://transfer.paymongo.com/claim-283');

        $this->assertDatabaseHas('orders', [
            'id' => 283,
            'status' => 'Cancellation Pending',
            'refund_status' => 'pending',
            'refund_transfer_link' => 'https://transfer.paymongo.com/claim-283',
        ]);
        Http::assertSentCount(1);
    }

    public function test_admin_refund_sync_checks_all_refunds_for_the_payment(): void
    {
        config(['services.paymongo.secret' => 'sk_test_refund']);
        Http::fake([
            'https://api.paymongo.com/v1/refunds*' => Http::response([
                'data' => [
                    [
                        'id' => 'ref_latest_pending',
                        'attributes' => [
                            'status' => 'processing',
                            'created_at' => 20,
                            'amount' => 103,
                            'transfer_link' => 'https://transfer.paymongo.com/claim-latest',
                        ],
                    ],
                    [
                        'id' => 'ref_failed',
                        'attributes' => ['status' => 'failed', 'created_at' => 10],
                    ],
                    [
                        'id' => 'ref_succeeded',
                        'attributes' => ['status' => 'succeeded', 'created_at' => 15],
                    ],
                ],
                'has_more' => false,
            ]),
        ]);
        DB::table('orders')->insert([
            'id' => 284,
            'user_id' => 7,
            'payment_status' => 'paid',
            'paymongo_payment_id' => 'pay_284',
            'refund_reference' => 'ref_failed',
            'refund_status' => 'failed',
            'status' => 'Cancellation Pending',
        ]);

        $response = $this->withHeader('X-Auth-Token', 'test-admin-token')
            ->postJson('/api/staff/orders/284/refund/status');
        $this->assertSame(200, $response->status(), $response->getContent());
        $response->assertJsonPath('refund_status', 'pending')
            ->assertJsonPath('refund_transfer_link', 'https://transfer.paymongo.com/claim-latest');

        $this->assertDatabaseHas('orders', [
            'id' => 284,
            'refund_reference' => 'ref_latest_pending',
            'refund_status' => 'pending',
            'refund_amount' => 1.03,
            'refund_transfer_link' => 'https://transfer.paymongo.com/claim-latest',
            'payment_status' => 'paid',
        ]);
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request->method() === 'GET'
            && str_contains($request->url(), 'pay_284'));
    }

    public function test_admin_order_response_includes_customer_payment_reference(): void
    {
        DB::table('orders')->insert([
            'id' => 24,
            'customer' => 'Reference Customer',
            'items' => '[]',
            'payment' => 'QRPh',
            'payment_status' => 'proof_submitted',
            'customer_payment_reference' => 'QRPH_ABC-123',
            'status' => 'Awaiting Payment',
            'created_at' => now(),
        ]);

        $this->withHeader('X-Auth-Token', 'test-admin-token')
            ->getJson('/api/staff/orders')
            ->assertOk()
            ->assertJsonPath('orders.0.customer_payment_reference', 'QRPH_ABC-123')
            ->assertJsonPath('orders.0.has_payment_reference', true);
    }

    public function test_admin_can_see_gcash_orders_with_paid_downpayments(): void
    {
        DB::table('orders')->insert([
            'id' => 25,
            'customer' => 'Deposit Customer',
            'payment' => 'GCash',
            'payment_status' => 'downpayment_paid',
            'status' => 'Pending',
            'created_at' => now(),
        ]);

        $this->withHeader('X-Auth-Token', 'test-admin-token')
            ->getJson('/api/staff/orders')
            ->assertOk()
            ->assertJsonPath('orders.0.id', '25')
            ->assertJsonPath('orders.0.payment_status', 'downpayment_paid');
    }

    public function test_admin_can_see_cancelled_unpaid_gcash_orders(): void
    {
        DB::table('orders')->insert([
            'id' => 23,
            'customer' => 'Cancelled Customer',
            'payment' => 'GCash',
            'payment_status' => 'pending',
            'status' => 'Cancelled',
            'created_at' => now(),
        ]);

        $response = app(StaffApiController::class)->getOrders(Request::create(
            '/api/staff/orders',
            'GET',
            [],
            [],
            [],
            ['HTTP_AUTHORIZATION' => 'Bearer test-admin-token'],
        ));

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(23, $response->getData(true)['orders'][0]['order_number']);
        $this->assertSame('Cancelled', $response->getData(true)['orders'][0]['status']);
    }

    public function test_admin_can_review_private_discount_id_but_customers_cannot(): void
    {
        Storage::fake('local');
        $path = 'discount-ids/order-44.png';
        Storage::disk('local')->put($path, 'private-id-image');
        DB::table('orders')->insert([
            'id' => 44,
            'customer' => 'Discount Customer',
            'email' => 'discount@example.com',
            'items' => '[]',
            'discount_type' => 'senior_citizen',
            'discount' => 150,
            'discount_id_path' => $path,
            'total' => 2850,
            'payment' => 'Counter',
            'status' => 'Pending',
            'created_at' => now(),
        ]);

        $this->withHeader('Authorization', 'Bearer test-admin-token')
            ->getJson('/api/staff/orders')
            ->assertOk()
            ->assertJsonPath('orders.0.has_discount_id', true)
            ->assertJsonMissingPath('orders.0.discount_id_path');

        DB::table('users')->insert([
            'id' => 2,
            'name' => 'Test Customer',
            'email' => 'customer@example.com',
            'password' => 'unused',
            'role' => 'customer',
            'status' => 'active',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 2,
            'token' => 'test-customer-token',
            'expires_at' => now()->addHour(),
        ]);

        $this->withHeader('Authorization', 'Bearer test-customer-token')
            ->get('/api/staff/orders/44/discount-id')
            ->assertForbidden();

        $this->withHeader('Authorization', 'Bearer test-admin-token')
            ->get('/api/staff/orders/44/discount-id')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertSeeText('private-id-image');
    }

    public function test_order_items_return_selected_size_for_sales_report_table(): void
    {
        DB::table('orders')->insert([
            'id' => 41,
            'items' => '[]',
            'status' => 'Completed',
            'payment' => 'Cash',
            'payment_status' => 'paid',
            'created_at' => now(),
        ]);
        DB::table('products')->insert(['id' => 4, 'category' => 'Cakes']);
        DB::table('product_sizes')->insert([
            'id' => 12,
            'product_id' => 4,
            'size' => 'Small',
        ]);
        DB::table('order_items')->insert([
            'order_id' => 41,
            'product_id' => 4,
            'product_size_id' => 12,
            'product' => 'Chocolate Cake',
            'qty' => 1,
            'price' => 490,
        ]);

        $response = app(StaffApiController::class)->getOrders(Request::create(
            '/api/staff/orders',
            'GET',
            [],
            [],
            [],
            ['HTTP_AUTHORIZATION' => 'Bearer test-admin-token'],
        ));

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Small', $response->getData(true)['orders'][0]['items'][0]['size']);
    }

    public function test_admin_can_fetch_legacy_and_new_custom_cake_request_details(): void
    {
        DB::table('orders')->insert([
            'id' => 31,
            'customer' => 'Mila Customer',
            'email' => 'mila@example.com',
            'items' => '[]',
            'total' => 1200,
            'payment' => 'QRPh',
            'payment_status' => 'paid',
            'status' => 'Preparing',
            'created_at' => now(),
        ]);
        DB::table('custom_cake_orders')->insert([
            'order_id' => 31,
            'cake_size' => '8 inches',
            'quantity' => 1,
            'flavor' => 'Vanilla',
            'occasion' => 'Birthday',
            'theme_design' => 'Ocean',
            'notes' => json_encode([
                'customer_name' => 'Mila Customer',
                'pickup_date' => '2026-10-20',
                'details' => 'Blue ocean theme',
                'quoted_total' => 1200,
            ]),
            'estimated_price' => 1200,
            'inspo_images' => json_encode(['https://example.test/ocean-cake.jpg']),
        ]);
        DB::table('customized_cake_orders')->insert([
            'order_id' => 31,
            'cake_type' => 'tiered',
            'status' => 'pending',
            'notes' => json_encode(['cake_color' => 'Blue']),
            'inspo_images' => json_encode(['https://example.test/new-ocean-cake.jpg']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->withHeader('Authorization', 'Bearer test-admin-token')
            ->getJson('/api/staff/orders?custom=1')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'orders')
            ->assertJsonPath('orders.0.id', 31)
            ->assertJsonPath('orders.0.is_customized', true)
            ->assertJsonPath('orders.0.order_type', 'Customized')
            ->assertJsonPath('orders.0.custom_details.cake_size', '8 inches')
            ->assertJsonPath('orders.0.custom_details.cake_flavor', 'Vanilla')
            ->assertJsonPath('orders.0.custom_details.cake_color', 'Blue')
            ->assertJsonPath('orders.0.custom_details.quoted_total', 1200)
            ->assertJsonPath('orders.0.custom_inspo_images.0', 'https://example.test/ocean-cake.jpg')
            ->assertJsonPath('orders.0.details', 'Blue ocean theme');
    }

    public function test_admin_can_record_order_as_waste_using_server_total_once(): void
    {
        DB::table('orders')->insert([
            'id' => 51,
            'customer' => 'Cancelled Customer',
            'items' => '[]',
            'total' => 875.50,
            'payment' => 'Cash',
            'payment_status' => 'paid',
            'status' => 'Cancelled',
            'created_at' => now(),
        ]);
        DB::table('order_items')->insert([
            'order_id' => 51,
            'product' => 'Chocolate Cake',
            'qty' => 2,
            'price' => 437.75,
        ]);

        $this->withHeader('Authorization', 'Bearer test-admin-token')
            ->postJson('/api/staff/orders/51/waste', ['total' => 1])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('already_recorded', false)
            ->assertJsonPath('entry.cost', 875.5)
            ->assertJsonPath('entry.item', 'Chocolate Cake')
            ->assertJsonPath('entry.unit', 'pcs');

        $this->withHeader('Authorization', 'Bearer test-admin-token')
            ->postJson('/api/staff/orders/51/waste')
            ->assertOk()
            ->assertJsonPath('already_recorded', true)
            ->assertJsonPath('entry.cost', 875.5);

        $this->assertDatabaseCount('waste_log', 1);
        $this->assertDatabaseHas('waste_log', [
            'item' => 'Chocolate Cake',
            'qty' => 2,
            'unit_cost' => 437.75,
            'reference_type' => 'order_waste',
            'reference_id' => 51,
            'user_id' => 1,
        ]);

        $this->withHeader('Authorization', 'Bearer test-admin-token')
            ->getJson('/api/staff/orders')
            ->assertOk()
            ->assertJsonPath('orders.0.is_wasted', true);

        DB::table('waste_log')->where('reference_type', 'order_waste')
            ->where('reference_id', 51)
            ->update(['item' => 'Order ID #51']);
        DB::table('order_items')->where('order_id', 51)->delete();
        DB::table('orders')->where('id', 51)->update([
            'items' => json_encode([[
                'name' => 'Chocolate Cake',
                'qty' => 2,
                'price' => 437.75,
            ]]),
        ]);

        $this->withHeader('Authorization', 'Bearer test-admin-token')
            ->getJson('/api/staff/inventory/waste')
            ->assertOk()
            ->assertJsonPath('entries.0.item', 'Chocolate Cake')
            ->assertJsonPath('entries.0.unit', 'pcs');
    }

    public function test_only_admin_can_record_order_as_waste(): void
    {
        DB::table('users')->insert([
            'id' => 2,
            'name' => 'Test Staff',
            'email' => 'staff@example.com',
            'password' => 'unused',
            'role' => 'staff',
            'status' => 'active',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 2,
            'token' => 'test-staff-token',
            'expires_at' => now()->addHour(),
        ]);

        $this->postJson('/api/staff/orders/51/waste')
            ->assertUnauthorized();

        $this->withHeader('Authorization', 'Bearer test-staff-token')
            ->postJson('/api/staff/orders/51/waste')
            ->assertForbidden();

        $this->assertDatabaseCount('waste_log', 0);
    }

    public function test_recording_waste_for_missing_order_returns_not_found(): void
    {
        $this->withHeader('Authorization', 'Bearer test-admin-token')
            ->postJson('/api/staff/orders/999/waste')
            ->assertNotFound()
            ->assertJsonPath('success', false);
    }
}
