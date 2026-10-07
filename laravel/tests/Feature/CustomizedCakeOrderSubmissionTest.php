<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomizedCakeOrderSubmissionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('role');
            $table->string('status');
            $table->string('phone')->nullable();
        });
        Schema::create('orders', function ($table) {
            $table->id();
            $table->text('items');
            $table->decimal('subtotal', 10, 2);
            $table->decimal('delivery_fee', 10, 2);
            $table->decimal('total', 10, 2);
            $table->string('method');
            $table->date('delivery_date')->nullable();
            $table->time('delivery_time')->nullable();
            $table->string('payment');
            $table->text('address');
            $table->string('phone');
            $table->string('customer');
            $table->string('email');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('status');
            $table->timestamp('created_at')->nullable();
            $table->string('order_type')->default('Standard');
            $table->boolean('is_customized')->default(false);
        });
        Schema::create('order_items', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->string('product');
            $table->unsignedInteger('qty');
            $table->decimal('price', 10, 2);
        });
        Schema::create('notifications', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('title');
            $table->text('message');
            $table->string('type')->default('Info');
            $table->boolean('is_read')->default(false);
            $table->string('action_url')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->json('data')->nullable();
        });
        Schema::create('cake_flavors', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('slug');
            $table->boolean('active')->default(true);
        });
        Schema::create('cake_sizes', function ($table) {
            $table->id();
            $table->string('code');
            $table->string('label');
            $table->boolean('active')->default(true);
        });
        Schema::create('customized_cake_orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->string('cake_type');
            $table->string('status');
            $table->text('notes')->nullable();
            $table->text('inspo_images')->nullable();
            $table->timestamps();
        });
        Schema::create('customized_cake_tiers', function ($table) {
            $table->id();
            $table->unsignedBigInteger('customized_cake_order_id');
            $table->unsignedInteger('tier_number');
            $table->unsignedBigInteger('flavor_id');
            $table->unsignedBigInteger('size_id');
            $table->timestamps();
        });

        DB::table('users')->insert([
            ['id' => 1, 'name' => 'Customer', 'email' => 'customer@example.test', 'role' => 'customer', 'status' => 'active'],
            ['id' => 2, 'name' => 'Admin', 'email' => 'admin@example.test', 'role' => 'admin', 'status' => 'active'],
        ]);
        DB::table('cake_flavors')->insert(['id' => 1, 'name' => 'Chocolate', 'slug' => 'chocolate', 'active' => true]);
        DB::table('cake_sizes')->insert(['id' => 1, 'code' => '6x3', 'label' => '6 x 3 inch', 'active' => true]);
    }

    protected function tearDown(): void
    {
        foreach ([
            'customized_cake_tiers',
            'customized_cake_orders',
            'cake_sizes',
            'cake_flavors',
            'notifications',
            'order_items',
            'orders',
            'users',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_customer_custom_cake_request_completes_and_creates_admin_notification(): void
    {
        $customer = new User();
        $customer->id = 1;
        $customer->name = 'Customer';
        $customer->email = 'customer@example.test';
        $customer->role = 'customer';
        $customer->status = 'active';

        $this->actingAs($customer)
            ->postJson('/api/customized-cakes/order', [
                'cake_type' => 'single',
                'tiers' => [['flavor_id' => 1, 'size_id' => 1]],
                'notes' => '{"occasion":"Birthday"}',
                'reference_image' => json_encode([
                    'type' => 'example',
                    'id' => 'holiday-2',
                    'url' => 'https://pastryproject.shop/uploads/holiday(2).jpg',
                    'name' => 'Holiday Cake 2',
                ]),
            ])
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('customized_cake_orders', [
            'order_id' => 1,
            'cake_type' => 'single',
            'status' => 'pending',
        ]);
        $this->assertDatabaseHas('orders', [
            'id' => 1,
            'order_type' => 'Customized',
            'is_customized' => true,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => 2,
            'type' => 'custom_cake_order',
            'title' => 'New custom cake request #1',
        ]);

        $this->getJson('/api/orders')
            ->assertOk()
            ->assertJsonPath('orders.0.custom_details.reference_image.url', 'https://pastryproject.shop/uploads/holiday(2).jpg')
            ->assertJsonPath('orders.0.is_customized', true);
    }
}
