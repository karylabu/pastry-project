<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class CustomerChatApiTest extends TestCase
{
    private string|false $previousAiProvider;
    private ?string $uploadedChatPath = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->previousAiProvider = getenv('AI_PROVIDER');
        putenv('AI_PROVIDER=none');
        $_ENV['AI_PROVIDER'] = 'none';

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
        Schema::create('orders', function ($table) {
            $table->id();
            $table->string('status')->nullable();
            $table->decimal('total', 10, 2)->default(0);
            $table->string('method')->nullable();
            $table->string('address')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->text('items')->nullable();
        });
        Schema::create('messages', function ($table) {
            $table->increments('id');
            $table->foreignId('order_id')->nullable()->constrained('orders')->cascadeOnDelete();
            $table->string('sender');
            $table->text('message');
            $table->boolean('is_read')->default(false);
            $table->timestamp('created_at')->useCurrent();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('customer_name')->nullable();
            $table->string('customer_email')->nullable();
            $table->string('image_path')->nullable();
        });
        Schema::create('products', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('category')->nullable();
            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('meal_price', 10, 2)->default(0);
            $table->decimal('combo_price', 10, 2)->default(0);
            $table->integer('stock')->default(0);
            $table->boolean('available')->default(true);
        });

        DB::table('users')->insert([
            'id' => 7,
            'name' => 'Test Customer',
            'email' => 'customer@example.com',
            'password' => 'unused',
            'role' => 'customer',
        ]);
        DB::table('users')->insert([
            'id' => 9,
            'name' => 'Test Admin',
            'email' => 'admin@example.com',
            'password' => 'unused',
            'role' => 'admin',
        ]);
        DB::table('user_sessions')->insert([
            [
                'user_id' => 7,
                'token' => 'test-customer-token',
                'expires_at' => now()->addHour(),
            ],
            [
                'user_id' => 9,
                'token' => 'test-admin-token',
                'expires_at' => now()->addHour(),
            ],
        ]);
    }

    protected function tearDown(): void
    {
        if ($this->uploadedChatPath) {
            $uploadedFile = public_path($this->uploadedChatPath);
            if (is_file($uploadedFile)) {
                unlink($uploadedFile);
            }
        }
        Schema::dropIfExists('products');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('messages');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');

        if ($this->previousAiProvider === false) {
            putenv('AI_PROVIDER');
            unset($_ENV['AI_PROVIDER']);
        } else {
            putenv('AI_PROVIDER=' . $this->previousAiProvider);
            $_ENV['AI_PROVIDER'] = $this->previousAiProvider;
        }

        parent::tearDown();
    }

    public function test_quick_chat_can_send_and_fetch_without_optional_message_columns(): void
    {
        $headers = ['Authorization' => 'Bearer test-customer-token'];

        $this->withHeaders($headers)
            ->postJson('/api/customer/chat/messages', [
                'order_id' => 0,
                'message' => 'Hi, I need help',
                'support_mode' => 'admin',
                'conversation_id' => 'quick-chat-test',
            ])
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('messages', [
            'order_id' => null,
            'user_id' => 7,
            'customer_name' => 'Test Customer',
            'customer_email' => 'customer@example.com',
            'message' => 'Hi, I need help',
        ]);

        $this->withHeaders($headers)
            ->getJson('/api/customer/chat/messages?order_id=0&conversation_id=quick-chat-test')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('messages.0.message', 'Hi, I need help')
            ->assertJsonPath('messages.0.created_at', fn ($value) => str_ends_with($value, '+08:00'));

        $adminHeaders = ['Authorization' => 'Bearer test-admin-token'];
        $this->withHeaders($adminHeaders)
            ->getJson('/api/staff/chat/conversations')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('conversations.0.user_id', 7)
            ->assertJsonPath('conversations.0.order_id', 0)
            ->assertJsonPath('conversations.0.customer_name', 'Test Customer')
            ->assertJsonPath('conversations.0.last_message_at', fn ($value) => str_ends_with($value, '+08:00'));

        $this->withHeaders($adminHeaders)
            ->getJson('/api/staff/chat/messages?order_id=0&user_id=7&conversation_id=quick-chat-test')
            ->assertOk()
            ->assertJsonPath('messages.0.message', 'Hi, I need help');

        $this->withHeaders($adminHeaders)
            ->postJson('/api/staff/chat/messages', [
                'order_id' => 0,
                'user_id' => 7,
                'message' => 'How can I help?',
                'support_mode' => 'staff',
            ])
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('messages', [
            'user_id' => 7,
            'sender' => 'admin',
            'customer_name' => 'Test Customer',
            'customer_email' => 'customer@example.com',
            'message' => 'How can I help?',
        ]);

        $this->withHeaders($adminHeaders)
            ->getJson('/api/staff/chat/conversations')
            ->assertOk()
            ->assertJsonPath('conversations.0.customer_name', 'Test Customer');
    }

    public function test_customer_can_send_an_image_without_text(): void
    {
        $response = $this->withHeaders([
            'Authorization' => 'Bearer test-customer-token',
            'Accept' => 'application/json',
        ])->post('/api/customer/chat/messages', [
            'order_id' => 0,
            'message' => '',
            'support_mode' => 'admin',
            'image' => UploadedFile::fake()->image('cake-reference.png', 64, 64),
        ]);

        $response->assertOk()->assertJsonPath('success', true);

        $savedMessage = DB::table('messages')->where('sender', 'customer')->orderByDesc('id')->first();
        $this->assertNotNull($savedMessage);
        $this->assertNotEmpty($savedMessage->image_path);
        $this->uploadedChatPath = $savedMessage->image_path;
        $this->assertFileExists(public_path($savedMessage->image_path));
    }
}