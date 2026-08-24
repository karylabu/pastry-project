<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class NewsletterControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('subscribers', function ($table) {
            $table->id();
            $table->string('email')->unique();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('subscribers');

        parent::tearDown();
    }

    public function test_it_subscribes_a_new_email(): void
    {
        $response = $this->postJson('/api/newsletter/subscribe', [
            'email' => 'reader@example.com',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Thanks for subscribing!');

        $this->assertDatabaseHas('subscribers', [
            'email' => 'reader@example.com',
        ]);
    }
}
