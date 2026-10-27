<?php

namespace Tests\Feature;

use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PaymentProofSecurityTest extends TestCase
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
            $table->string('status')->default('active');
        });
        Schema::create('user_sessions', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('token')->unique();
            $table->timestamp('expires_at')->nullable();
        });
        Schema::create('orders', function ($table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('status');
            $table->string('payment');
            $table->string('payment_status');
            $table->string('order_type')->nullable();
            $table->boolean('is_customized')->default(false);
            $table->string('payment_proof_path')->nullable();
            $table->string('customer_payment_reference', 100)->nullable();
        });

        DB::table('users')->insert([
            'id' => 9,
            'name' => 'Test Customer',
            'email' => 'proof@example.com',
            'password' => 'unused',
            'role' => 'customer',
            'status' => 'active',
        ]);
        DB::table('user_sessions')->insert([
            'user_id' => 9,
            'token' => 'proof-customer-token',
            'expires_at' => now()->addHour(),
        ]);
        foreach ([5, 6, 7, 8] as $orderId) {
            DB::table('orders')->insert([
                'id' => $orderId,
                'user_id' => 9,
                'status' => $orderId === 7 ? 'Pending' : 'Awaiting Payment',
                'payment' => 'QRPh',
                'payment_status' => 'pending',
                'order_type' => 'Standard',
                'is_customized' => false,
            ]);
            RateLimiter::clear('payment-proof:' . hash('sha256', '9:' . $orderId));
        }

        Storage::fake('local');
        Storage::fake('public');
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('orders');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    private function fakePng(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent(
            'proof.png',
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=')
        );
    }

    public function test_payment_proof_is_saved_privately_and_only_an_admin_can_view_it(): void
    {
        $this->withHeader('X-Auth-Token', 'proof-customer-token')
            ->post('/api/orders/5/payment-proof', [
                'payment_proof' => $this->fakePng(),
            ])
            ->assertOk()
            ->assertJsonPath('payment_status', 'proof_submitted');

        $path = DB::table('orders')->where('id', 5)->value('payment_proof_path');
        $this->assertStringStartsWith('payment-proofs/', $path);
        Storage::disk('local')->assertExists($path);
        Storage::disk('public')->assertMissing($path);

        $this->withHeader('X-Auth-Token', 'proof-customer-token')
            ->getJson('/api/staff/orders/5/payment-proof')
            ->assertForbidden();
    }

    public function test_invalid_payment_proofs_are_rejected_and_rate_limited(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class);

        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->withHeader('X-Auth-Token', 'proof-customer-token')
                ->withHeader('Accept', 'application/json')
                ->post('/api/orders/6/payment-proof', [
                    'payment_proof' => UploadedFile::fake()->create('payload.php', 10, 'application/x-php'),
                ])
                ->assertUnprocessable();
        }

        $this->withHeader('X-Auth-Token', 'proof-customer-token')
            ->post('/api/orders/6/payment-proof', [
                'payment_proof' => $this->fakePng(),
            ])
            ->assertStatus(429)
            ->assertHeader('Retry-After');

        $this->assertDatabaseHas('orders', [
            'id' => 6,
            'payment_status' => 'pending',
            'payment_proof_path' => null,
        ]);
        Storage::disk('local')->assertDirectoryEmpty('payment-proofs');
    }

    public function test_customer_payment_reference_can_be_submitted_for_admin_review(): void
    {
        $this->withHeader('X-Auth-Token', 'proof-customer-token')
            ->postJson('/api/orders/7/payment-proof', [
                'customer_payment_reference' => 'QRPH_ABC-123',
            ])
            ->assertOk()
            ->assertJsonPath('payment_status', 'proof_submitted');

        $this->assertDatabaseHas('orders', [
            'id' => 7,
            'payment_status' => 'proof_submitted',
            'customer_payment_reference' => 'QRPH_ABC-123',
            'payment_proof_path' => null,
        ]);
    }

    public function test_customer_must_submit_exactly_one_payment_proof_type(): void
    {
        $this->withHeader('X-Auth-Token', 'proof-customer-token')
            ->postJson('/api/orders/8/payment-proof')
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Submit either a payment screenshot or a reference number.');

        $this->withHeader('X-Auth-Token', 'proof-customer-token')
            ->post('/api/orders/8/payment-proof', [
                'payment_proof' => $this->fakePng(),
                'customer_payment_reference' => 'QRPH_ABC-123',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Submit either a payment screenshot or a reference number.');
    }
}
