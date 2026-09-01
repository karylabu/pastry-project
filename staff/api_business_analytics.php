<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../includes/api_auth.php';
requireInventoryRead();

function analyticsJson(bool $success, array $payload = [], int $status = 200): never
{
    http_response_code($status);
    echo json_encode(array_merge(['success' => $success], $payload));
    exit;
}

function analyticsDate(string $value, string $fallback): string
{
    if ($value === '') return $fallback;
    $date = DateTime::createFromFormat('Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) {
        analyticsJson(false, ['message' => 'Dates must use YYYY-MM-DD format.'], 400);
    }
    return $value;
}

function analyticsRows(mysqli $conn, string $sql, string $types = '', array $values = []): array
{
    $stmt = $conn->prepare($sql);
    if (!$stmt) analyticsJson(false, ['message' => 'Analytics query preparation failed.'], 500);
    if ($types !== '') $stmt->bind_param($types, ...$values);
    if (!$stmt->execute()) analyticsJson(false, ['message' => 'Analytics query failed.'], 500);
    $result = $stmt->get_result();
    $rows = [];
    while ($row = $result->fetch_assoc()) $rows[] = $row;
    $stmt->close();
    return $rows;
}

function analyticsScalar(mysqli $conn, string $sql, string $types = '', array $values = []): array
{
    $rows = analyticsRows($conn, $sql, $types, $values);
    return $rows[0] ?? [];
}

function analyticsOrderItems(array $orders, array $products, int $filterProductId = 0, string $filterCategory = ''): array
{
    $productByName = [];
    foreach ($products as $product) $productByName[strtolower(trim($product['name']))] = $product;
    $sales = [];
    foreach ($orders as $order) {
        $items = json_decode((string) ($order['items'] ?? '[]'), true);
        if (!is_array($items)) continue;
        foreach ($items as $item) {
            if (!is_array($item)) continue;
            $name = trim((string) ($item['name'] ?? $item['product'] ?? ''));
            $itemProductId = (int) ($item['product_id'] ?? $item['id'] ?? 0);
            $product = $itemProductId > 0 ? ($products[$itemProductId] ?? null) : ($productByName[strtolower($name)] ?? null);
            $category = trim((string) ($item['category'] ?? ($product['category'] ?? 'Other')));
            if ($filterProductId > 0 && $itemProductId !== $filterProductId && (int) ($product['id'] ?? 0) !== $filterProductId) continue;
            if ($filterCategory !== '' && strtolower($category) !== strtolower($filterCategory)) continue;
            $quantity = max(0, (float) ($item['qty'] ?? $item['quantity'] ?? 0));
            if ($name === '' || $quantity <= 0) continue;
            $unitPrice = (float) ($item['price'] ?? $item['unit_price'] ?? 0);
            $key = (int) ($product['id'] ?? $itemProductId) . '|' . $name;
            if (!isset($sales[$key])) $sales[$key] = ['product_id' => (int) ($product['id'] ?? $itemProductId), 'product' => $name, 'category' => $category, 'sold' => 0, 'revenue' => 0];
            $sales[$key]['sold'] += $quantity;
            $sales[$key]['revenue'] += $quantity * $unitPrice;
        }
    }
    usort($sales, static fn($a, $b) => $b['sold'] <=> $a['sold']);
    return $sales;
}

$conn = new mysqli('localhost', 'root', '', 'pastry_db');
if ($conn->connect_error) analyticsJson(false, ['message' => 'Database connection failed.'], 500);

$today = date('Y-m-d');
$start = analyticsDate(trim((string) ($_GET['start_date'] ?? '')), date('Y-m-d', strtotime('-30 days')));
$end = analyticsDate(trim((string) ($_GET['end_date'] ?? '')), $today);
if ($start > $end) analyticsJson(false, ['message' => 'Start date cannot be after end date.'], 400);
$productId = max(0, (int) ($_GET['product_id'] ?? 0));
$ingredientId = max(0, (int) ($_GET['ingredient_id'] ?? 0));
$category = trim((string) ($_GET['category'] ?? ''));
$movementType = trim((string) ($_GET['movement_type'] ?? ''));

$productsRows = analyticsRows($conn, 'SELECT id, name, category, stock, minimum_stock, production_cost FROM products ORDER BY name');
$products = [];
foreach ($productsRows as $product) $products[(int) $product['id']] = $product;

$orderRows = analyticsRows($conn, "SELECT id, items, total, created_at FROM orders WHERE LOWER(status) = 'completed' AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY created_at", 'ss', [$start . ' 00:00:00', $end]);
$sales = analyticsOrderItems($orderRows, $products, $productId, $category);
$revenue = 0.0;
foreach ($orderRows as $order) $revenue += (float) $order['total'];
$ordersCount = count($orderRows);

$dailyRevenue = analyticsRows($conn, "SELECT DATE(created_at) AS date, COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders FROM orders WHERE LOWER(status) = 'completed' AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY DATE(created_at) ORDER BY date", 'ss', [$start . ' 00:00:00', $end]);
$productionByProduct = analyticsRows($conn, "SELECT pt.product_id, p.name AS product, p.category, SUM(pt.quantity) AS quantity FROM production_transactions pt INNER JOIN products p ON p.id = pt.product_id WHERE pt.created_at >= ? AND pt.created_at < DATE_ADD(?, INTERVAL 1 DAY) " . ($productId > 0 ? 'AND pt.product_id = ? ' : '') . ($category !== '' ? 'AND LOWER(p.category) = LOWER(?) ' : '') . "GROUP BY pt.product_id, p.name, p.category ORDER BY quantity DESC", $productId > 0 && $category !== '' ? 'ssis' : ($productId > 0 ? 'ssi' : ($category !== '' ? 'sss' : 'ss')), $productId > 0 && $category !== '' ? [$start . ' 00:00:00', $end, $productId, $category] : ($productId > 0 ? [$start . ' 00:00:00', $end, $productId] : ($category !== '' ? [$start . ' 00:00:00', $end, $category] : [$start . ' 00:00:00', $end])));
$productionByDay = analyticsRows($conn, "SELECT DATE(pt.created_at) AS date, SUM(pt.quantity) AS quantity FROM production_transactions pt INNER JOIN products p ON p.id = pt.product_id WHERE pt.created_at >= ? AND pt.created_at < DATE_ADD(?, INTERVAL 1 DAY) " . ($productId > 0 ? 'AND pt.product_id = ? ' : '') . ($category !== '' ? 'AND LOWER(p.category) = LOWER(?) ' : '') . "GROUP BY DATE(pt.created_at) ORDER BY date", $productId > 0 && $category !== '' ? 'ssis' : ($productId > 0 ? 'ssi' : ($category !== '' ? 'sss' : 'ss')), $productId > 0 && $category !== '' ? [$start . ' 00:00:00', $end, $productId, $category] : ($productId > 0 ? [$start . ' 00:00:00', $end, $productId] : ($category !== '' ? [$start . ' 00:00:00', $end, $category] : [$start . ' 00:00:00', $end])));

$movementConditions = ['m.created_at >= ?', 'm.created_at < DATE_ADD(?, INTERVAL 1 DAY)'];
$movementTypes = 'ss';
$movementValues = [$start . ' 00:00:00', $end];
if ($productId > 0) { $movementConditions[] = 'm.product_id = ?'; $movementTypes .= 'i'; $movementValues[] = $productId; }
if ($movementType !== '') { $movementConditions[] = 'm.movement_type = ?'; $movementTypes .= 's'; $movementValues[] = $movementType; }
$movementWhere = implode(' AND ', $movementConditions);
$movementSummary = analyticsRows($conn, "SELECT m.movement_type, SUM(m.quantity) AS quantity FROM product_inventory_movements m WHERE {$movementWhere} GROUP BY m.movement_type ORDER BY ABS(SUM(m.quantity)) DESC", $movementTypes, $movementValues);
$movementByProduct = analyticsRows($conn, "SELECT m.product_id, p.name AS product, SUM(CASE WHEN m.quantity < 0 THEN -m.quantity ELSE 0 END) AS consumed, SUM(m.quantity) AS net_change FROM product_inventory_movements m INNER JOIN products p ON p.id = m.product_id WHERE {$movementWhere} GROUP BY m.product_id, p.name ORDER BY consumed DESC", $movementTypes, $movementValues);

$ingredientConditions = ['im.created_at >= ?', 'im.created_at < DATE_ADD(?, INTERVAL 1 DAY)', "im.action = 'stock_out'", "im.reference_type = 'production'"];
$ingredientTypes = 'ss';
$ingredientValues = [$start . ' 00:00:00', $end];
if ($ingredientId > 0) { $ingredientConditions[] = 'im.ingredient_id = ?'; $ingredientTypes .= 'i'; $ingredientValues[] = $ingredientId; }
$ingredientWhere = implode(' AND ', $ingredientConditions);
$ingredientConsumption = analyticsRows($conn, "SELECT im.ingredient_id, i.name AS ingredient, i.unit, SUM(im.qty) AS quantity_consumed FROM ingredient_movements im INNER JOIN ingredients i ON i.id = im.ingredient_id WHERE {$ingredientWhere} GROUP BY im.ingredient_id, i.name, i.unit ORDER BY quantity_consumed DESC", $ingredientTypes, $ingredientValues);

$wasteConditions = ['w.datetime >= ?', 'w.datetime < DATE_ADD(?, INTERVAL 1 DAY)'];
$wasteTypes = 'ss';
$wasteValues = [$start . ' 00:00:00', $end];
if ($productId > 0) { $wasteConditions[] = 'w.product_id = ?'; $wasteTypes .= 'i'; $wasteValues[] = $productId; }
if ($ingredientId > 0) { $wasteConditions[] = 'w.ingredient_id = ?'; $wasteTypes .= 'i'; $wasteValues[] = $ingredientId; }
$wasteWhere = implode(' AND ', $wasteConditions);
$wasteRows = analyticsRows($conn, "SELECT w.id, w.item, w.qty, w.unit_cost, w.item_type, w.reason, w.product_id, w.ingredient_id, w.datetime, COALESCE(p.name, i.name, w.item) AS item_name FROM waste_log w LEFT JOIN products p ON p.id = w.product_id LEFT JOIN ingredients i ON i.id = w.ingredient_id WHERE {$wasteWhere} ORDER BY w.datetime DESC", $wasteTypes, $wasteValues);
$wasteByReason = analyticsRows($conn, "SELECT reason, SUM(qty) AS quantity, SUM(qty * unit_cost) AS cost FROM waste_log w WHERE {$wasteWhere} GROUP BY reason ORDER BY cost DESC", $wasteTypes, $wasteValues);
$wasteByDate = analyticsRows($conn, "SELECT DATE(datetime) AS date, SUM(qty) AS quantity, SUM(qty * unit_cost) AS cost FROM waste_log w WHERE {$wasteWhere} GROUP BY DATE(datetime) ORDER BY date", $wasteTypes, $wasteValues);
$wasteCost = 0.0; $wasteQuantity = 0.0;
$wasteByProduct = []; $wasteByIngredient = [];
foreach ($wasteRows as $waste) {
    $quantity = (float) $waste['qty']; $cost = $quantity * (float) $waste['unit_cost'];
    $wasteQuantity += $quantity; $wasteCost += $cost;
    $bucket = (int) ($waste['product_id'] ?? 0) > 0 ? 'product' : 'ingredient';
    if ($bucket === 'product') {
        $target =& $wasteByProduct;
    } else {
        $target =& $wasteByIngredient;
    }
    $key = (int) ($waste[$bucket . '_id'] ?? 0) . '|' . $waste['item_name'];
    if (!isset($target[$key])) $target[$key] = ['id' => (int) ($waste[$bucket . '_id'] ?? 0), 'item' => $waste['item_name'], 'quantity' => 0, 'cost' => 0];
    $target[$key]['quantity'] += $quantity; $target[$key]['cost'] += $cost;
    unset($target);
}

$productionCostRow = analyticsScalar($conn, "SELECT COALESCE(SUM(pt.quantity * p.production_cost), 0) AS cost FROM production_transactions pt INNER JOIN products p ON p.id = pt.product_id WHERE pt.created_at >= ? AND pt.created_at < DATE_ADD(?, INTERVAL 1 DAY)" . ($productId > 0 ? ' AND pt.product_id = ?' : ''), $productId > 0 ? 'ssi' : 'ss', $productId > 0 ? [$start . ' 00:00:00', $end, $productId] : [$start . ' 00:00:00', $end]);
$productionCost = (float) ($productionCostRow['cost'] ?? 0);

$inventory = [];
foreach ($productsRows as $product) {
    if ($productId > 0 && (int) $product['id'] !== $productId) continue;
    if ($category !== '' && strcasecmp($category, (string) $product['category']) !== 0) continue;
    $stock = (float) $product['stock']; $minimum = (float) $product['minimum_stock'];
    $inventory[] = ['product_id' => (int) $product['id'], 'product' => $product['name'], 'category' => $product['category'], 'current_stock' => $stock, 'minimum_stock' => $minimum, 'status' => $stock <= 0 ? 'Out of Stock' : ($stock <= $minimum ? 'Low Stock' : 'In Stock')];
}
$lowStock = array_values(array_filter($inventory, static fn($item) => $item['status'] === 'Low Stock'));
$outOfStock = array_values(array_filter($inventory, static fn($item) => $item['status'] === 'Out of Stock'));
$lowStockFrequency = analyticsRows($conn, "SELECT m.product_id, p.name AS product, COUNT(*) AS low_stock_events FROM product_inventory_movements m INNER JOIN products p ON p.id = m.product_id WHERE m.new_stock <= p.minimum_stock AND m.created_at >= ? AND m.created_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY m.product_id, p.name ORDER BY low_stock_events DESC", 'ss', [$start . ' 00:00:00', $end]);
$ingredientInventory = analyticsRows($conn, "SELECT id AS ingredient_id, name AS ingredient, unit, stock, threshold, CASE WHEN stock <= 0 THEN 'Out of Stock' WHEN stock <= threshold THEN 'Low Stock' ELSE 'In Stock' END AS status FROM ingredients ORDER BY stock ASC, name");

$productPerformance = [];
foreach ($inventory as $item) {
    $item['sold'] = 0; $item['produced'] = 0; $item['waste'] = 0;
    foreach ($sales as $sale) if ((int) $sale['product_id'] === $item['product_id']) $item['sold'] += (float) $sale['sold'];
    foreach ($productionByProduct as $production) if ((int) $production['product_id'] === $item['product_id']) $item['produced'] = (float) $production['quantity'];
    foreach ($wasteByProduct as $waste) if ((int) $waste['id'] === $item['product_id']) $item['waste'] = (float) $waste['quantity'];
    $productPerformance[] = $item;
}

$todayRevenue = analyticsScalar($conn, "SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders FROM orders WHERE LOWER(status) = 'completed' AND DATE(created_at) = CURDATE()");
$weekRevenue = analyticsScalar($conn, "SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE LOWER(status) = 'completed' AND created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND created_at < CURDATE() + INTERVAL 1 DAY");
$monthRevenue = analyticsScalar($conn, "SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE LOWER(status) = 'completed' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())");

analyticsJson(true, [
    'filters' => ['start_date' => $start, 'end_date' => $end, 'product_id' => $productId ?: null, 'category' => $category ?: null, 'ingredient_id' => $ingredientId ?: null, 'movement_type' => $movementType ?: null],
    'summary' => ['revenue' => $revenue, 'orders' => $ordersCount, 'average_order_value' => $ordersCount ? $revenue / $ordersCount : null, 'today_revenue' => (float) ($todayRevenue['revenue'] ?? 0), 'today_orders' => (int) ($todayRevenue['orders'] ?? 0), 'weekly_revenue' => (float) ($weekRevenue['revenue'] ?? 0), 'monthly_revenue' => (float) ($monthRevenue['revenue'] ?? 0), 'production_quantity' => array_sum(array_map(static fn($row) => (float) $row['quantity'], $productionByProduct)), 'waste_quantity' => $wasteQuantity, 'waste_cost' => $wasteCost, 'production_cost' => $productionCost, 'waste_rate' => $productionCost > 0 ? ($wasteCost / $productionCost) * 100 : null],
    'sales' => ['daily' => $dailyRevenue, 'best_selling_products' => array_slice($sales, 0, 10)],
    'production' => ['by_product' => $productionByProduct, 'by_day' => $productionByDay],
    'inventory' => ['products' => $inventory, 'low_stock' => $lowStock, 'out_of_stock' => $outOfStock, 'low_stock_frequency' => $lowStockFrequency, 'ingredient_inventory' => $ingredientInventory, 'movement_summary' => $movementSummary, 'movement_by_product' => $movementByProduct, 'fast_moving' => array_slice($movementByProduct, 0, 10), 'slow_moving' => array_slice(array_reverse($movementByProduct), 0, 10)],
    'ingredient_consumption' => $ingredientConsumption,
    'waste' => ['by_reason' => $wasteByReason, 'by_product' => array_values($wasteByProduct), 'by_ingredient' => array_values($wasteByIngredient), 'by_date' => $wasteByDate],
    'product_performance' => $productPerformance,
    'has_data' => ['sales' => $ordersCount > 0, 'production' => count($productionByProduct) > 0, 'waste' => count($wasteRows) > 0, 'ingredient_consumption' => count($ingredientConsumption) > 0],
]);
