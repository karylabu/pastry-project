<?php

namespace Tests\Unit;

use App\Services\RealtimeEventPublisher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class RealtimeEventPublisherTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('realtime_events', function ($table) {
            $table->id();
            $table->string('audience');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('event_name');
            $table->unsignedBigInteger('order_id')->nullable();
            $table->string('conversation_id')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('realtime_events');
        parent::tearDown();
    }

    public function test_order_update_is_published_to_admins_and_the_customer(): void
    {
        app(RealtimeEventPublisher::class)->orderUpdated(17, 42);

        $this->assertDatabaseHas('realtime_events', [
            'audience' => 'admins',
            'user_id' => null,
            'event_name' => 'order.updated',
            'order_id' => 42,
        ]);
        $this->assertDatabaseHas('realtime_events', [
            'audience' => 'user',
            'user_id' => 17,
            'event_name' => 'order.updated',
            'order_id' => 42,
        ]);
    }

    public function test_chat_update_keeps_conversation_identity_for_both_audiences(): void
    {
        app(RealtimeEventPublisher::class)->chatUpdated(17, 42, 'order-42');

        $this->assertSame(
            2,
            DB::table('realtime_events')
                ->where('event_name', 'chat.updated')
                ->where('order_id', 42)
                ->where('conversation_id', 'order-42')
                ->count()
        );
    }
}
