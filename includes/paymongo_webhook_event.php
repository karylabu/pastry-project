<?php

function parsePayMongoWebhookEvent(array $event): array
{
    $eventData = $event['data'] ?? [];
    $eventAttributes = is_array($eventData) ? ($eventData['attributes'] ?? []) : [];
    $eventType = strtolower((string) ($eventAttributes['type'] ?? $event['type'] ?? ''));
    $resource = is_array($eventAttributes)
        ? ($eventAttributes['data'] ?? $eventData)
        : $eventData;
    $resource = is_array($resource) ? $resource : [];
    $resourceAttributes = $resource['attributes'] ?? [];
    $resourceAttributes = is_array($resourceAttributes) ? $resourceAttributes : [];

    $refundStatus = match ($eventType) {
        'refund.succeeded' => 'succeeded',
        'refund.failed' => 'failed',
        'refund.updated' => strtolower((string) ($resourceAttributes['status'] ?? '')),
        default => '',
    };

    return [
        'type' => $eventType,
        'resource' => $resource,
        'refund_status' => $refundStatus,
    ];
}
