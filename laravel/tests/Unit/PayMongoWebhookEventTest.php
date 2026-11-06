<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 3) . '/includes/paymongo_webhook_event.php';

class PayMongoWebhookEventTest extends TestCase
{
    public function test_refund_failed_uses_the_nested_refund_resource_id(): void
    {
        $event = parsePayMongoWebhookEvent([
            'data' => [
                'id' => 'evt_123',
                'attributes' => [
                    'type' => 'refund.failed',
                    'data' => [
                        'id' => 're_123',
                        'type' => 'refund',
                        'attributes' => [
                            'payment_id' => 'pay_123',
                            'status' => 'failed',
                        ],
                    ],
                ],
            ],
        ]);

        $this->assertSame('refund.failed', $event['type']);
        $this->assertSame('re_123', $event['resource']['id']);
        $this->assertSame('pay_123', $event['resource']['attributes']['payment_id']);
        $this->assertSame('failed', $event['refund_status']);
    }

    public function test_refund_updated_reads_status_from_the_nested_refund_resource(): void
    {
        $event = parsePayMongoWebhookEvent([
            'data' => [
                'id' => 'evt_456',
                'attributes' => [
                    'type' => 'refund.updated',
                    'data' => [
                        'id' => 're_456',
                        'attributes' => ['status' => 'succeeded'],
                    ],
                ],
            ],
        ]);

        $this->assertSame('re_456', $event['resource']['id']);
        $this->assertSame('succeeded', $event['refund_status']);
    }
}
