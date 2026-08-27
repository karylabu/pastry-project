<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../includes/api_auth.php';
require_once __DIR__ . '/../includes/db.php';

// Staff reports contain business revenue data — require an authenticated
// staff/admin session (or Bearer token) before returning anything.
requireInventoryRead();

function sendJson(bool $success, array $payload, int $statusCode = 200): never {
    http_response_code($statusCode);
    echo json_encode(array_merge(['success' => $success], $payload));
    exit;
}

function parseNumber(mixed $value, float $fallback = 0.0): float {
    if (is_int($value) || is_float($value)) {
        return (float) $value;
    }
    if (is_string($value) && trim($value) !== '') {
        return (float) $value;
    }
    return (float) $fallback;
}

function normalizeStatus(mixed $status): string {
    return strtolower(trim((string) $status));
}

function isCompletedOrder(mixed $status): bool {
    return normalizeStatus($status) === 'completed';
}

function extractCompletedOrders(array $orders): array {
    return array_values(array_filter($orders, static function (array $order): bool {
        return isCompletedOrder($order['status'] ?? '');
    }));
}

function getWeekdayRevenue(array $orders): array {
    $labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    $daySums = array_fill(0, 7, 0);

    foreach ($orders as $order) {
        $date = $order['created_at'] ?? null;
        if (!$date) {
            continue;
        }
        $ts = strtotime($date);
        if ($ts === false) {
            continue;
        }
        $weekday = (int) date('w', $ts);
        $dayIndex = ($weekday + 6) % 7;
        $daySums[$dayIndex] += (int) round(parseNumber($order['total']));
    }

    return array_map(function ($label, $value) {
        return ['label' => $label, 'value' => (int) $value];
    }, $labels, $daySums);
}

if (!$conn) {
    sendJson(false, ['message' => 'Database connection failed.']);
}

// `items` is the JSON column on orders that actually holds each order's line
// items (name/category/price/qty). The separate `order_items` table is stale
// seed data whose order_id values don't correspond to any real order, so we
// no longer join against it.
$sqlOrders = "SELECT id, status, items, total, created_at FROM orders WHERE LOWER(status) = 'completed' ORDER BY created_at ASC";
$ordersResult = $conn->query($sqlOrders);
if ($ordersResult === false) {
    sendJson(false, ['message' => 'Orders query failed.']);
}
$orders = [];
while ($row = $ordersResult->fetch_assoc()) {
    $orders[] = $row;
}
$orders = extractCompletedOrders($orders);

// Used only as a fallback for category when an item's JSON doesn't carry one.
$sqlProducts = "SELECT id, name, category FROM products WHERE available = 1 ORDER BY name ASC";
$productsResult = $conn->query($sqlProducts);
if ($productsResult === false) {
    sendJson(false, ['message' => 'Products query failed.']);
}
$productCategories = [];
while ($row = $productsResult->fetch_assoc()) {
    $productCategories[$row['name']] = $row['category'] ?? 'Other';
}

$sqlIngredients = "SELECT id, name, stock, threshold FROM ingredients ORDER BY name ASC";
$ingredientsResult = $conn->query($sqlIngredients);
if ($ingredientsResult === false) {
    sendJson(false, ['message' => 'Ingredients query failed.']);
}
$ingredients = [];
while ($row = $ingredientsResult->fetch_assoc()) {
    $ingredients[] = $row;
}

$categoryRevenue = [];
$productSold = [];
$productRevenue = [];

foreach ($orders as $order) {
    $rawItems = $order['items'] ?? '[]';
    $items = json_decode((string) $rawItems, true);
    if (!is_array($items)) {
        continue;
    }

    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        $qty = (int) max(0, round(parseNumber($item['qty'] ?? 1)));
        $price = (int) round(parseNumber($item['price'] ?? 0));
        $productName = trim((string) ($item['name'] ?? ''));
        if ($productName === '' || $qty <= 0) {
            continue;
        }

        $productSold[$productName] = ($productSold[$productName] ?? 0) + $qty;
        $productRevenue[$productName] = ($productRevenue[$productName] ?? 0) + ($qty * $price);

        $category = $item['category'] ?? $productCategories[$productName] ?? 'Other';
        $categoryRevenue[$category] = ($categoryRevenue[$category] ?? 0) + ($qty * $price);
    }
}

$categoryGoals = [];
foreach ($categoryRevenue as $label => $value) {
    $target = max(50000, min(200000, (int) ($value * 2)));
    $categoryGoals[] = [
        'label' => $label,
        'current' => (int) $value,
        'target' => $target,
        'color' => '#8BC34A',
    ];
}

if (empty($categoryGoals)) {
    $categoryGoals[] = [
        'label' => 'All',
        'current' => 0,
        'target' => 100000,
        'color' => '#8BC34A',
    ];
}

$revenueBreakdown = [];
foreach ($categoryRevenue as $label => $value) {
    $revenueBreakdown[] = [
        'label' => $label,
        'value' => (int) $value,
        'color' => '#8BC34A',
    ];
}

usort($revenueBreakdown, function ($a, $b) {
    return $b['value'] <=> $a['value'];
});
$revenueBreakdown = array_slice($revenueBreakdown, 0, 3);

$topProducts = [];
foreach ($productSold as $name => $sold) {
    $topProducts[] = [
        'name' => $name,
        'sold' => (int) $sold,
        'revenue' => (int) ($productRevenue[$name] ?? 0),
    ];
}
usort($topProducts, function ($a, $b) {
    return $b['sold'] <=> $a['sold'];
});
$topProducts = array_slice($topProducts, 0, 5);

$ingredientAlerts = [];
foreach ($ingredients as $ingredient) {
    $stock = (int) round(parseNumber($ingredient['stock']));
    $threshold = (int) round(parseNumber($ingredient['threshold']));
    $status = $stock <= $threshold ? ($stock === 0 ? 'Out' : 'Low') : 'OK';
    $ingredientAlerts[] = [
        'name' => $ingredient['name'] ?? '',
        'status' => $status,
        'stock' => $stock,
        'color' => $stock <= $threshold ? '#F44336' : '#FFD166',
    ];
}

$totalRevenue = 0;
foreach ($orders as $order) {
    $totalRevenue += (int) round(parseNumber($order['total']));
}

$ordersProcessed = count($orders);
$averageOrderValue = $ordersProcessed > 0 ? round($totalRevenue / $ordersProcessed) : 0;

$previousWeekRevenue = 0;
$currentWeekRevenue = 0;
$weekStart = strtotime('today -6 days');
$weekEnd = strtotime('today');
foreach ($orders as $order) {
    $orderDate = $order['created_at'] ?? null;
    if (!$orderDate) {
        continue;
    }
    $ts = strtotime($orderDate);
    if ($ts === false) {
        continue;
    }
    $total = (int) round(parseNumber($order['total']));
    if ($ts >= $weekStart && $ts <= $weekEnd) {
        $currentWeekRevenue += $total;
    }
    if ($ts >= strtotime('last monday - 7 days') && $ts <= strtotime('last sunday')) {
        $previousWeekRevenue += $total;
    }
}

$weeklyGrowthPct = 0.0;
if ($previousWeekRevenue > 0) {
    $weeklyGrowthPct = round((($currentWeekRevenue - $previousWeekRevenue) / $previousWeekRevenue) * 100, 2);
}

$summary = [
    'total_revenue' => $totalRevenue,
    'orders_processed' => $ordersProcessed,
    'average_order_value' => $averageOrderValue,
    'weekly_growth_pct' => $weeklyGrowthPct,
    'goal_target' => 100000,
];

sendJson(true, [
    'summary' => $summary,
    'category_goals' => $categoryGoals,
    'weekly_pipeline' => getWeekdayRevenue($orders),
    'revenue_breakdown' => $revenueBreakdown,
    'top_products' => $topProducts,
    'ingredient_alerts' => $ingredientAlerts,
    'weekly_goal_pct' => $summary['goal_target'] > 0 ? min(1.0, max(0.0, $totalRevenue / $summary['goal_target'])) : 0.0,
]);