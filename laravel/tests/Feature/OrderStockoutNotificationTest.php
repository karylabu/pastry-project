<?php

namespace Tests\Feature;

use App\Http\Controllers\OrderController;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OrderStockoutNotificationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->text('items')->nullable();
            $table->string('status');
        });
        Schema::create('products', function ($table) {
            $table->id();
            $table->string('name');
            $table->decimal('stock', 10, 2)->default(0);
        });
        Schema::create('notifications', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('title');
            $table->text('message');
            $table->string('type');
            $table->boolean('is_read')->default(false);
            $table->string('action_url')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        DB::table('orders')->insert([
            'id' => 42,
            'user_id' => 7,
            'items' => json_encode([['id' => 3, 'qty' => 2]]),
            'status' => 'Pending',
        ]);
        DB::table('products')->insert([
            'id' => 3,
            'name' => 'Celebration Cake',
            'stock' => 0,
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('products');
        Schema::dropIfExists('orders');

        parent::tearDown();
    }

    public function test_order_stock_shortage_notifies_customer_without_cancelling_order(): void
    {
        $admin = new User();
        $admin->id = 99;
        $admin->role = 'admin';
        $admin->status = 'active';
        $this->actingAs($admin);

        $response = app(OrderController::class)->updateStatus(
            Request::create('/orders/42/status', 'PUT', ['status' => 'Confirmed']),
            42
        );

        $this->assertSame(409, $response->getStatusCode());
        $this->assertDatabaseHas('orders', ['id' => 42, 'status' => 'Pending']);
        $this->assertDatabaseHas('notifications', [
            'user_id' => 7,
            'title' => 'Stockout Alert',
            'type' => 'Warning',
            'action_url' => '/customer/orders',
        ]);
        $this->assertDatabaseMissing('notifications', ['title' => 'Order Confirmed']);
    }
}
