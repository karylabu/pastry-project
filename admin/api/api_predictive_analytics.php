<?php
require_once __DIR__ . '/../../customer/cors.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/api_auth.php';
require_once __DIR__ . '/../../includes/predictive_forecasting.php'; // coverage helpers
require_once __DIR__ . '/../../includes/forecast_engine.php';        // methods, metrics, backtest

/*
| SCHEMA NOTE: The analytics_* tables are created by the versioned migration
| database/migrations/2026_08_25_06_analytics_tables.sql. This API must never
| run CREATE TABLE / ALTER TABLE statements at request time.
*/

// ---------------------------------------------------------------------------
// Name handling
// ---------------------------------------------------------------------------

function normalizeProductName(mixed $value): string {
    $text = (string) $value;
    $collapsed = preg_replace('/[\s\x{00A0}]+/u', ' ', $text);
    return trim($collapsed ?? $text);
}

/**
 * Key used to match the same product across CSV imports, live orders, the catalogue and recipes.
 * CSVs often use a curly apostrophe ("S’mores") while the catalogue uses a straight one, which
 * previously made the same product look like two different products.
 */
function productMatchKey(mixed $value): string {
    $name = normalizeProductName($value);
    $name = str_replace(["\u{2019}", "\u{2018}", "\u{02BC}", "\u{00B4}", '`'], "'", $name);
    $name = str_replace(["\u{201C}", "\u{201D}"], '"', $name);
    return mb_strtolower($name, 'UTF-8');
}

function normalizeAliasKey(string $value): string {
    return productMatchKey($value);
}

function getProductAliasMap(mysqli $conn): array {
    $table = mysqli_query($conn, "SHOW TABLES LIKE 'analytics_product_aliases'");
    if (!$table || mysqli_num_rows($table) === 0) {
        if ($table) mysqli_free_result($table);
        return [];
    }
    mysqli_free_result($table);

    $result = mysqli_query($conn, "
        SELECT aliases.normalized_alias, products.name AS product_name
        FROM analytics_product_aliases AS aliases
        INNER JOIN products ON products.id = aliases.product_id
        WHERE LOWER(TRIM(products.category)) IN ('cake', 'cakes', 'customized cake', 'customized cakes')
    ");
    if (!$result) {
        error_log('Predictive analytics product alias query failed: ' . mysqli_error($conn));
        return [];
    }

    $aliases = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $alias = normalizeAliasKey((string) ($row['normalized_alias'] ?? ''));
        $product = normalizeProductName($row['product_name'] ?? '');
        if ($alias !== '' && $product !== '') {
            $aliases[$alias] = $product;
        }
    }
    mysqli_free_result($result);

    return $aliases;
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

function getSalesHistory(mysqli $conn): array {
    $history = [];

    $tables = mysqli_query($conn, "SHOW TABLES LIKE 'order_items'");
    $hasOrderItems = $tables && mysqli_num_rows($tables) > 0;
    if ($tables) mysqli_free_result($tables);

    if ($hasOrderItems) {
        $sql = "
            SELECT DATE(o.created_at) AS order_date, oi.product, SUM(oi.qty) AS quantity, COUNT(*) AS record_count
            FROM orders o
            INNER JOIN order_items oi ON oi.order_id = o.id
            WHERE (o.status IS NULL OR o.status NOT IN ('Cancelled', 'cancelled'))
            AND oi.product IS NOT NULL AND TRIM(oi.product) <> ''
            GROUP BY DATE(o.created_at), oi.product
            ORDER BY order_date ASC, oi.product ASC
        ";
    } else {
        $sql = "
            SELECT created_at AS order_date, items
            FROM orders
            WHERE status IS NULL OR status NOT IN ('Cancelled', 'cancelled')
            ORDER BY created_at ASC
        ";
    }

    $result = mysqli_query($conn, $sql);
    if (!$result) {
        return $history;
    }

    $dailyHistory = [];
    while ($row = mysqli_fetch_assoc($result)) {
        if ($hasOrderItems) {
            $orderDate = $row['order_date'] ?? '';
            $product = normalizeProductName($row['product'] ?? '');
            $qty = max(0, (float) ($row['quantity'] ?? 0));
            if ($orderDate && $product && $qty > 0) {
                $history[] = [
                    'date' => $orderDate,
                    'product' => $product,
                    'quantity' => $qty,
                    'record_count' => (int) ($row['record_count'] ?? 1),
                ];
            }
            continue;
        }

        $orderDate = $row['order_date'] ?? '';
        $items = json_decode($row['items'] ?? '[]', true);
        if (!is_array($items)) {
            continue;
        }

        foreach ($items as $item) {
            $product = normalizeProductName($item['name'] ?? $item['product'] ?? $item['title'] ?? '');
            $qty = max(0, (float) ($item['qty'] ?? $item['quantity'] ?? 0));
            if ($orderDate && $product && $qty > 0) {
                $date = date('Y-m-d', strtotime($orderDate));
                $key = $date . '|' . productMatchKey($product);
                $dailyHistory[$key]['date'] = $date;
                $dailyHistory[$key]['product'] = $product;
                $dailyHistory[$key]['quantity'] = ($dailyHistory[$key]['quantity'] ?? 0) + $qty;
                $dailyHistory[$key]['record_count'] = ($dailyHistory[$key]['record_count'] ?? 0) + 1;
            }
        }
    }
    mysqli_free_result($result);
    if (!$hasOrderItems && $dailyHistory) {
        $history = array_values($dailyHistory);
    }

    // Live-order keys use canonical names so aliases still participate in deduping.
    $seen = [];
    foreach ($history as $h) {
        $seen[$h['date'] . '|' . productMatchKey($h['product'])] = true;
    }

    $productAliases = getProductAliasMap($conn);
    $historyTable = mysqli_query($conn, "SHOW TABLES LIKE 'analytics_sales_history'");
    if ($historyTable && mysqli_num_rows($historyTable) > 0) {
        $overlapColumn = mysqli_query($conn, "SHOW COLUMNS FROM analytics_imports LIKE 'overlap_mode'");
        if ($overlapColumn === false) {
            error_log('Predictive analytics overlap-mode schema check failed: ' . mysqli_error($conn));
        }
        $hasOverlapMode = $overlapColumn && mysqli_num_rows($overlapColumn) > 0;
        if ($overlapColumn) {
            mysqli_free_result($overlapColumn);
        }
        $overlapSelect = $hasOverlapMode ? 'imports.overlap_mode' : "'deduplicate_live' AS overlap_mode";
        $overlapGroupBy = $hasOverlapMode ? ', imports.overlap_mode' : '';

        // Latest completed import wins per sale date. Previously every completed import was summed,
        // so uploading the same period twice (or a corrected re-upload) silently doubled the sales.
        $importedResult = mysqli_query($conn, "
            SELECT history.product_name, history.sale_date, {$overlapSelect},
                   SUM(history.units_sold) AS units_sold, COUNT(*) AS record_count
            FROM analytics_sales_history AS history
            INNER JOIN analytics_imports AS imports ON imports.id = history.import_id
            INNER JOIN (
                SELECT h2.sale_date, MAX(h2.import_id) AS import_id
                FROM analytics_sales_history AS h2
                INNER JOIN analytics_imports AS i2 ON i2.id = h2.import_id
                WHERE i2.status = 'completed' AND h2.units_sold > 0
                GROUP BY h2.sale_date
            ) AS latest ON latest.sale_date = history.sale_date AND latest.import_id = history.import_id
            WHERE imports.status = 'completed' AND history.units_sold > 0
            GROUP BY history.product_name, history.sale_date{$overlapGroupBy}
            ORDER BY history.sale_date ASC, history.product_name ASC
        ");
        if ($importedResult) {
            $importedDaily = [];
            while ($row = mysqli_fetch_assoc($importedResult)) {
                $sourceProduct = normalizeProductName($row['product_name'] ?? '');
                $product = $productAliases[normalizeAliasKey($sourceProduct)] ?? $sourceProduct;
                $date = (string) ($row['sale_date'] ?? '');
                $quantity = max(0, (float) ($row['units_sold'] ?? 0));
                if ($date !== '' && $product !== '' && $quantity > 0) {
                    $key = $date . '|' . productMatchKey($product);
                    $overlapMode = (string) ($row['overlap_mode'] ?? 'deduplicate_live');
                    if ($overlapMode !== 'supplement' && isset($seen[$key])) {
                        continue;
                    }
                    $importedDaily[$key]['date'] = $date;
                    $importedDaily[$key]['product'] = $product;
                    $importedDaily[$key]['quantity'] = ($importedDaily[$key]['quantity'] ?? 0) + $quantity;
                    $importedDaily[$key]['record_count'] = ($importedDaily[$key]['record_count'] ?? 0) + (int) $row['record_count'];
                }
            }
            $history = array_merge($history, array_values($importedDaily));
            mysqli_free_result($importedResult);
        }
    }
    if ($historyTable) mysqli_free_result($historyTable);

    return $history;
}

function getSalesCoverageIntervals(mysqli $conn): array {
    $intervals = [];
    $coverageColumns = mysqli_query($conn, "SHOW COLUMNS FROM analytics_imports LIKE 'coverage_start_date'");
    $hasCoverageColumns = $coverageColumns && mysqli_num_rows($coverageColumns) > 0;
    if ($coverageColumns) {
        mysqli_free_result($coverageColumns);
    }

    $importSql = $hasCoverageColumns
        ? "SELECT coverage_start_date AS start_date, coverage_end_date AS end_date
           FROM analytics_imports
           WHERE status = 'completed' AND coverage_start_date IS NOT NULL AND coverage_end_date IS NOT NULL"
        : "SELECT MIN(history.sale_date) AS start_date, MAX(history.sale_date) AS end_date
           FROM analytics_sales_history AS history
           INNER JOIN analytics_imports AS imports ON imports.id = history.import_id
           WHERE imports.status = 'completed'
           GROUP BY imports.id";
    $imports = mysqli_query($conn, $importSql);
    if (!$imports) {
        throw new Exception('Could not read completed sales-import date coverage.');
    }
    while ($row = mysqli_fetch_assoc($imports)) {
        if (!empty($row['start_date']) && !empty($row['end_date'])) {
            $intervals[] = ['start' => $row['start_date'], 'end' => $row['end_date']];
        }
    }
    mysqli_free_result($imports);

    $ordersTable = mysqli_query($conn, "SHOW TABLES LIKE 'orders'");
    if (!$ordersTable) {
        throw new Exception('Could not check live-order date coverage.');
    }
    $hasOrders = mysqli_num_rows($ordersTable) > 0;
    mysqli_free_result($ordersTable);
    if ($hasOrders) {
        $orders = mysqli_query($conn, "
            SELECT MIN(DATE(created_at)) AS start_date, MAX(DATE(created_at)) AS end_date
            FROM orders
            WHERE status IS NULL OR status NOT IN ('Cancelled', 'cancelled')
        ");
        if (!$orders) {
            throw new Exception('Could not read live-order date coverage.');
        }
        $row = mysqli_fetch_assoc($orders);
        if (!empty($row['start_date']) && !empty($row['end_date'])) {
            $intervals[] = ['start' => $row['start_date'], 'end' => $row['end_date']];
        }
        mysqli_free_result($orders);
    }

    return mergeForecastCoverageIntervals($intervals);
}

function getIngredientStock(mysqli $conn): array {
    $result = mysqli_query($conn, "SELECT id, name, stock, threshold, unit FROM ingredients ORDER BY name ASC");
    if (!$result) {
        error_log('Predictive analytics ingredient inventory query failed: ' . mysqli_error($conn));
        return [];
    }

    $items = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $items[] = [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'stock' => (float) ($row['stock'] ?? 0),
            'threshold' => (float) ($row['threshold'] ?? 0),
            'unit' => $row['unit'] ?? 'unit',
        ];
    }
    mysqli_free_result($result);

    return $items;
}

function getProducts(mysqli $conn): array {
    $result = mysqli_query($conn, "SELECT id, name, category, stock, minimum_stock FROM products ORDER BY name ASC");
    if (!$result) return [];

    $products = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $products[] = [
            'id' => (int) $row['id'],
            'name' => normalizeProductName($row['name'] ?? ''),
            'category' => trim((string) ($row['category'] ?? 'Other')),
            'stock' => (float) ($row['stock'] ?? 0),
            'minimum_stock' => (float) ($row['minimum_stock'] ?? 0),
        ];
    }
    mysqli_free_result($result);
    return $products;
}

function getProductRecipes(mysqli $conn): array {
    $recipes = [];
    $hasSizeColumn = mysqli_query($conn, "SHOW COLUMNS FROM product_recipes LIKE 'product_size_id'");
    $hasProductSize = $hasSizeColumn && mysqli_num_rows($hasSizeColumn) > 0;
    if ($hasSizeColumn) mysqli_free_result($hasSizeColumn);
    $sizeSelect = $hasProductSize ? ', pr.product_size_id' : '';
    $result = mysqli_query($conn, "
        SELECT p.name AS product_name, i.id AS ingredient_id, i.name AS ingredient_name, pr.qty AS usage{$sizeSelect}
        FROM product_recipes pr
        INNER JOIN products p ON p.id = pr.product_id
        INNER JOIN ingredients i ON i.id = pr.ingredient_id
        WHERE pr.active = 1 AND pr.qty > 0
        ORDER BY p.name ASC, i.name ASC
    ");
    if (!$result) {
        error_log('Predictive analytics product recipe query failed: ' . mysqli_error($conn));
    } else {
        while ($row = mysqli_fetch_assoc($result)) {
            $productName = normalizeProductName($row['product_name'] ?? '');
            $ingredientName = trim((string) ($row['ingredient_name'] ?? ''));
            $usage = max(0, (float) ($row['usage'] ?? 0));
            if ($productName && $ingredientName && $usage > 0) {
                $productKey = productMatchKey($productName);
                $ingredientId = (int) ($row['ingredient_id'] ?? 0);
                $recipeIndex = [];
                foreach ($recipes[$productKey] ?? [] as $index => $existing) {
                    $recipeIndex[(int) $existing['ingredient_id']] = $index;
                }
                if (!isset($recipeIndex[$ingredientId])) {
                    $recipes[$productKey][] = [
                        'ingredient_id' => $ingredientId,
                        'name' => $ingredientName,
                        'usage' => $usage,
                    ];
                } else {
                    $index = $recipeIndex[$ingredientId];
                    // Sales history does not retain the selected product size. Use the
                    // largest configured quantity so consumption is not understated.
                    $recipes[$productKey][$index]['usage'] = max(
                        (float) $recipes[$productKey][$index]['usage'],
                        $usage
                    );
                }
            }
        }
        mysqli_free_result($result);
    }

    $hasCakeRecipeTable = mysqli_query($conn, "SHOW TABLES LIKE 'cake_recipes'");
    $hasCakeRecipes = mysqli_query($conn, "SHOW TABLES LIKE 'cake_recipe_ingredients'");
    $hasCakeCatalog = mysqli_query($conn, "SHOW TABLES LIKE 'cake_flavors'");
    if ($hasCakeRecipeTable && mysqli_num_rows($hasCakeRecipeTable) > 0
        && $hasCakeRecipes && mysqli_num_rows($hasCakeRecipes) > 0
        && $hasCakeCatalog && mysqli_num_rows($hasCakeCatalog) > 0) {
        $cakeResult = mysqli_query($conn, "
            SELECT flavor.name AS flavor_name, ingredient.id AS ingredient_id,
                   ingredient.name AS ingredient_name, recipe_ingredient.quantity AS usage
            FROM cake_recipes AS recipe
            INNER JOIN cake_flavors AS flavor ON flavor.id = recipe.flavor_id
            INNER JOIN cake_recipe_ingredients AS recipe_ingredient ON recipe_ingredient.recipe_id = recipe.id
            INNER JOIN ingredients AS ingredient ON ingredient.id = recipe_ingredient.ingredient_id
            WHERE recipe.active = 1 AND flavor.active = 1
            ORDER BY flavor.name ASC, ingredient.name ASC
        ");
        if (!$cakeResult) {
            error_log('Predictive analytics cake recipe query failed: ' . mysqli_error($conn));
        } else {
            $productByFlavor = [
                'moist chocolate' => 'Chocolate Ganache Cake',
                'red velvet' => 'Red Velvet Cake',
                'carrot' => 'Carrot Cake',
            ];
            $cakeRecipes = [];
            while ($row = mysqli_fetch_assoc($cakeResult)) {
                $flavor = strtolower(trim((string) ($row['flavor_name'] ?? '')));
                $productName = $productByFlavor[$flavor] ?? '';
                $ingredientName = trim((string) ($row['ingredient_name'] ?? ''));
                if ($productName !== '' && $ingredientName !== '') {
                    $cakeRecipes[productMatchKey($productName)][] = [
                        'ingredient_id' => (int) ($row['ingredient_id'] ?? 0),
                        'name' => $ingredientName,
                        'usage' => max(0, (float) ($row['usage'] ?? 0)),
                    ];
                }
            }
            mysqli_free_result($cakeResult);
            foreach ($cakeRecipes as $productKey => $recipe) {
                if (empty($recipes[$productKey])) {
                    $recipes[$productKey] = $recipe;
                }
            }
        }
    }
    foreach ([$hasCakeRecipeTable, $hasCakeRecipes, $hasCakeCatalog] as $check) {
        if ($check) mysqli_free_result($check);
    }

    return $recipes;
}

// ---------------------------------------------------------------------------
// Forecast payload
// ---------------------------------------------------------------------------

function buildDetailedForecastPayload(array $history, array $products, array $ingredientStock, array $recipes, array $coverageIntervals, int $period): array {
    $period = in_array($period, [7, 14, 30], true) ? $period : 7;
    $today = new DateTimeImmutable('today');

    $productByKey = [];
    foreach ($products as $product) {
        $productByKey[productMatchKey($product['name'])] = $product;
    }
    $forecastableKeys = array_fill_keys(
        array_unique(array_merge(array_keys($productByKey), array_keys($recipes))),
        true
    );

    // Group by canonical product key so "S’mores" / "S'mores" or alias spellings are one product.
    $historyByProduct = [];
    $displayName = [];
    $unmappedHistoryProducts = [];
    foreach ($history as $entry) {
        $name = normalizeProductName($entry['product'] ?? '');
        $date = (string) ($entry['date'] ?? '');
        $quantity = max(0, (float) ($entry['quantity'] ?? 0));
        if ($name === '' || $date === '' || $quantity <= 0) continue;
        $key = productMatchKey($name);
        if (!isset($forecastableKeys[$key])) {
            $unmappedHistoryProducts[$name] = true;
            continue;
        }
        $displayName[$key] ??= $productByKey[$key]['name'] ?? $name;
        $historyByProduct[$key][$date] = ($historyByProduct[$key][$date] ?? 0) + $quantity;
    }

    $coverageIntervals = mergeForecastCoverageIntervals($coverageIntervals);
    $latestCoverage = $coverageIntervals ? $coverageIntervals[count($coverageIntervals) - 1] : null;
    $historicalStart = $latestCoverage ? new DateTimeImmutable($latestCoverage['start']) : null;
    $historicalEnd = $latestCoverage ? new DateTimeImmutable($latestCoverage['end']) : $today;

    // Continuous, zero-filled daily series per product inside the latest covered range.
    $series = [];
    if ($latestCoverage) {
        foreach ($historyByProduct as $key => $daily) {
            $covered = buildCoveredDailySeries($daily, $latestCoverage['start'], $latestCoverage['end'], min(array_keys($daily)));
            if ($covered) {
                $series[$key] = $covered;
            }
        }
    }

    // Rolling-origin validation with the SAME methods the forecast uses.
    $backtest = fe_run_backtest($series, $period);
    $aggregateValidationMetrics = $backtest['aggregate'];
    $validationMetrics = $backtest['product'];
    $selectedForecastMethod = fe_select_method($aggregateValidationMetrics);
    $selectedAggregate = $aggregateValidationMetrics[$selectedForecastMethod] ?? [];
    $selectedProductMetrics = $validationMetrics[$selectedForecastMethod] ?? [];

    $stockById = [];
    foreach ($ingredientStock as $stock) {
        $stockById[(int) $stock['id']] = $stock;
    }

    $forecastProducts = [];
    $forecastDayTotals = [];
    $historicalDayTotals = [];
    $ingredientTotals = [];
    $ingredientProductUse = [];   // ingredient id => product name => forecast consumption
    $actions = [];
    $previousTotal = 0.0;
    $comparableForecastTotal = 0.0;
    $comparisonMethodKeys = ['linear', 'moving_average_7', 'moving_average_28', 'same_weekday_last_week', 'yesterday'];

    foreach ($series as $key => $daily) {
        $productName = $displayName[$key];
        $values = array_values($daily);
        foreach ($daily as $date => $quantity) {
            $historicalDayTotals[$date] = ($historicalDayTotals[$date] ?? 0) + $quantity;
        }

        $recentValues = array_slice($values, -min(7, count($values)));
        $recentDemand = count($recentValues) ? array_sum($recentValues) / count($recentValues) : 0;

        $forecastSeries = array_map(static fn ($v) => round($v, 2), fe_forecast($selectedForecastMethod, $values, $period));
        foreach ($forecastSeries as $index => $value) {
            $forecastDayTotals[$index + 1] = ($forecastDayTotals[$index + 1] ?? 0) + $value;
        }
        $totalForecast = round(array_sum($forecastSeries), 2);

        // Compare the forecast with the MOST RECENT equivalent period (the last N actual days).
        $hasPrevious = count($values) >= $period;
        $previousEquivalent = $hasPrevious ? array_sum(array_slice($values, -$period)) : 0;
        if ($hasPrevious) {
            $previousTotal += $previousEquivalent;
            $comparableForecastTotal += $totalForecast;
        }

        $comparisonMethods = [];
        foreach ($comparisonMethodKeys as $method) {
            $comparisonMethods[$method] = array_map(static fn ($v) => round($v, 2), fe_forecast($method, $values, $period));
        }
        $actualSeries = array_slice($daily, -28, null, true);

        $catalogue = $productByKey[$key] ?? ['name' => $productName, 'category' => 'Unknown', 'stock' => 0, 'minimum_stock' => 0];
        $currentStock = max(0, (float) ($catalogue['stock'] ?? 0));

        $recipe = $recipes[$key] ?? [];
        $recipeMapped = array_key_exists($key, $recipes);
        $ingredientRows = [];
        foreach ($recipe as $ingredient) {
            $usage = max(0, (float) ($ingredient['usage'] ?? 0));
            $stock = $stockById[(int) ($ingredient['ingredient_id'] ?? 0)] ?? null;
            if (!$stock) continue;
            $consumption = round($usage * $totalForecast, 2);
            $id = $stock['id'];
            $ingredientTotals[$id]['name'] = $stock['name'];
            $ingredientTotals[$id]['unit'] = $stock['unit'];
            $ingredientTotals[$id]['stock'] = $stock['stock'];
            $ingredientTotals[$id]['threshold'] = $stock['threshold'];
            $ingredientTotals[$id]['consumption'] = ($ingredientTotals[$id]['consumption'] ?? 0) + $consumption;
            $ingredientProductUse[$id][$productName] = ($ingredientProductUse[$id][$productName] ?? 0) + $consumption;
            $ingredientRows[] = ['name' => $stock['name'], 'usage' => $usage, 'forecast_consumption' => $consumption];
        }

        // Finished-goods cover: how much of the forecast is already on the shelf.
        $shortfall = max(0, round($totalForecast - $currentStock, 2));
        $coverageRatio = $totalForecast > 0 ? max(0, min(1, $currentStock / $totalForecast)) : 1;
        $recommendedPreorderQuantity = max(0, (int) ceil($totalForecast - $currentStock));
        $priority = $shortfall <= 0 ? 'Low' : ($coverageRatio < 0.4 ? 'High' : 'Medium');
        if ($shortfall > 0) {
            $actions[] = ['type' => 'production', 'product' => $productName, 'message' => "Increase {$productName} production by {$shortfall} units.", 'priority' => $priority];
        }

        $forecastProducts[] = [
            'product' => $productName,
            'category' => $catalogue['category'] ?? 'Unknown',
            'recentDemand' => round($recentDemand, 2),
            'forecast' => $forecastSeries,
            'totalForecast' => $totalForecast,
            'trend' => round(fe_trend_slope($values), 2),
            'trendPercent' => $previousEquivalent > 0 ? round((($totalForecast - $previousEquivalent) / $previousEquivalent) * 100, 2) : null,
            'currentStock' => $currentStock,
            'coverageRatio' => round($coverageRatio, 2),
            'recommendedProduction' => $shortfall,
            'recommendedPreorderQuantity' => $recommendedPreorderQuantity,
            'priority' => $priority,
            'ingredients' => $ingredientRows,
            'recipeMapped' => $recipeMapped,
            'history' => array_slice($values, -7),
            'comparison' => [
                'actual' => array_map(
                    static fn (string $date, float|int $quantity): array => ['date' => $date, 'quantity' => (float) $quantity],
                    array_keys($actualSeries),
                    array_values($actualSeries)
                ),
                'methods' => $comparisonMethods,
            ],
        ];
    }

    // Keys were inserted product by product, so sort by date before slicing the chart window.
    ksort($historicalDayTotals);

    // Ingredient risk, reorder recommendations and alerts.
    $risks = [];
    $recommendations = [];
    $alerts = [];
    foreach ($ingredientTotals as $id => $ingredient) {
        $consumption = round($ingredient['consumption'] ?? 0, 2);
        $remaining = round($ingredient['stock'] - $consumption, 2);
        $reorder = max(0, round($ingredient['threshold'] - $remaining, 2));
        $risk = $remaining <= 0 ? 'HIGH' : ($remaining <= $ingredient['threshold'] ? 'MEDIUM' : 'LOW');
        $risks[] = [
            'ingredient' => $ingredient['name'], 'unit' => $ingredient['unit'], 'currentStock' => $ingredient['stock'],
            'forecastConsumption' => $consumption, 'projectedRemaining' => $remaining, 'reorderLevel' => $ingredient['threshold'],
            'recommendedReorderQuantity' => $reorder, 'riskStatus' => $risk,
        ];

        if ($reorder > 0) {
            $actions[] = ['type' => 'ingredient', 'product' => $ingredient['name'], 'message' => "Reorder {$reorder} {$ingredient['unit']} of {$ingredient['name']}.", 'priority' => $risk];

            // Split the ingredient's reorder quantity across the products that use it.
            $uses = $ingredientProductUse[$id] ?? [];
            $useTotal = array_sum($uses);
            foreach ($uses as $productName => $use) {
                $share = $useTotal > 0 ? $use / $useTotal : 1 / max(1, count($uses));
                $recommendations[] = [
                    'product' => $productName, 'ingredient' => $ingredient['name'], 'unit' => $ingredient['unit'],
                    'qty' => round($reorder * $share, 2), 'priority' => $risk === 'HIGH' ? 'High' : 'Medium',
                ];
            }
        }
        if ($risk === 'HIGH') {
            $alerts[] = [
                'type' => 'ingredient', 'product' => $ingredient['name'], 'ingredient' => $ingredient['name'], 'severity' => 'high',
                'message' => "Projected use of {$ingredient['name']} is {$consumption} {$ingredient['unit']} against {$ingredient['stock']} {$ingredient['unit']} in stock. Reorder at least {$reorder} {$ingredient['unit']}.",
            ];
        }
    }
    foreach ($forecastProducts as $item) {
        if ($item['priority'] === 'High') {
            $pct = round($item['coverageRatio'] * 100);
            $alerts[] = [
                'type' => 'product', 'product' => $item['product'], 'ingredient' => 'Inventory', 'severity' => 'high',
                'message' => "Current stock covers about {$pct}% of the {$period}-day forecast ({$item['totalForecast']} units). Prepare {$item['recommendedProduction']} more.",
            ];
        }
    }
    usort($recommendations, static fn ($a, $b) => (($a['priority'] === 'High') <=> ($b['priority'] === 'High')) * -1 ?: ($b['qty'] <=> $a['qty']));

    $totalForecast = array_sum(array_column($forecastProducts, 'totalForecast'));
    $trendPercent = $previousTotal > 0
        ? round((($comparableForecastTotal - $previousTotal) / $previousTotal) * 100, 2)
        : null;

    // Forecast day 1 is the day after the last day with data.
    $dataAgeDays = $latestCoverage ? max(0, (int) $historicalEnd->diff($today)->format('%r%a')) : null;
    $missingRecipeProducts = array_values(array_map(
        static fn (array $item): string => $item['product'],
        array_filter($forecastProducts, static fn (array $item): bool => empty($item['recipeMapped']))
    ));

    $insights = [];
    if ($trendPercent !== null) {
        $insights[] = 'Forecast demand is ' . abs($trendPercent) . '% ' . ($trendPercent >= 0 ? 'higher' : 'lower') . " than the last {$period} days of actual sales.";
    }
    if ($forecastProducts) {
        $totals = array_column($forecastProducts, 'totalForecast');
        $insights[] = $forecastProducts[array_search(max($totals), $totals, true)]['product'] . ' has the highest projected demand.';
    }
    if (count(array_filter($risks, static fn ($item) => $item['riskStatus'] === 'HIGH'))) {
        $insights[] = 'One or more ingredients may run out based on projected consumption.';
    }
    if (($selectedAggregate['wape'] ?? null) !== null) {
        $insights[] = "Shop-wide daily forecasts have missed by about {$selectedAggregate['wape']}% in {$backtest['folds']} past tests. "
            . (($selectedProductMetrics['wape'] ?? null) !== null
                ? "Single products miss by about {$selectedProductMetrics['wape']}% per day because each sells only a few units a day, so read per-product numbers as period totals."
                : '');
    }

    error_log(sprintf(
        'Predictive analytics backtest: method=%s, shop_wape=%s, shop_mae=%s, shop_rmse=%s, shop_mape=%s, shop_bias=%s, folds=%d, horizon=%d, products=%d, validated=%d',
        $selectedForecastMethod,
        $selectedAggregate['wape'] ?? 'n/a',
        $selectedAggregate['mae'] ?? 'n/a',
        $selectedAggregate['rmse'] ?? 'n/a',
        $selectedAggregate['mape'] ?? 'n/a',
        $selectedAggregate['bias'] ?? 'n/a',
        (int) $backtest['folds'],
        (int) $backtest['horizon'],
        count($historyByProduct),
        (int) $backtest['evaluated']
    ));

    return [
        'period' => $period,
        'products' => $forecastProducts,
        'ingredients' => array_values($risks),
        'risks' => $risks,
        'actions' => $actions,
        'alerts' => $alerts,
        'recommendations' => $recommendations,
        'dataEndDate' => $historicalEnd->format('Y-m-d'),
        'dataAgeDays' => $dataAgeDays,
        'coverageAvailable' => $latestCoverage !== null,
        'coverage' => $latestCoverage ? [
            'start' => $latestCoverage['start'],
            'end' => $latestCoverage['end'],
            'days' => (int) $historicalStart->diff($historicalEnd)->format('%a') + 1,
        ] : null,
        'history' => array_map(
            static fn ($date, $demand) => ['date' => $date, 'demand' => round($demand, 2)],
            array_slice(array_keys($historicalDayTotals), -14),
            array_slice(array_values($historicalDayTotals), -14)
        ),
        'daily' => array_map(
            static fn ($day, $value) => ['day' => $day, 'date' => $historicalEnd->modify("+{$day} days")->format('Y-m-d'), 'forecast' => round($value, 2)],
            array_keys($forecastDayTotals),
            $forecastDayTotals
        ),
        'summary' => [
            'totalProjectedDemand' => round($totalForecast, 2),
            'previousEquivalentDemand' => round($previousTotal, 2),
            'highPriorityCount' => count(array_filter($forecastProducts, static fn ($item) => $item['priority'] === 'High')),
            'recommendationCount' => count($recommendations),
            'unmappedProductCount' => count($unmappedHistoryProducts),
            'trendPercent' => $trendPercent,
            'peakDay' => !empty($forecastDayTotals) ? array_search(max($forecastDayTotals), $forecastDayTotals, true) : null,
        ],
        'model' => [
            'name' => 'Selected by shop-total WAPE (rolling backtest)',
            'selected_forecast_method' => $selectedForecastMethod,
            'selected_forecast_method_wape' => $selectedAggregate['wape'] ?? null,
            'mae' => $selectedAggregate['mae'] ?? null,
            'rmse' => $selectedAggregate['rmse'] ?? null,
            'mape' => $selectedAggregate['mape'] ?? null,
            'wape' => $selectedAggregate['wape'] ?? null,
            'bias' => $selectedAggregate['bias'] ?? null,
            'validation_metrics' => $validationMetrics,
            'aggregate_validation_metrics' => $aggregateValidationMetrics,
            'validation_folds' => $backtest['folds'],
            'validation_horizon_days' => $backtest['horizon'],
            'records' => array_sum(array_map(static fn ($entry) => (int) ($entry['record_count'] ?? 1), $history)),
            'training_start' => $historicalStart?->format('Y-m-d'),
            'training_end' => $historicalEnd->format('Y-m-d'),
            'coverage_days' => $latestCoverage ? (int) $historicalStart->diff($historicalEnd)->format('%a') + 1 : 0,
            'validation_records' => $selectedAggregate['records'] ?? 0,
            'validation_products' => $backtest['evaluated'],
            'products_count' => count($historyByProduct),
            'validation_excluded_products' => max(0, count($historyByProduct) - $backtest['evaluated']),
            'validation_insufficient_history_products' => $backtest['insufficient'] + max(0, count($historyByProduct) - count($series)),
            'validation_inactive_products' => $backtest['inactive'],
            'recipe_missing_products' => $missingRecipeProducts,
            'unmapped_history_products' => array_values(array_keys($unmappedHistoryProducts)),
        ],
        'drivers' => ['Historical product demand', 'Long-window sales average (28 days)', 'Lowest shop-total WAPE across rolling backtests'],
        'insights' => $insights,
    ];
}

function fe_trend_slope(array $values): float {
    $window = array_values(array_slice($values, -FE_LINEAR_WINDOW_DAYS));
    $w = count($window);
    if ($w < 3) return 0.0;
    $sumX = $w * ($w - 1) / 2;
    $sumXX = ($w - 1) * $w * (2 * $w - 1) / 6;
    $sumY = array_sum($window);
    $sumXY = 0.0;
    foreach ($window as $i => $y) $sumXY += $i * $y;
    $den = $w * $sumXX - $sumX * $sumX;
    return $den != 0 ? ($w * $sumXY - $sumX * $sumY) / $den : 0.0;
}

function persistForecastData(mysqli $conn, array $forecastPayload): void {
    $selected = $forecastPayload['model']['selected_forecast_method'] ?? 'moving_average_28';
    $productWape = $forecastPayload['model']['validation_metrics'][$selected]['wape'] ?? null;
    $shopWape = $forecastPayload['model']['selected_forecast_method_wape'] ?? null;
    $wape = $productWape ?? $shopWape;
    // Heuristic confidence: 1 - WAPE, shrinking a little for each day further out. Not a statistical interval.
    $baseConfidence = $wape === null ? 0.5 : max(0.05, min(0.95, 1 - ((float) $wape) / 100));

    mysqli_begin_transaction($conn);
    try {
        foreach (['analytics_forecasts', 'analytics_reorder_logs', 'analytics_procurement_alerts'] as $table) {
            if (!mysqli_query($conn, "DELETE FROM {$table}")) {
                throw new Exception("Could not clear {$table}: " . mysqli_error($conn));
            }
        }

        $stmtForecast = mysqli_prepare($conn, "INSERT INTO analytics_forecasts (product_name, forecast_date, predicted_units, confidence_score) VALUES (?, ?, ?, ?)");
        $stmtReorder = mysqli_prepare($conn, "INSERT INTO analytics_reorder_logs (product_name, ingredient_name, recommended_qty, status) VALUES (?, ?, ?, ?)");
        $stmtAlert = mysqli_prepare($conn, "INSERT INTO analytics_procurement_alerts (product_name, ingredient_name, severity, message) VALUES (?, ?, ?, ?)");
        if (!$stmtForecast || !$stmtReorder || !$stmtAlert) {
            throw new Exception('Could not prepare forecast persistence statements.');
        }

        // Forecast dates follow the last day with data, matching the API's "daily" labels.
        $forecastStart = new DateTimeImmutable($forecastPayload['dataEndDate'] ?? 'today');
        foreach ($forecastPayload['products'] ?? [] as $productData) {
            $productName = $productData['product'];
            foreach ($productData['forecast'] ?? [] as $index => $value) {
                $date = $forecastStart->modify('+' . ($index + 1) . ' day')->format('Y-m-d');
                $value = (float) $value;
                $confidence = round($baseConfidence * max(0.5, 1 - 0.01 * $index), 2);
                mysqli_stmt_bind_param($stmtForecast, 'ssdd', $productName, $date, $value, $confidence);
                mysqli_stmt_execute($stmtForecast);
            }
        }

        foreach ($forecastPayload['recommendations'] ?? [] as $recommendation) {
            $productName = $recommendation['product'] ?? '';
            $ingredientName = $recommendation['ingredient'] ?? '';
            $qty = (float) ($recommendation['qty'] ?? 0);
            $status = $qty > 0 ? 'pending' : 'skipped';
            mysqli_stmt_bind_param($stmtReorder, 'ssds', $productName, $ingredientName, $qty, $status);
            mysqli_stmt_execute($stmtReorder);
        }

        foreach ($forecastPayload['alerts'] ?? [] as $alert) {
            $productName = $alert['product'] ?? '';
            $ingredientName = $alert['ingredient'] ?? 'Inventory';
            $severity = $alert['severity'] ?? 'warning';
            $message = $alert['message'] ?? '';
            mysqli_stmt_bind_param($stmtAlert, 'ssss', $productName, $ingredientName, $severity, $message);
            mysqli_stmt_execute($stmtAlert);
        }

        mysqli_stmt_close($stmtForecast);
        mysqli_stmt_close($stmtReorder);
        mysqli_stmt_close($stmtAlert);
        mysqli_commit($conn);
    } catch (Throwable $e) {
        mysqli_rollback($conn);
        error_log('Predictive analytics persistence failed: ' . $e->getMessage());
        throw $e;
    }
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

$method = $_SERVER['REQUEST_METHOD'];
$action = '';

// Forecast data is staff-only, including read requests.
$authenticatedUser = apiUser();
if (!$authenticatedUser) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authentication required.']);
    exit;
}

if (trim(strtolower((string) ($authenticatedUser['role'] ?? ''))) !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'You are not authorized for this action.']);
    exit;
}

if ($method === 'GET') {
    $action = $_GET['action'] ?? 'overview';
} elseif ($method === 'POST') {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') !== false) {
        $body = file_get_contents('php://input');
        $data = json_decode($body, true) ?: [];
        $action = $data['action'] ?? 'refresh';
    } else {
        $action = $_POST['action'] ?? '';
    }
}

if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

try {
    if ($method === 'POST' && $action === 'import') {
        http_response_code(410);
        echo json_encode([
            'success' => false,
            'message' => 'Import sales CSV files from Sales Reports so cleaning and date coverage are shared across analytics.',
        ]);
        exit;
    }

    $history = getSalesHistory($conn);
    $coverageIntervals = getSalesCoverageIntervals($conn);
    $period = (int) ($_GET['period'] ?? 7);
    $products = getProducts($conn);
    $ingredientStock = getIngredientStock($conn);
    $recipes = getProductRecipes($conn);
    $forecastPayload = buildDetailedForecastPayload($history, $products, $ingredientStock, $recipes, $coverageIntervals, $period);

    if ($method === 'POST' && $action === 'refresh') {
        persistForecastData($conn, $forecastPayload);
    }

    echo json_encode([
        'success' => true,
        'message' => 'Forecast data loaded.',
        'historyCount' => count($history),
        'forecast' => $forecastPayload,
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}