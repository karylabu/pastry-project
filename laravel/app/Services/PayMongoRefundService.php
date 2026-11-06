<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class PayMongoRefundService
{
    public function listForPayment(string $secretKey, string $paymentId): array
    {
        $refunds = [];
        $after = null;
        $pageCount = 0;

        do {
            $query = [
                'data.attributes.payment_id' => $paymentId,
                'data.attributes.limit' => '100',
            ];
            if ($after !== null) {
                $query['data.attributes.after'] = $after;
            }

            $response = Http::withBasicAuth($secretKey, '')
                ->acceptJson()
                ->timeout(15)
                ->get('https://api.paymongo.com/v1/refunds', $query);
            if (! $response->successful() || ! is_array($response->json('data'))) {
                throw new RuntimeException('Unable to verify existing PayMongo refunds.');
            }

            foreach ($response->json('data') as $refund) {
                if (is_array($refund) && is_string($refund['id'] ?? null)) {
                    $refunds[] = $refund;
                }
            }

            if (! $response->json('has_more', false)) {
                break;
            }

            $after = (string) (($refunds[array_key_last($refunds)]['id'] ?? ''));
            if ($after === '' || ++$pageCount >= 10) {
                throw new RuntimeException('Unable to verify the complete PayMongo refund history.');
            }
        } while (true);

        return $refunds;
    }

    public function retrieve(string $secretKey, string $refundId): array
    {
        $response = Http::withBasicAuth($secretKey, '')
            ->acceptJson()
            ->timeout(15)
            ->get('https://api.paymongo.com/v1/refunds/'.rawurlencode($refundId));
        $refund = $response->json('data');

        if (! $response->successful() || ! is_array($refund) || (string) ($refund['id'] ?? '') !== $refundId) {
            throw new RuntimeException('Unable to verify the PayMongo refund.');
        }

        return $refund;
    }

    public function status(array $refund): string
    {
        return match (strtolower(trim((string) ($refund['attributes']['status'] ?? '')))) {
            'processing', 'refunding', 'pending' => 'pending',
            'succeeded', 'refunded' => 'succeeded',
            'failed' => 'failed',
            default => '',
        };
    }

    public function mostRelevant(array $refunds): ?array
    {
        usort($refunds, static fn (array $first, array $second): int => (int) ($second['attributes']['created_at'] ?? 0) <=> (int) ($first['attributes']['created_at'] ?? 0)
        );

        foreach (['pending', 'succeeded', 'failed'] as $status) {
            foreach ($refunds as $refund) {
                if ($this->status($refund) === $status) {
                    return $refund;
                }
            }
        }

        return null;
    }
}
