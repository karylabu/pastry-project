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

function analyticsIsCakeCategory(string $category): bool
{
    return str_contains(strtolower(trim($category)), 'cake');
}

function analyticsRows(mysqli $conn, string $sql, string $types = '', array $values = []): array
{
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        error_log('Business analytics query preparation failed: ' . $conn->error);
        analyticsJson(false, ['message' => 'Analytics query preparation failed.'], 500);
    }
    if ($types !== '') $stmt->bind_param($types, ...$values);
    if (!$stmt->execute()) {
        error_log('Business analytics query failed: ' . $stmt->error);
        analyticsJson(false, ['message' => 'Analytics query failed.'], 500);
    }
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
            $category = trim((string) ($product['category'] ?? ($item['category'] ?? 'Other')));
            if (!analyticsIsCakeCategory($category)) continue;
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

require_once __DIR__ . '/../includes/db.php';
if (!($conn instanceof mysqli)) {
    error_log('Business analytics database connection failed: ' . ($db_error ?: 'Unknown database connection error.'));
    analyticsJson(false, ['message' => 'Database connection failed.'], 500);
}
$legacySalesTable = $conn->query("SHOW TABLES LIKE 'sales'");
$hasLegacySales = $legacySalesTable instanceof mysqli_result && $legacySalesTable->num_rows > 0;

$today = date('Y-m-d');
$isAllTime = (string) ($_GET['all'] ?? '') === '1';
$startFallback = date('Y-m-d', strtotime('-30 days'));
if ($isAllTime) {
    $firstSaleDates = [];
    $firstOrder = analyticsScalar($conn, "SELECT DATE(MIN(created_at)) AS first_sale FROM orders WHERE LOWER(status) = 'completed'");
    if (!empty($firstOrder['first_sale'])) $firstSaleDates[] = (string) $firstOrder['first_sale'];
    $firstImport = analyticsScalar($conn, "SELECT MIN(history.sale_date) AS first_sale FROM analytics_sales_history AS history INNER JOIN analytics_imports AS imports ON imports.id = history.import_id WHERE imports.status = 'completed'");
    if (!empty($firstImport['first_sale'])) $firstSaleDates[] = (string) $firstImport['first_sale'];
    if ($hasLegacySales) {
        $firstLegacy = analyticsScalar($conn, 'SELECT MIN(sale_date) AS first_sale FROM sales');
        if (!empty($firstLegacy['first_sale'])) $firstSaleDates[] = (string) $firstLegacy['first_sale'];
    }
    if ($firstSaleDates) $startFallback = min($firstSaleDates);
}
$start = analyticsDate(trim((string) ($_GET['start_date'] ?? '')), $startFallback);
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
$customCakeRows = analyticsRows($conn, "SELECT custom.order_id, custom.quantity, custom.flavor, custom.estimated_price, orders.subtotal, orders.total FROM custom_cake_orders AS custom INNER JOIN orders ON orders.id = custom.order_id WHERE LOWER(orders.status) = 'completed' AND orders.created_at >= ? AND orders.created_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY orders.created_at", 'ss', [$start . ' 00:00:00', $end]);
$customCakeSales = [];
if ($productId === 0 && ($category === '' || stripos($category, 'customized') !== false)) {
    foreach ($customCakeRows as $customCake) {
        $quantity = max(1, (float) ($customCake['quantity'] ?? 1));
        $revenueAmount = (float) ($customCake['subtotal'] ?? 0) > 0
            ? (float) $customCake['subtotal']
            : ((float) ($customCake['total'] ?? 0) > 0
                ? (float) $customCake['total']
                : (float) ($customCake['estimated_price'] ?? 0) * $quantity);
        $flavor = trim((string) ($customCake['flavor'] ?? ''));
        $customCakeSales[] = [
            'product_id' => 0,
            'product' => $flavor !== '' ? 'Customized Cake - ' . $flavor : 'Customized Cake',
            'category' => 'Customized Cakes',
            'sold' => $quantity,
            'revenue' => $revenueAmount,
        ];
    }
}
$revenue = 0.0;
foreach ($orderRows as $order) $revenue += (float) $order['total'];
$ordersCount = count($orderRows);

$historicalRows = analyticsRows($conn, "SELECT history.product_name, history.sale_date, imports.sales_type, SUM(history.units_sold) AS units_sold, SUM(history.revenue) AS revenue, COUNT(*) AS record_count FROM analytics_sales_history AS history INNER JOIN analytics_imports AS imports ON imports.id = history.import_id WHERE imports.status = 'completed' AND history.sale_date >= ? AND history.sale_date <= ? GROUP BY history.product_name, history.sale_date, imports.sales_type ORDER BY history.sale_date", 'ss', [$start, $end]);
$legacySalesRows = $hasLegacySales ? analyticsRows($conn, 'SELECT cake_name AS product_name, sale_date, 1 AS units_sold, price AS revenue FROM sales WHERE sale_date >= ? AND sale_date <= ? ORDER BY sale_date', 'ss', [$start, $end]) : [];
$historicalRevenue = 0.0;
$historicalDownPayments = 0.0;
$historicalRemainingBalance = 0.0;
$historicalRecords = 0;
$historicalDaily = [];
$historicalProducts = [];
$importedRevenueByType = ['customized_cake' => 0.0, 'finished_product' => 0.0, 'other' => 0.0];
foreach (array_merge($historicalRows, array_map(static fn ($row) => $row + ['source' => 'legacy'], $legacySalesRows)) as $historical) {
    $name = trim((string) $historical['product_name']);
    $quantity = (float) $historical['units_sold'];
    $revenueAmount = (float) $historical['revenue'];
    $productIdForSale = 0;
    $salesType = (string) ($historical['sales_type'] ?? 'other');
    $productCategory = ($historical['source'] ?? '') === 'legacy'
        ? 'Cakes'
        : match ($salesType) {
            'customized_cake' => 'Customized Cakes',
            'finished_product' => 'Finished Products',
            default => 'Imported Sales',
        };
    foreach ($productsRows as $productRow) {
        if (strcasecmp(trim((string) $productRow['name']), $name) === 0) {
            $productIdForSale = (int) $productRow['id'];
            if (($historical['source'] ?? '') === 'legacy' || $salesType === 'other') {
                $productCategory = (string) $productRow['category'];
            }
            break;
        }
    }
    if (($historical['source'] ?? '') === 'legacy' && !analyticsIsCakeCategory($productCategory)) continue;
    if ($productId > 0 && $productIdForSale !== $productId) continue;
    if ($category !== '' && strcasecmp($productCategory, $category) !== 0) continue;

    $recordCount = (int) ($historical['record_count'] ?? 1);
    $historicalRecords += $recordCount;
    $historicalRevenue += $revenueAmount;
    if (($historical['source'] ?? '') !== 'legacy') {
        $importedRevenueByType[$salesType] = ($importedRevenueByType[$salesType] ?? 0) + $revenueAmount;
    }
    $date = (string) $historical['sale_date'];
    if (!isset($historicalDaily[$date])) $historicalDaily[$date] = ['date' => $date, 'revenue' => 0, 'orders' => 0];
    $historicalDaily[$date]['revenue'] += $revenueAmount;
    $historicalDaily[$date]['orders'] += $recordCount;
    if (!isset($historicalProducts[$name])) $historicalProducts[$name] = ['product_id' => $productIdForSale, 'product' => $name, 'category' => $productCategory, 'sold' => 0, 'revenue' => 0];
    $historicalProducts[$name]['sold'] += $quantity;
    $historicalProducts[$name]['revenue'] += $revenueAmount;
}
$revenue += $historicalRevenue;
$ordersCount += $historicalRecords;
$sales = array_merge($sales, $customCakeSales);

$dailyRevenue = analyticsRows($conn, "SELECT DATE(created_at) AS date, COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders FROM orders WHERE LOWER(status) = 'completed' AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY DATE(created_at) ORDER BY date", 'ss', [$start . ' 00:00:00', $end]);
$legacyDailyRevenue = $hasLegacySales ? analyticsRows($conn, 'SELECT sale_date AS date, COALESCE(SUM(price), 0) AS revenue, COUNT(*) AS orders FROM sales WHERE sale_date >= ? AND sale_date <= ? GROUP BY sale_date ORDER BY sale_date', 'ss', [$start, $end]) : [];
$dailyRevenueByDate = [];
foreach ($dailyRevenue as $daily) $dailyRevenueByDate[(string) $daily['date']] = ['date' => (string) $daily['date'], 'revenue' => (float) $daily['revenue'], 'orders' => (int) $daily['orders']];
foreach ($historicalDaily as $date => $daily) {
    if (!isset($dailyRevenueByDate[$date])) $dailyRevenueByDate[$date] = $daily;
    else { $dailyRevenueByDate[$date]['revenue'] += $daily['revenue']; $dailyRevenueByDate[$date]['orders'] += $daily['orders']; }
}
foreach ($legacyDailyRevenue as $daily) {
    $date = (string) $daily['date'];
    if (!isset($dailyRevenueByDate[$date])) $dailyRevenueByDate[$date] = ['date' => $date, 'revenue' => 0, 'orders' => 0];
    $dailyRevenueByDate[$date]['revenue'] += (float) $daily['revenue'];
    $dailyRevenueByDate[$date]['orders'] += (int) $daily['orders'];
}
$dailyRevenue = array_values($dailyRevenueByDate);
usort($dailyRevenue, static fn($a, $b) => strcmp($a['date'], $b['date']));
$historicalProductSales = array_values($historicalProducts);
$sales = array_merge($sales, $historicalProductSales);
usort($sales, static fn($a, $b) => $b['revenue'] <=> $a['revenue']);
$productionByProduct = analyticsRows($conn, "SELECT pt.product_id, p.name AS product, p.category, SUM(pt.quantity) AS quantity FROM production_transactions pt INNER JOIN products p ON p.id = pt.product_id WHERE LOWER(p.category) LIKE '%cake%' AND pt.created_at >= ? AND pt.created_at < DATE_ADD(?, INTERVAL 1 DAY) " . ($productId > 0 ? 'AND pt.product_id = ? ' : '') . ($category !== '' ? 'AND LOWER(p.category) = LOWER(?) ' : '') . "GROUP BY pt.product_id, p.name, p.category ORDER BY quantity DESC", $productId > 0 && $category !== '' ? 'ssis' : ($productId > 0 ? 'ssi' : ($category !== '' ? 'sss' : 'ss')), $productId > 0 && $category !== '' ? [$start . ' 00:00:00', $end, $productId, $category] : ($productId > 0 ? [$start . ' 00:00:00', $end, $productId] : ($category !== '' ? [$start . ' 00:00:00', $end, $category] : [$start . ' 00:00:00', $end])));
$productionByDay = analyticsRows($conn, "SELECT DATE(pt.created_at) AS date, SUM(pt.quantity) AS quantity FROM production_transactions pt INNER JOIN products p ON p.id = pt.product_id WHERE LOWER(p.category) LIKE '%cake%' AND pt.created_at >= ? AND pt.created_at < DATE_ADD(?, INTERVAL 1 DAY) " . ($productId > 0 ? 'AND pt.product_id = ? ' : '') . ($category !== '' ? 'AND LOWER(p.category) = LOWER(?) ' : '') . "GROUP BY DATE(pt.created_at) ORDER BY date", $productId > 0 && $category !== '' ? 'ssis' : ($productId > 0 ? 'ssi' : ($category !== '' ? 'sss' : 'ss')), $productId > 0 && $category !== '' ? [$start . ' 00:00:00', $end, $productId, $category] : ($productId > 0 ? [$start . ' 00:00:00', $end, $productId] : ($category !== '' ? [$start . ' 00:00:00', $end, $category] : [$start . ' 00:00:00', $end])));

$movementConditions = ['m.created_at >= ?', 'm.created_at < DATE_ADD(?, INTERVAL 1 DAY)'];
$movementTypes = 'ss';
$movementValues = [$start . ' 00:00:00', $end];
if ($productId > 0) { $movementConditions[] = 'm.product_id = ?'; $movementTypes .= 'i'; $movementValues[] = $productId; }
if ($movementType !== '') { $movementConditions[] = 'm.movement_type = ?'; $movementTypes .= 's'; $movementValues[] = $movementType; }
$movementWhere = implode(' AND ', $movementConditions);
$movementSummary = analyticsRows($conn, "SELECT m.movement_type, SUM(m.quantity) AS quantity FROM product_inventory_movements m INNER JOIN products p ON p.id = m.product_id WHERE {$movementWhere} AND LOWER(p.category) LIKE '%cake%' GROUP BY m.movement_type ORDER BY ABS(SUM(m.quantity)) DESC", $movementTypes, $movementValues);
$movementByProduct = analyticsRows($conn, "SELECT m.product_id, p.name AS product, SUM(CASE WHEN m.quantity < 0 THEN -m.quantity ELSE 0 END) AS consumed, SUM(m.quantity) AS net_change FROM product_inventory_movements m INNER JOIN products p ON p.id = m.product_id WHERE {$movementWhere} AND LOWER(p.category) LIKE '%cake%' GROUP BY m.product_id, p.name ORDER BY consumed DESC", $movementTypes, $movementValues);

$ingredientConditions = ['im.created_at >= ?', 'im.created_at < DATE_ADD(?, INTERVAL 1 DAY)', "im.action = 'stock_out'", "im.reference_type IN ('production', 'order')"];
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
$wasteRows = analyticsRows($conn, "SELECT w.id, w.item, w.qty, w.unit_cost, w.item_type, w.reason, w.product_id, w.ingredient_id, w.datetime, COALESCE(p.name, i.name, w.item) AS item_name FROM waste_log w LEFT JOIN products p ON p.id = w.product_id LEFT JOIN ingredients i ON i.id = w.ingredient_id WHERE {$wasteWhere} AND (w.product_id IS NULL OR LOWER(p.category) LIKE '%cake%') ORDER BY w.datetime DESC", $wasteTypes, $wasteValues);
$recentWasteRows = [];
if (count($wasteRows) === 0) {
    $recentWasteConditions = [];
    $recentWasteTypes = '';
    $recentWasteValues = [];
    if ($productId > 0) { $recentWasteConditions[] = 'w.product_id = ?'; $recentWasteTypes .= 'i'; $recentWasteValues[] = $productId; }
    if ($ingredientId > 0) { $recentWasteConditions[] = 'w.ingredient_id = ?'; $recentWasteTypes .= 'i'; $recentWasteValues[] = $ingredientId; }
    $recentWasteWhere = $recentWasteConditions ? ' AND ' . implode(' AND ', $recentWasteConditions) : '';
    $recentWasteRows = analyticsRows($conn, "SELECT w.id, w.item, w.qty, w.unit_cost, w.item_type, w.reason, w.datetime, COALESCE(p.name, i.name, w.item) AS item_name FROM waste_log w LEFT JOIN products p ON p.id = w.product_id LEFT JOIN ingredients i ON i.id = w.ingredient_id WHERE (w.product_id IS NULL OR LOWER(p.category) LIKE '%cake%'){$recentWasteWhere} ORDER BY w.datetime DESC LIMIT 5", $recentWasteTypes, $recentWasteValues);
}
$wasteByReason = analyticsRows($conn, "SELECT reason, SUM(qty) AS quantity, SUM(qty * unit_cost) AS cost FROM waste_log w WHERE {$wasteWhere} GROUP BY reason ORDER BY cost DESC", $wasteTypes, $wasteValues);
$wasteByDate = analyticsRows($conn, "SELECT DATE(datetime) AS date, SUM(qty) AS quantity, SUM(qty * unit_cost) AS cost FROM waste_log w WHERE {$wasteWhere} GROUP BY DATE(datetime) ORDER BY date", $wasteTypes, $wasteValues);
$wasteBySeason = analyticsRows($conn, "SELECT YEAR(w.datetime) AS year, CASE WHEN MONTH(w.datetime) IN (12, 1, 2) THEN 'Cool Dry (Dec-Feb)' WHEN MONTH(w.datetime) IN (3, 4, 5) THEN 'Hot Dry (Mar-May)' ELSE 'Rainy (Jun-Nov)' END AS season, SUM(w.qty) AS quantity, SUM(w.qty * w.unit_cost) AS cost, COUNT(*) AS records FROM waste_log w WHERE {$wasteWhere} GROUP BY YEAR(w.datetime), season ORDER BY year, MIN(MONTH(w.datetime))", $wasteTypes, $wasteValues);
$seasonalWasteOutsidePeriod = false;
if (count($wasteBySeason) === 0) {
    $seasonalWasteConditions = [];
    $seasonalWasteTypes = '';
    $seasonalWasteValues = [];
    if ($productId > 0) { $seasonalWasteConditions[] = 'w.product_id = ?'; $seasonalWasteTypes .= 'i'; $seasonalWasteValues[] = $productId; }
    if ($ingredientId > 0) { $seasonalWasteConditions[] = 'w.ingredient_id = ?'; $seasonalWasteTypes .= 'i'; $seasonalWasteValues[] = $ingredientId; }
    $seasonalWasteWhere = $seasonalWasteConditions ? ' AND ' . implode(' AND ', $seasonalWasteConditions) : '';
    $wasteBySeason = analyticsRows($conn, "SELECT YEAR(w.datetime) AS year, CASE WHEN MONTH(w.datetime) IN (12, 1, 2) THEN 'Cool Dry (Dec-Feb)' WHEN MONTH(w.datetime) IN (3, 4, 5) THEN 'Hot Dry (Mar-May)' ELSE 'Rainy (Jun-Nov)' END AS season, SUM(w.qty) AS quantity, SUM(w.qty * w.unit_cost) AS cost, COUNT(*) AS records FROM waste_log w LEFT JOIN products p ON p.id = w.product_id WHERE (w.product_id IS NULL OR LOWER(p.category) LIKE '%cake%'){$seasonalWasteWhere} GROUP BY YEAR(w.datetime), season ORDER BY year, MIN(MONTH(w.datetime))", $seasonalWasteTypes, $seasonalWasteValues);
    $seasonalWasteOutsidePeriod = count($wasteBySeason) > 0;
}
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

$productionCostRow = analyticsScalar($conn, "SELECT COALESCE(SUM(pt.quantity * p.production_cost), 0) AS cost FROM production_transactions pt INNER JOIN products p ON p.id = pt.product_id WHERE LOWER(p.category) LIKE '%cake%' AND pt.created_at >= ? AND pt.created_at < DATE_ADD(?, INTERVAL 1 DAY)" . ($productId > 0 ? ' AND pt.product_id = ?' : ''), $productId > 0 ? 'ssi' : 'ss', $productId > 0 ? [$start . ' 00:00:00', $end, $productId] : [$start . ' 00:00:00', $end]);
$productionCost = (float) ($productionCostRow['cost'] ?? 0);

$inventory = [];
foreach ($productsRows as $product) {
    if (!analyticsIsCakeCategory((string) $product['category'])) continue;
    if ($productId > 0 && (int) $product['id'] !== $productId) continue;
    if ($category !== '' && strcasecmp($category, (string) $product['category']) !== 0) continue;
    $stock = (float) $product['stock']; $minimum = (float) $product['minimum_stock'];
    $inventory[] = ['product_id' => (int) $product['id'], 'product' => $product['name'], 'category' => $product['category'], 'current_stock' => $stock, 'minimum_stock' => $minimum, 'status' => $stock <= 0 ? 'Out of Stock' : ($stock <= $minimum ? 'Low Stock' : 'In Stock')];
}
$lowStock = array_values(array_filter($inventory, static fn($item) => $item['status'] === 'Low Stock'));
$outOfStock = array_values(array_filter($inventory, static fn($item) => $item['status'] === 'Out of Stock'));
$lowStockFrequency = analyticsRows($conn, "SELECT m.product_id, p.name AS product, COUNT(*) AS low_stock_events FROM product_inventory_movements m INNER JOIN products p ON p.id = m.product_id WHERE LOWER(p.category) LIKE '%cake%' AND m.new_stock <= p.minimum_stock AND m.created_at >= ? AND m.created_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY m.product_id, p.name ORDER BY low_stock_events DESC", 'ss', [$start . ' 00:00:00', $end]);
$ingredientInventory = analyticsRows($conn, "SELECT i.id AS ingredient_id, i.name AS ingredient, i.unit, COALESCE(batch_stock.usable_stock, 0) AS stock, i.threshold, CASE WHEN COALESCE(batch_stock.usable_stock, 0) <= 0 THEN 'Out of Stock' WHEN COALESCE(batch_stock.usable_stock, 0) <= i.threshold THEN 'Low Stock' ELSE 'In Stock' END AS status FROM ingredients i LEFT JOIN (SELECT ib.ingredient_id, SUM(ib.quantity_remaining) AS usable_stock FROM ingredient_batches ib WHERE ib.quantity_remaining > 0 AND (ib.expiry_date IS NULL OR ib.expiry_date >= CURDATE()) AND NOT EXISTS (SELECT 1 FROM discard_requests dr WHERE dr.ingredient_batch_id = ib.id AND dr.status = 'Pending') GROUP BY ib.ingredient_id) batch_stock ON batch_stock.ingredient_id = i.id ORDER BY stock ASC, ingredient ASC");

$productPerformance = [];
foreach ($inventory as $item) {
    $item['sold'] = 0; $item['produced'] = 0; $item['waste'] = 0;
    foreach ($sales as $sale) if ((int) $sale['product_id'] === $item['product_id']) $item['sold'] += (float) $sale['sold'];
    foreach ($productionByProduct as $production) if ((int) $production['product_id'] === $item['product_id']) $item['produced'] = (float) $production['quantity'];
    foreach ($wasteByProduct as $waste) if ((int) $waste['id'] === $item['product_id']) $item['waste'] = (float) $waste['quantity'];
    $productPerformance[] = $item;
}
if ($customCakeSales) {
    $productPerformance[] = [
        'product_id' => 0,
        'product' => 'Customized Cakes',
        'category' => 'Customized Cakes',
        'current_stock' => 0,
        'minimum_stock' => 0,
        'status' => 'Made to order',
        'sold' => array_sum(array_column($customCakeSales, 'sold')),
        'produced' => 0,
        'waste' => 0,
    ];
}

$salesByProduct = [];
foreach ($sales as $sale) {
    $saleProductId = (int) ($sale['product_id'] ?? 0);
    if ($saleProductId <= 0) continue;
    $salesByProduct[$saleProductId] = ($salesByProduct[$saleProductId] ?? 0) + (float) ($sale['sold'] ?? 0);
}
$lowStockEventsByProduct = [];
foreach ($lowStockFrequency as $row) {
    $lowStockEventsByProduct[(int) $row['product_id']] = (int) $row['low_stock_events'];
}
$productsWithSales = array_filter($salesByProduct, static fn($sold) => $sold > 0);
$highSalesThreshold = count($productsWithSales) > 0
    ? array_sum($productsWithSales) / count($productsWithSales)
    : 0;
$frequentStockoutThreshold = 2;
$highSalesStockoutRisk = [];
foreach ($inventory as $product) {
    $productIdForDiagnostic = (int) $product['product_id'];
    $sold = (float) ($salesByProduct[$productIdForDiagnostic] ?? 0);
    $stockoutEvents = (int) ($lowStockEventsByProduct[$productIdForDiagnostic] ?? 0);
    if ($sold <= 0 || $sold < $highSalesThreshold || $stockoutEvents < $frequentStockoutThreshold) continue;
    $highSalesStockoutRisk[] = [
        'product_id' => $productIdForDiagnostic,
        'product' => $product['product'],
        'sold' => $sold,
        'low_stock_events' => $stockoutEvents,
        'current_stock' => (float) $product['current_stock'],
        'sales_threshold' => round($highSalesThreshold, 2),
    ];
}
usort($highSalesStockoutRisk, static fn($a, $b) => $b['low_stock_events'] <=> $a['low_stock_events'] ?: $b['sold'] <=> $a['sold']);
$highSalesStockoutRiskOutsidePeriod = false;
if (count($highSalesStockoutRisk) === 0) {
    $riskOrderRows = analyticsRows($conn, "SELECT id, items, total, created_at FROM orders WHERE LOWER(status) = 'completed' AND created_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY created_at", 's', [$end]);
    $riskSalesByProduct = [];
    foreach (analyticsOrderItems($riskOrderRows, $products, $productId, $category) as $sale) {
        $riskProductId = (int) ($sale['product_id'] ?? 0);
        if ($riskProductId > 0) $riskSalesByProduct[$riskProductId] = ($riskSalesByProduct[$riskProductId] ?? 0) + (float) ($sale['sold'] ?? 0);
    }
    $riskHistoricalRows = analyticsRows($conn, "SELECT history.product_name, SUM(history.units_sold) AS units_sold FROM analytics_sales_history AS history INNER JOIN analytics_imports AS imports ON imports.id = history.import_id WHERE imports.status = 'completed' AND history.sale_date <= ? GROUP BY history.product_name", 's', [$end]);
    $riskLegacyRows = $hasLegacySales
        ? analyticsRows($conn, 'SELECT cake_name AS product_name, COUNT(*) AS units_sold FROM sales WHERE sale_date <= ? GROUP BY cake_name', 's', [$end])
        : [];
    foreach (array_merge($riskHistoricalRows, $riskLegacyRows) as $riskSale) {
        foreach ($productsRows as $productRow) {
            if (strcasecmp(trim((string) $productRow['name']), trim((string) $riskSale['product_name'])) !== 0) continue;
            if (!analyticsIsCakeCategory((string) $productRow['category'])) break;
            if ($productId > 0 && (int) $productRow['id'] !== $productId) break;
            if ($category !== '' && strcasecmp((string) $productRow['category'], $category) !== 0) break;
            $riskMatchedProductId = (int) $productRow['id'];
            $riskSalesByProduct[$riskMatchedProductId] = ($riskSalesByProduct[$riskMatchedProductId] ?? 0) + (float) $riskSale['units_sold'];
            break;
        }
    }
    $riskLowStockRows = analyticsRows($conn, "SELECT m.product_id, COUNT(*) AS low_stock_events FROM product_inventory_movements m INNER JOIN products p ON p.id = m.product_id WHERE LOWER(p.category) LIKE '%cake%' AND m.new_stock <= p.minimum_stock AND m.created_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY m.product_id", 's', [$end]);
    $riskLowStockByProduct = [];
    foreach ($riskLowStockRows as $row) $riskLowStockByProduct[(int) $row['product_id']] = (int) $row['low_stock_events'];
    $riskProductsWithSales = array_filter($riskSalesByProduct, static fn($sold) => $sold > 0);
    $riskSalesThreshold = count($riskProductsWithSales) > 0
        ? array_sum($riskProductsWithSales) / count($riskProductsWithSales)
        : 0;
    foreach ($inventory as $product) {
        $riskProductId = (int) $product['product_id'];
        $sold = (float) ($riskSalesByProduct[$riskProductId] ?? 0);
        $stockoutEvents = (int) ($riskLowStockByProduct[$riskProductId] ?? 0);
        if ($sold <= 0 || $sold < $riskSalesThreshold || $stockoutEvents < $frequentStockoutThreshold) continue;
        $highSalesStockoutRisk[] = [
            'product_id' => $riskProductId,
            'product' => $product['product'],
            'sold' => $sold,
            'low_stock_events' => $stockoutEvents,
            'current_stock' => (float) $product['current_stock'],
            'sales_threshold' => round($riskSalesThreshold, 2),
        ];
    }
    usort($highSalesStockoutRisk, static fn($a, $b) => $b['low_stock_events'] <=> $a['low_stock_events'] ?: $b['sold'] <=> $a['sold']);
    $highSalesStockoutRiskOutsidePeriod = count($highSalesStockoutRisk) > 0;
}

$todayRevenue = analyticsScalar($conn, "SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders FROM orders WHERE LOWER(status) = 'completed' AND DATE(created_at) = CURDATE()");
$todayHistorical = analyticsScalar($conn, "SELECT COALESCE(SUM(revenue), 0) AS revenue, COUNT(*) AS orders FROM analytics_sales_history WHERE import_id IS NOT NULL AND sale_date = CURDATE()");
$todayLegacy = $hasLegacySales ? analyticsScalar($conn, "SELECT COALESCE(SUM(price), 0) AS revenue, COUNT(*) AS orders FROM sales WHERE sale_date = CURDATE()") : [];
$weekRevenue = analyticsScalar($conn, "SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE LOWER(status) = 'completed' AND created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND created_at < CURDATE() + INTERVAL 1 DAY");
$weekHistorical = analyticsScalar($conn, "SELECT COALESCE(SUM(revenue), 0) AS revenue FROM analytics_sales_history WHERE import_id IS NOT NULL AND sale_date >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND sale_date < CURDATE() + INTERVAL 1 DAY");
$weekLegacy = $hasLegacySales ? analyticsScalar($conn, "SELECT COALESCE(SUM(price), 0) AS revenue FROM sales WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND sale_date < CURDATE() + INTERVAL 1 DAY") : [];
$monthRevenue = analyticsScalar($conn, "SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE LOWER(status) = 'completed' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())");
$monthHistorical = analyticsScalar($conn, "SELECT COALESCE(SUM(revenue), 0) AS revenue FROM analytics_sales_history WHERE import_id IS NOT NULL AND YEAR(sale_date) = YEAR(CURDATE()) AND MONTH(sale_date) = MONTH(CURDATE())");
$monthLegacy = $hasLegacySales ? analyticsScalar($conn, "SELECT COALESCE(SUM(price), 0) AS revenue FROM sales WHERE YEAR(sale_date) = YEAR(CURDATE()) AND MONTH(sale_date) = MONTH(CURDATE())") : [];

analyticsJson(true, [
    'filters' => ['start_date' => $start, 'end_date' => $end, 'product_id' => $productId ?: null, 'category' => $category ?: null, 'ingredient_id' => $ingredientId ?: null, 'movement_type' => $movementType ?: null],
    'summary' => ['revenue' => $revenue, 'orders' => $ordersCount, 'customized_cake_sales' => $importedRevenueByType['customized_cake'], 'imported_sales_records' => $historicalRecords, 'imported_revenue_by_type' => $importedRevenueByType, 'total_down_payments' => $historicalDownPayments, 'total_remaining_balance' => $historicalRemainingBalance, 'average_order_value' => $ordersCount ? $revenue / $ordersCount : null, 'today_revenue' => (float) ($todayRevenue['revenue'] ?? 0) + (float) ($todayHistorical['revenue'] ?? 0) + (float) ($todayLegacy['revenue'] ?? 0), 'today_orders' => (int) ($todayRevenue['orders'] ?? 0) + (int) ($todayHistorical['orders'] ?? 0) + (int) ($todayLegacy['orders'] ?? 0), 'weekly_revenue' => (float) ($weekRevenue['revenue'] ?? 0) + (float) ($weekHistorical['revenue'] ?? 0) + (float) ($weekLegacy['revenue'] ?? 0), 'monthly_revenue' => (float) ($monthRevenue['revenue'] ?? 0) + (float) ($monthHistorical['revenue'] ?? 0) + (float) ($monthLegacy['revenue'] ?? 0), 'production_quantity' => array_sum(array_map(static fn($row) => (float) $row['quantity'], $productionByProduct)), 'waste_quantity' => $wasteQuantity, 'waste_cost' => $wasteCost, 'production_cost' => $productionCost, 'waste_rate' => $productionCost > 0 ? ($wasteCost / $productionCost) * 100 : null],
    'sales' => ['daily' => $dailyRevenue, 'best_selling_products' => array_slice($sales, 0, 10)],
    'production' => ['by_product' => $productionByProduct, 'by_day' => $productionByDay],
    'inventory' => ['products' => $inventory, 'low_stock' => $lowStock, 'out_of_stock' => $outOfStock, 'low_stock_frequency' => $lowStockFrequency, 'ingredient_inventory' => $ingredientInventory, 'movement_summary' => $movementSummary, 'movement_by_product' => $movementByProduct, 'fast_moving' => array_slice($movementByProduct, 0, 10), 'slow_moving' => array_slice(array_reverse($movementByProduct), 0, 10)],
    'ingredient_consumption' => $ingredientConsumption,
    'waste' => ['by_reason' => $wasteByReason, 'by_product' => array_values($wasteByProduct), 'by_ingredient' => array_values($wasteByIngredient), 'by_date' => $wasteByDate, 'by_season' => $wasteBySeason, 'seasonal_outside_period' => $seasonalWasteOutsidePeriod, 'recent_outside_period' => $recentWasteRows],
    'product_performance' => $productPerformance,
    'diagnostics' => [
        'high_sales_stockout_risk' => $highSalesStockoutRisk,
        'high_sales_stockout_risk_outside_period' => $highSalesStockoutRiskOutsidePeriod,
        'high_sales_threshold' => round($highSalesThreshold, 2),
        'frequent_stockout_threshold' => $frequentStockoutThreshold,
    ],
    'has_data' => ['sales' => $ordersCount > 0, 'production' => count($productionByProduct) > 0, 'waste' => count($wasteRows) > 0, 'ingredient_consumption' => count($ingredientConsumption) > 0],
]);
