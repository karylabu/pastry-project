<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class PayMongoRefundService
{
    private const API_BASE_URL = 'https://api.paymongo.com/v1';

    private const PAGE_LIMIT = 100;

    private const MAX_PAGES = 10;

    /**
     * List all refunds belonging to a specific payment.
     */
    public function listForPayment(
        string $secretKey,
        string $paymentId
    ): array {
        $refunds = [];
        $after = null;
        $pageCount = 0;

        do {
            $query = [
                'data.attributes.payment_id' => $paymentId,
                'data.attributes.limit' => (string) self::PAGE_LIMIT,
            ];

            if ($after !== null) {
                $query['data.attributes.after'] = $after;
            }

            $response = Http::withBasicAuth($secretKey, '')
                ->acceptJson()
                ->timeout(30)
                ->get(self::API_BASE_URL.'/refunds', $query);

            $data = $response->json('data');

            if (! $response->successful() || ! is_array($data)) {
                throw new RuntimeException(
                    $this->formatApiError(
                        'PayMongo list refunds request failed',
                        $response
                    )
                );
            }

            $lastRefundId = null;

            foreach ($data as $refund) {
                if (
                    is_array($refund) &&
                    is_string($refund['id'] ?? null)
                ) {
                    $refunds[] = $refund;
                    $lastRefundId = $refund['id'];
                }
            }

            $hasMore = (bool) $response->json('has_more', false);

            if (! $hasMore) {
                break;
            }

            if ($lastRefundId === null) {
                throw new RuntimeException(
                    'PayMongo returned has_more=true but no valid refund cursor was found.'
                );
            }

            $after = $lastRefundId;

            $pageCount++;

            if ($pageCount >= self::MAX_PAGES) {
                throw new RuntimeException(
                    'PayMongo refund history exceeded the maximum pagination limit. Complete history could not be verified.'
                );
            }
        } while (true);

        return $refunds;
    }

    /**
     * Retrieve a specific refund by refund ID.
     */
    public function retrieve(
        string $secretKey,
        string $refundId
    ): array {
        $response = Http::withBasicAuth($secretKey, '')
            ->acceptJson()
            ->timeout(30)
            ->get(
                self::API_BASE_URL.'/refunds/'.rawurlencode($refundId)
            );

        $refund = $response->json('data');

        if (! $response->successful()) {
            throw new RuntimeException(
                $this->formatApiError(
                    'PayMongo retrieve refund request failed',
                    $response
                )
            );
        }

        if (! is_array($refund)) {
            throw new RuntimeException(
                'PayMongo returned an invalid refund response.'
            );
        }

        if (($refund['id'] ?? null) !== $refundId) {
            throw new RuntimeException(
                'PayMongo refund ID does not match the requested refund ID.'
            );
        }

        if (! is_array($refund['attributes'] ?? null)) {
            throw new RuntimeException(
                'PayMongo refund response is missing its attributes.'
            );
        }

        return $refund;
    }

    /**
     * Normalize PayMongo refund statuses.
     *
     * Returns:
     * pending
     * succeeded
     * failed
     * empty string for unknown status
     */
    public function status(array $refund): string
    {
        $status = strtolower(
            trim((string) (
                $refund['attributes']['status'] ?? ''
            ))
        );

        return match ($status) {
            'pending',
            'processing',
            'refunding' => 'pending',

            'succeeded',
            'refunded' => 'succeeded',

            'failed' => 'failed',

            default => '',
        };
    }

    /**
     * Select the most relevant refund.
     *
     * Pending refunds are prioritized to prevent another
     * refund from being created while an existing one is pending.
     */
    public function mostRelevant(array $refunds): ?array
    {
        if (empty($refunds)) {
            return null;
        }

        usort(
            $refunds,
            static function (array $first, array $second): int {
                return (int) (
                    $second['attributes']['created_at'] ?? 0
                ) <=> (int) (
                    $first['attributes']['created_at'] ?? 0
                );
            }
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

    /**
     * Build a useful API error message without exposing credentials.
     */
    private function formatApiError(
        string $context,
        $response
    ): string {
        $httpStatus = $response->status();

        $errors = $response->json('errors', []);

        $details = [];

        if (is_array($errors)) {
            foreach ($errors as $error) {
                if (! is_array($error)) {
                    continue;
                }

                $code = $error['code'] ?? null;
                $detail = $error['detail'] ?? null;

                if (is_string($code) && $code !== '') {
                    $details[] = 'Code: '.$code;
                }

                if (is_string($detail) && $detail !== '') {
                    $details[] = 'Detail: '.$detail;
                }
            }
        }

        $message = $context.'. HTTP '.$httpStatus.'.';

        if (! empty($details)) {
            $message .= ' '.implode(' ', $details);
        }

        return $message;
    }
}
