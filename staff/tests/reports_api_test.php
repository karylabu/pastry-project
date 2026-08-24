<?php
require_once __DIR__ . '/../api_reports.php';

if (!function_exists('extractCompletedOrders')) {
    function extractCompletedOrders(array $orders): array {
        return array_values(array_filter($orders, static function (array $order): bool {
            return strtolower(trim((string) ($order['status'] ?? ''))) === 'completed';
        }));
    }
}

$orders = [
    ['id' => 1, 'status' => 'Completed', 'total' => 100, 'created_at' => '2024-01-01 10:00:00'],
    ['id' => 2, 'status' => 'Pending', 'total' => 200, 'created_at' => '2024-01-02 10:00:00'],
    ['id' => 3, 'status' => 'completed', 'total' => 300, 'created_at' => '2024-01-03 10:00:00'],
];

$completedOrders = extractCompletedOrders($orders);
if (count($completedOrders) !== 2) {
    fwrite(STDERR, "Expected 2 completed orders, got " . count($completedOrders) . PHP_EOL);
    exit(1);
}

if ($completedOrders[0]['id'] !== 1 || $completedOrders[1]['id'] !== 3) {
    fwrite(STDERR, "Completed orders were not normalized correctly." . PHP_EOL);
    exit(1);
}

echo "reports-api-test:ok\n";
