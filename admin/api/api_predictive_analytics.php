<?php
require_once __DIR__ . '/../../customer/cors.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/api_auth.php';

/*
| SCHEMA NOTE: The analytics_* tables are created by the versioned migration
| database/migrations/2026_08_25_06_analytics_tables.sql. This API must never
| run CREATE TABLE / ALTER TABLE statements at request time.
*/

function normalizeProductName(mixed $value): string {
    return trim(preg_replace('/\s+/', ' ', (string) $value));
}

function getProductAliasMap(mysqli $conn): array {
    $table = mysqli_query($conn, "SHOW TABLES LIKE 'analytics_product_aliases'");
    if (!$table || mysqli_num_rows($table) === 0) {
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

function normalizeAliasKey(string $value): string {
    return mb_strtolower(normalizeProductName($value), 'UTF-8');
}

function emptyValidationMetrics(): array {
    return ['absolute' => [], 'squared' => [], 'percentage' => [], 'actual' => []];
}

function recordValidationError(array &$metrics, float $actual, float $predicted): void {
    $error = $actual - max(0, $predicted);
    $metrics['absolute'][] = abs($error);
    $metrics['squared'][] = $error * $error;
    $metrics['actual'][] = abs($actual);
    if ($actual != 0) {
        $metrics['percentage'][] = abs($error) / abs($actual) * 100;
    }
}

function summarizeValidationMetrics(array $metrics): array {
    $count = count($metrics['absolute']);
    $actualTotal = array_sum($metrics['actual']);

    return [
        'mae' => $count ? round(array_sum($metrics['absolute']) / $count, 2) : null,
        'rmse' => $count ? round(sqrt(array_sum($metrics['squared']) / $count), 2) : null,
        'mape' => count($metrics['percentage']) ? round(array_sum($metrics['percentage']) / count($metrics['percentage']), 2) : null,
        'wape' => $actualTotal > 0 ? round(array_sum($metrics['absolute']) / $actualTotal * 100, 2) : null,
        'records' => $count,
    ];
}

/**
 * Fit a straight line (least squares) through the most recent $window values.
 * Far steadier than comparing only the first and last day.
 */
function fitTrend(array $values, int $window = 28): array {
    $values = array_values(array_slice($values, -$window));
    $n = count($values);
    if ($n === 0) return ['intercept' => 0, 'slope' => 0, 'n' => 0];
    $meanX = ($n - 1) / 2;
    $meanY = array_sum($values) / $n;
    $num = 0;
    $den = 0;
    foreach ($values as $x => $y) {
        $num += ($x - $meanX) * ($y - $meanY);
        $den += ($x - $meanX) ** 2;
    }
    $slope = $den > 0 ? $num / $den : 0;
    return ['intercept' => $meanY - $slope * $meanX, 'slope' => $slope, 'n' => $n];
}

/**
 * Forecast $h days after the end of the fitted window.
 * $damping stops a short-term slope from growing unrealistically on long horizons.
 */
function forecastAt(array $fit, int $h, float $damping = 0.5): float {
    if ($fit['n'] === 0) return 0;
    $endLevel = $fit['intercept'] + $fit['slope'] * ($fit['n'] - 1);
    return max(0, $endLevel + $fit['slope'] * $damping * $h);
}

function getSalesHistory(mysqli $conn): array {
    $history = [];

    $tables = mysqli_query($conn, "SHOW TABLES LIKE 'order_items'");
    $hasOrderItems = $tables && mysqli_num_rows($tables) > 0;

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
        $itemsPayload = $row['items'] ?? '[]';
        $items = json_decode($itemsPayload, true);
        if (!is_array($items)) {
            continue;
        }

        foreach ($items as $item) {
            $product = normalizeProductName($item['name'] ?? $item['product'] ?? $item['title'] ?? '');
            $qty = max(0, (float) ($item['qty'] ?? $item['quantity'] ?? 0));
            if ($orderDate && $product && $qty > 0) {
                $date = date('Y-m-d', strtotime($orderDate));
                $key = $date . '|' . strtolower($product);
                $dailyHistory[$key]['date'] = $date;
                $dailyHistory[$key]['product'] = $product;
                $dailyHistory[$key]['quantity'] = ($dailyHistory[$key]['quantity'] ?? 0) + $qty;
                $dailyHistory[$key]['record_count'] = ($dailyHistory[$key]['record_count'] ?? 0) + 1;
            }
        }
    }
    if (!$hasOrderItems && $dailyHistory) {
        $history = array_values($dailyHistory);
    }

    // Live-order keys use canonical names so aliases still participate in deduping.
    $seen = [];
    foreach ($history as $h) {
        $seen[$h['date'] . '|' . normalizeAliasKey($h['product'])] = true;
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
        $importedResult = mysqli_query($conn, "
            SELECT history.product_name, history.sale_date, {$overlapSelect},
                   SUM(history.units_sold) AS units_sold, COUNT(*) AS record_count
            FROM analytics_sales_history AS history
            INNER JOIN analytics_imports AS imports ON imports.id = history.import_id
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
                    $key = $date . '|' . normalizeAliasKey($product);
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
        mysqli_free_result($historyTable);
    }

    return $history;
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
    return $products;
}

function getProductRecipes(mysqli $conn): array {
    $result = mysqli_query($conn, "
        SELECT p.name AS product_name, i.id AS ingredient_id, i.name AS ingredient_name, pr.qty AS usage
        FROM product_recipes pr
        LEFT JOIN products p ON p.id = pr.product_id
        LEFT JOIN ingredients i ON i.id = pr.ingredient_id
        WHERE pr.active = 1
        ORDER BY p.name ASC, i.name ASC
    ");
    if (!$result) {
        error_log('Predictive analytics product recipe query failed: ' . mysqli_error($conn));
        $recipes = [];
    } else {
        $recipes = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $productName = normalizeProductName($row['product_name'] ?? '');
            $ingredientName = trim((string) ($row['ingredient_name'] ?? ''));
            $usage = max(0, (float) ($row['usage'] ?? 0));
            if ($productName && $ingredientName) {
                $recipes[strtolower($productName)][] = [
                    'ingredient_id' => (int) ($row['ingredient_id'] ?? 0),
                    'name' => $ingredientName,
                    'usage' => $usage,
                ];
            }
        }
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
                    $cakeRecipes[strtolower($productName)][] = [
                        'ingredient_id' => (int) ($row['ingredient_id'] ?? 0),
                        'name' => $ingredientName,
                        'usage' => max(0, (float) ($row['usage'] ?? 0)),
                    ];
                }
            }
            foreach ($cakeRecipes as $productName => $recipe) {
                if (empty($recipes[$productName])) {
                    $recipes[$productName] = $recipe;
                }
            }
        }
    }

    return $recipes;
}

function inferFallbackRecipe(string $productName): array {
    $normalized = strtolower($productName);
    if (strpos($normalized, 'croissant') !== false) {
        return [
            ['name' => 'Butter', 'usage' => 0.25],
            ['name' => 'Flour', 'usage' => 0.35],
            ['name' => 'Sugar', 'usage' => 0.15],
        ];
    }

    if (strpos($normalized, 'tart') !== false) {
        return [
            ['name' => 'Butter', 'usage' => 0.22],
            ['name' => 'Cream', 'usage' => 0.2],
            ['name' => 'Fruit', 'usage' => 0.3],
        ];
    }

    if (strpos($normalized, 'eclair') !== false || strpos($normalized, 'éclair') !== false) {
        return [
            ['name' => 'Butter', 'usage' => 0.2],
            ['name' => 'Flour', 'usage' => 0.3],
            ['name' => 'Vanilla Cream', 'usage' => 0.25],
        ];
    }

    return [
        ['name' => 'Butter', 'usage' => 0.2],
        ['name' => 'Flour', 'usage' => 0.25],
        ['name' => 'Sugar', 'usage' => 0.15],
    ];
}

function buildForecastPayload(array $history, array $ingredientStock, array $recipes): array {
    $grouped = [];
    foreach ($history as $entry) {
        $product = normalizeProductName($entry['product'] ?? '');
        if (!$product) {
            continue;
        }
        $grouped[$product][] = $entry;
    }

    $products = [];
    $recommendations = [];
    $alerts = [];

    foreach ($grouped as $product => $entries) {
        usort($entries, function ($a, $b) {
            return strcmp($a['date'], $b['date']);
        });

        $byDay = [];
        foreach ($entries as $entry) {
            $byDay[$entry['date']] = ($byDay[$entry['date']] ?? 0) + (float) $entry['quantity'];
        }

        $values = array_values($byDay);
        $daysUsed = array_keys($byDay);
        $avgDemand = count($values) > 0 ? array_sum($values) / count($values) : 0;
        $first = $values[0] ?? 0;
        $last = $values[count($values) - 1] ?? 0;
        $trend = count($values) > 1 ? ($last - $first) / max(count($values) - 1, 1) : 0;

        $projectedSeries = [];
        for ($i = 1; $i <= 7; $i++) {
            $forecastValue = max(0, $avgDemand + ($trend * $i));
            $projectedSeries[] = round($forecastValue, 2);
        }

        $projectedDemand = round(array_sum($projectedSeries) + max(2, round($avgDemand * 0.25, 2)), 2);

        $recipe = $recipes[$product] ?? inferFallbackRecipe($product);
        $ingredientRows = [];
        $highPriority = false;
        $coverageScore = 1;

        foreach ($recipe as $ingredient) {
            $ingredientName = trim((string) $ingredient['name']);
            $usage = max(0, (float) $ingredient['usage']);
            $stockEntry = null;
            foreach ($ingredientStock as $item) {
                if (strtolower($item['name']) === strtolower($ingredientName)) {
                    $stockEntry = $item;
                    break;
                }
            }

            $currentStock = $stockEntry['stock'] ?? 0;
            $threshold = $stockEntry['threshold'] ?? 0;
            $requiredQty = round($usage * $projectedDemand, 2);
            $recommendedQty = max(0, round($requiredQty - $currentStock, 2));

            if ($recommendedQty > 0 || ($currentStock <= $threshold && $threshold > 0)) {
                $recommendations[] = [
                    'product' => $product,
                    'ingredient' => $ingredientName,
                    'qty' => $recommendedQty,
                    'priority' => ($avgDemand >= 8 && $currentStock <= $threshold) ? 'High' : 'Medium',
                ];
            }

            $ingredientRows[] = [
                'name' => $ingredientName,
                'usage' => $usage,
                'requiredQty' => $requiredQty,
                'stock' => $currentStock,
                'threshold' => $threshold,
                'recommendedQty' => $recommendedQty,
            ];

            if ($currentStock <= $threshold && $threshold > 0) {
                $highPriority = true;
            }

            if ($currentStock > 0) {
                $coverageScore = min($coverageScore, $currentStock / max($requiredQty, 0.01));
            }
        }

        $products[] = [
            'product' => $product,
            'avgDemand' => round($avgDemand, 2),
            'trend' => round($trend, 2),
            'projectedSeries' => $projectedSeries,
            'projectedDemand' => $projectedDemand,
            'daysUsed' => $daysUsed,
            'ingredients' => $ingredientRows,
            'coverageRatio' => round(max(0, min(1, $coverageScore)), 2),
            'highPriority' => $avgDemand >= 8 && $highPriority,
        ];

        if ($avgDemand >= 8 && $highPriority) {
            $alerts[] = [
                'product' => $product,
                'message' => $product . ' shows strong demand and is now flagged for priority procurement due to low ingredient coverage.',
                'severity' => 'high',
            ];
        }
    }

    usort($products, function ($a, $b) {
        return strcmp($a['product'], $b['product']);
    });

    usort($recommendations, function ($a, $b) {
        return strcmp($a['product'], $b['product']);
    });

    $totalDemand = round(array_sum(array_map(function ($item) {
        return (float) $item['projectedDemand'];
    }, $products)), 2);

    return [
        'products' => $products,
        'summary' => [
            'totalProjectedDemand' => $totalDemand,
            'highPriorityCount' => count(array_filter($products, function ($item) {
                return $item['highPriority'];
            })),
            'recommendationCount' => count($recommendations),
        ],
        'recommendations' => $recommendations,
        'alerts' => $alerts,
    ];
}

function buildDetailedForecastPayload(array $history, array $products, array $ingredientStock, array $recipes, int $period): array {
    $period = in_array($period, [7, 14, 30], true) ? $period : 7;
    $today = new DateTimeImmutable('today');
    $historyByProduct = [];
    $historicalStartDate = null;
    $historicalEndDate = null;

    foreach ($history as $entry) {
        $product = normalizeProductName($entry['product'] ?? '');
        $date = (string) ($entry['date'] ?? '');
        $quantity = max(0, (float) ($entry['quantity'] ?? 0));
        if ($product === '' || $date === '' || $quantity <= 0) continue;
        $historyByProduct[$product][$date] = ($historyByProduct[$product][$date] ?? 0) + $quantity;
        $historicalStartDate = $historicalStartDate === null || $date < $historicalStartDate ? $date : $historicalStartDate;
        $historicalEndDate = $historicalEndDate === null || $date > $historicalEndDate ? $date : $historicalEndDate;
    }

    $latestDate = $historicalEndDate !== null ? new DateTimeImmutable($historicalEndDate) : null;
    $historicalEnd = $latestDate ?: $today;
    $historicalStart = $historicalStartDate !== null ? new DateTimeImmutable($historicalStartDate) : null;
    $productByName = [];
    foreach ($products as $product) $productByName[strtolower($product['name'])] = $product;

    $forecastProducts = [];
    $previousEquivalentTotal = 0;

    // Validation: every method is scored on the same chronological 7-day holdout.
    // - $validation: errors pooled per product-day
    // - $aggActual / $aggPred: shop-level daily totals (what the bakery actually plans for)
    $validationMethods = ['linear', 'zero', 'yesterday', 'same_weekday_last_week', 'moving_average_7'];
    $validation = [];
    foreach ($validationMethods as $method) {
        $validation[$method] = emptyValidationMetrics();
    }
    $aggActual = [];
    $aggPred = [];
    $minTrainDays = 14;          // products need this much history before the holdout
    $evaluatedProducts = 0;

    $forecastDayTotals = [];
    $historicalDayTotals = [];
    $ingredientTotals = [];
    $actions = [];
    $risks = [];
    $stockById = [];
    foreach ($ingredientStock as $stock) {
        $stockById[(int) $stock['id']] = $stock;
    }

    foreach ($recipes as $recipe) {
        foreach ($recipe as $ingredient) {
            $ingredientName = trim((string) ($ingredient['name'] ?? ''));
            if ($ingredientName === '') continue;

            $stock = $stockById[(int) ($ingredient['ingredient_id'] ?? 0)] ?? null;
            if (!$stock) continue;
            $ingredientTotals[$stock['id']]['name'] = $stock['name'];
            $ingredientTotals[$stock['id']]['unit'] = $stock['unit'];
            $ingredientTotals[$stock['id']]['stock'] = $stock['stock'];
            $ingredientTotals[$stock['id']]['threshold'] = $stock['threshold'];
            $ingredientTotals[$stock['id']]['consumption'] ??= 0;
        }
    }

    foreach ($historyByProduct as $productName => $daily) {
        $dateKeys = array_keys($daily);
        $firstDate = new DateTimeImmutable(min($dateKeys));
        // Fill zeros up to the latest date in the whole dataset (not this product's
        // last sale) so products that stopped selling show their recent zero days.
        $lastDate = $historicalEnd;
        for ($date = $firstDate; $date <= $lastDate; $date = $date->modify('+1 day')) {
            $daily[$date->format('Y-m-d')] = $daily[$date->format('Y-m-d')] ?? 0;
        }
        ksort($daily);
        $values = array_values($daily);
        foreach ($daily as $date => $quantity) {
            $historicalDayTotals[$date] = ($historicalDayTotals[$date] ?? 0) + $quantity;
        }

        $recentValues = array_slice($values, -min(7, count($values)));
        $recentDemand = count($recentValues) ? array_sum($recentValues) / count($recentValues) : 0;

        // Real forecast: trained on ALL available data (regression over the last 28 days).
        $fullFit = fitTrend($values);
        $trend = $fullFit['slope'];
        $forecastSeries = [];
        for ($day = 1; $day <= $period; $day++) {
            $value = round(forecastAt($fullFit, $day), 2);
            $forecastSeries[] = $value;
            $forecastDayTotals[$day] = ($forecastDayTotals[$day] ?? 0) + $value;
        }

        // Compare the model with simple baselines on the same chronological
        // seven-day holdout. Only products with enough history and some recent
        // activity are scored, so dormant all-zero series don't dilute the results.
        if (count($values) >= $minTrainDays + 7) {
            $trainingValues = array_slice($values, 0, -7);
            $holdout = array_slice($values, -7);
            $isActive = array_sum(array_slice($trainingValues, -28)) > 0 || array_sum($holdout) > 0;

            if ($isActive) {
                $evaluatedProducts++;
                $trainFit = fitTrend($trainingValues);
                $holdoutOffset = count($trainingValues);
                $movingAverage7 = array_sum(array_slice($trainingValues, -7)) / 7;
                $lastKnownValue = (float) $trainingValues[count($trainingValues) - 1];

                foreach ($holdout as $i => $actual) {
                    $targetIndex = $holdoutOffset + $i;
                    // Always >= 0 because products have at least $minTrainDays of training data.
                    $sameWeekdayIndex = $targetIndex - 7;

                    $predictions = [
                        'linear' => forecastAt($trainFit, $i + 1),
                        'zero' => 0.0,
                        'yesterday' => $lastKnownValue,
                        'same_weekday_last_week' => (float) $values[$sameWeekdayIndex],
                        'moving_average_7' => (float) $movingAverage7,
                    ];

                    foreach ($predictions as $method => $predicted) {
                        recordValidationError($validation[$method], (float) $actual, $predicted);
                        $aggPred[$method][$i] = ($aggPred[$method][$i] ?? 0) + max(0, $predicted);
                    }
                    $aggActual[$i] = ($aggActual[$i] ?? 0) + (float) $actual;
                }
            }
        }

        $catalogue = $productByName[strtolower($productName)] ?? ['name' => $productName, 'category' => 'Unknown', 'stock' => 0, 'minimum_stock' => 0];
        $totalForecast = round(array_sum($forecastSeries), 2);
        $previousEquivalent = count($values) >= $period * 2 ? array_sum(array_slice($values, -$period * 2, $period)) : 0;
        $previousEquivalentTotal += $previousEquivalent;
        $recipe = $recipes[strtolower($productName)] ?? [];
        $ingredientRows = [];
        foreach ($recipe as $ingredient) {
            $usage = max(0, (float) ($ingredient['usage'] ?? 0));
            $stock = $stockById[(int) ($ingredient['ingredient_id'] ?? 0)] ?? null;
            if (!$stock) continue;
            $consumption = round($usage * $totalForecast, 2);
            $ingredientTotals[$stock['id']]['name'] = $stock['name'];
            $ingredientTotals[$stock['id']]['unit'] = $stock['unit'];
            $ingredientTotals[$stock['id']]['stock'] = $stock['stock'];
            $ingredientTotals[$stock['id']]['threshold'] = $stock['threshold'];
            $ingredientTotals[$stock['id']]['consumption'] = ($ingredientTotals[$stock['id']]['consumption'] ?? 0) + $consumption;
            $ingredientRows[] = ['name' => $stock['name'], 'usage' => $usage, 'forecast_consumption' => $consumption];
        }

        $recommendedProduction = max(0, round($totalForecast - (float) ($catalogue['stock'] ?? 0), 2));
        $recommendedPreorderQuantity = max(0, (int) ceil($totalForecast - max(0, (float) ($catalogue['stock'] ?? 0))));
        $priority = $recommendedProduction > max(1, (float) ($catalogue['stock'] ?? 0)) ? 'High' : ($recommendedProduction > 0 ? 'Medium' : 'Low');
        if ($recommendedProduction > 0) $actions[] = ['type' => 'production', 'product' => $productName, 'message' => "Increase {$productName} production by {$recommendedProduction} units.", 'priority' => $priority];
        $forecastProducts[] = [
            'product' => $productName, 'category' => $catalogue['category'] ?? 'Unknown', 'recentDemand' => round($recentDemand, 2),
            'forecast' => $forecastSeries, 'totalForecast' => $totalForecast, 'trend' => round($trend, 2),
            'trendPercent' => $previousEquivalent > 0 ? round((($totalForecast - $previousEquivalent) / $previousEquivalent) * 100, 2) : null,
            'currentStock' => (float) ($catalogue['stock'] ?? 0), 'recommendedProduction' => $recommendedProduction,
            'recommendedPreorderQuantity' => $recommendedPreorderQuantity,
            'priority' => $priority, 'ingredients' => $ingredientRows, 'history' => array_slice(array_values($daily), -7),
        ];
    }

    // Keys were inserted product by product, so sort by date before taking the last 7 days.
    ksort($historicalDayTotals);

    foreach ($ingredientTotals as $ingredient) {
        $remaining = round($ingredient['stock'] - $ingredient['consumption'], 2);
        $reorder = max(0, round($ingredient['threshold'] - $remaining, 2));
        $risk = $remaining <= 0 ? 'HIGH' : ($remaining <= $ingredient['threshold'] ? 'MEDIUM' : 'LOW');
        $row = ['ingredient' => $ingredient['name'], 'unit' => $ingredient['unit'], 'currentStock' => $ingredient['stock'], 'forecastConsumption' => round($ingredient['consumption'], 2), 'projectedRemaining' => $remaining, 'reorderLevel' => $ingredient['threshold'], 'recommendedReorderQuantity' => $reorder, 'riskStatus' => $risk];
        $risks[] = $row;
        if ($reorder > 0) $actions[] = ['type' => 'ingredient', 'product' => $ingredient['name'], 'message' => "Reorder {$reorder} {$ingredient['unit']} of {$ingredient['name']}.", 'priority' => $risk];
    }

    $validationMetrics = array_map('summarizeValidationMetrics', $validation);

    // Shop-level metrics: add up every evaluated product per holdout day, then score the totals.
    $aggregateValidationMetrics = [];
    foreach ($aggPred as $method => $predictedByDay) {
        $aggregateMetrics = emptyValidationMetrics();
        foreach ($aggActual as $i => $actual) {
            recordValidationError($aggregateMetrics, (float) $actual, (float) ($predictedByDay[$i] ?? 0));
        }
        $aggregateValidationMetrics[$method] = summarizeValidationMetrics($aggregateMetrics);
    }

    $linearMetrics = $validationMetrics['linear'];
    $totalForecast = array_sum(array_column($forecastProducts, 'totalForecast'));
    $trendPercent = $previousEquivalentTotal > 0
        ? round((($totalForecast - $previousEquivalentTotal) / $previousEquivalentTotal) * 100, 2)
        : null;

    // How stale the data is: forecast day 1 is the day after the last day with data.
    $dataAgeDays = max(0, (int) $historicalEnd->diff($today)->format('%r%a'));

    return [
        'period' => $period, 'products' => $forecastProducts, 'ingredients' => array_values($risks), 'risks' => $risks, 'actions' => $actions, 'alerts' => [], 'recommendations' => [],
        'dataEndDate' => $historicalEnd->format('Y-m-d'),
        'dataAgeDays' => $dataAgeDays,
        'history' => array_map(static fn($date, $demand) => ['date' => $date, 'demand' => round($demand, 2)], array_slice(array_keys($historicalDayTotals), -7), array_slice(array_values($historicalDayTotals), -7)),
        'daily' => array_map(static fn($day, $value) => ['day' => $day, 'date' => $historicalEnd->modify("+{$day} days")->format('Y-m-d'), 'forecast' => round($value, 2)], array_keys($forecastDayTotals), $forecastDayTotals),
        'summary' => ['totalProjectedDemand' => round($totalForecast, 2), 'highPriorityCount' => count(array_filter($forecastProducts, static fn($item) => $item['priority'] === 'High')), 'recommendationCount' => count($actions), 'trendPercent' => $trendPercent, 'peakDay' => !empty($forecastDayTotals) ? array_search(max($forecastDayTotals), $forecastDayTotals, true) : null],
        'model' => [
            'name' => 'Linear trend (28-day regression, damped)',
            'mae' => $linearMetrics['mae'],
            'rmse' => $linearMetrics['rmse'],
            'mape' => $linearMetrics['mape'],
            'wape' => $linearMetrics['wape'],
            'validation_metrics' => $validationMetrics,
            'aggregate_validation_metrics' => $aggregateValidationMetrics,
            'records' => array_sum(array_map(static fn($entry) => (int) ($entry['record_count'] ?? 1), $history)),
            'training_start' => $historicalStart?->format('Y-m-d'),
            'training_end' => $historicalEnd->format('Y-m-d'),
            'validation_records' => $linearMetrics['records'],
            'validation_products' => $evaluatedProducts,
        ],
        'drivers' => ['Historical product demand', 'Recent sales average', 'Linear demand trend'],
        'insights' => array_values(array_filter([ $trendPercent !== null ? 'Expected demand is ' . ($trendPercent >= 0 ? 'increasing' : 'decreasing') . ' by ' . abs($trendPercent) . '% compared with the previous equivalent period.' : null, !empty($forecastProducts) ? $forecastProducts[array_search(max(array_column($forecastProducts, 'totalForecast')), array_column($forecastProducts, 'totalForecast'), true)]['product'] . ' has the highest projected demand.' : null, !empty($risks) && count(array_filter($risks, static fn($item) => $item['riskStatus'] === 'HIGH')) ? 'One or more ingredients may run out based on projected consumption.' : null])),
    ];
}

/**
 * Save the rows of an uploaded CSV into analytics_sales_history so that
 * getSalesHistory() can merge them with live orders.
 */
function insertImportedHistory(mysqli $conn, array $history, int $importId): void {
    $stmt = mysqli_prepare($conn, "INSERT INTO analytics_sales_history (import_id, product_name, sale_date, units_sold) VALUES (?, ?, ?, ?)");
    if (!$stmt) {
        throw new Exception('Could not save the imported sales rows.');
    }

    foreach ($history as $entry) {
        $product = normalizeProductName($entry['product'] ?? '');
        $date = $entry['date'] ?? '';
        $qty = (float) ($entry['quantity'] ?? 0);
        if (!$product || !$date) {
            continue;
        }
        mysqli_stmt_bind_param($stmt, 'issd', $importId, $product, $date, $qty);
        mysqli_stmt_execute($stmt);
    }

    mysqli_stmt_close($stmt);
}

function persistForecastData(mysqli $conn, array $history, array $forecastPayload, int $importId = 0): void {
    if (!$conn) {
        return;
    }

    mysqli_query($conn, "DELETE FROM analytics_forecasts");
    mysqli_query($conn, "DELETE FROM analytics_reorder_logs");
    mysqli_query($conn, "DELETE FROM analytics_procurement_alerts");

    if ($importId > 0) {
        mysqli_query($conn, "UPDATE analytics_imports SET rows_processed = " . count($history) . " WHERE id = $importId");
    }

    $stmtHistory = $importId > 0
        ? mysqli_prepare($conn, "INSERT INTO analytics_sales_history (import_id, product_name, sale_date, units_sold) VALUES (?, ?, ?, ?)")
        : null;
    $stmtForecast = mysqli_prepare($conn, "INSERT INTO analytics_forecasts (product_name, forecast_date, predicted_units, confidence_score) VALUES (?, ?, ?, ?)");
    $stmtReorder = mysqli_prepare($conn, "INSERT INTO analytics_reorder_logs (product_name, ingredient_name, recommended_qty, status) VALUES (?, ?, ?, ?)");
    $stmtAlert = mysqli_prepare($conn, "INSERT INTO analytics_procurement_alerts (product_name, ingredient_name, severity, message) VALUES (?, ?, ?, ?)");

    if ($stmtHistory) {
        foreach ($history as $entry) {
            $product = normalizeProductName($entry['product'] ?? '');
            $date = $entry['date'] ?? '';
            $qty = (float) ($entry['quantity'] ?? 0);
            if (!$product || !$date) {
                continue;
            }
            mysqli_stmt_bind_param($stmtHistory, 'issd', $importId, $product, $date, $qty);
            mysqli_stmt_execute($stmtHistory);
        }
    }

    // Forecast dates follow the last day with data, matching the API's "daily" labels.
    $forecastStart = new DateTimeImmutable($forecastPayload['dataEndDate'] ?? 'today');
    foreach ($forecastPayload['products'] ?? [] as $productData) {
        $productName = $productData['product'];
        $series = $productData['forecast'] ?? ($productData['projectedSeries'] ?? []);
        foreach ($series as $index => $value) {
            $date = $forecastStart->modify('+' . ($index + 1) . ' day')->format('Y-m-d');
            $confidence = 0.75 + ($index * 0.03);
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
        $ingredientName = 'Inventory';
        $severity = $alert['severity'] ?? 'warning';
        $message = $alert['message'] ?? '';
        mysqli_stmt_bind_param($stmtAlert, 'ssss', $productName, $ingredientName, $severity, $message);
        mysqli_stmt_execute($stmtAlert);
    }

    if ($stmtHistory) {
        mysqli_stmt_close($stmtHistory);
    }
    if ($stmtForecast) {
        mysqli_stmt_close($stmtForecast);
    }
    if ($stmtReorder) {
        mysqli_stmt_close($stmtReorder);
    }
    if ($stmtAlert) {
        mysqli_stmt_close($stmtAlert);
    }
}


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
        $action = $_POST['action'] ?? 'import';
    }
}

if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

try {
    if ($method === 'POST' && $action === 'import') {
        if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
            throw new Exception('Please upload a valid CSV file.');
        }
        $overlapMode = (string) ($_POST['overlap_mode'] ?? 'deduplicate_live');
        if (!in_array($overlapMode, ['deduplicate_live', 'supplement'], true)) {
            throw new Exception('Choose whether this CSV overlaps live orders or contains additional sales.');
        }

        $filePath = $_FILES['file']['tmp_name'];
        $fileName = basename($_FILES['file']['name']);
        $csvText = file_get_contents($filePath);
        $rows = array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $csvText)));
        if (empty($rows)) {
            throw new Exception('The uploaded file is empty.');
        }

        // array_filter keeps the original keys, so re-index before reading $rows[0].
        $rows = array_values($rows);

        $headers = array_map(function ($header) {
            return strtolower(trim(preg_replace('/^\xEF\xBB\xBF/', '', $header)));
        }, str_getcsv($rows[0]));

        $history = [];
        for ($i = 1; $i < count($rows); $i++) {
            $values = str_getcsv($rows[$i]);
            $entry = [];
            foreach ($headers as $index => $header) {
                $entry[$header] = $values[$index] ?? '';
            }

            $date = $entry['date'] ?? $entry['sale_date'] ?? $entry['timestamp'] ?? '';
            $product = normalizeProductName($entry['product'] ?? $entry['item'] ?? $entry['name'] ?? $entry['product_name'] ?? '');
            $quantity = (float) ($entry['quantity'] ?? $entry['qty'] ?? $entry['units_sold'] ?? $entry['sales'] ?? 0);
            if ($date && $product && $quantity > 0) {
                $history[] = ['date' => date('Y-m-d', strtotime($date)), 'product' => $product, 'quantity' => $quantity];
            }
        }

        if (empty($history)) {
            throw new Exception('The uploaded CSV did not contain usable sales rows.');
        }

        mysqli_query($conn, 'START TRANSACTION');
        $importStmt = mysqli_prepare($conn, "INSERT INTO analytics_imports (file_name, source_name, overlap_mode, rows_received, rows_processed, status) VALUES (?, ?, ?, ?, ?, 'completed')");
        mysqli_stmt_bind_param($importStmt, 'sssii', $fileName, $sourceName, $overlapMode, $rowsReceived, $rowsProcessed);
        $sourceName = 'POS Export';
        $rowsReceived = count($rows) - 1;
        $rowsProcessed = count($history);
        mysqli_stmt_execute($importStmt);
        $importId = mysqli_insert_id($conn);
        mysqli_stmt_close($importStmt);

        // 1) Save the CSV rows, 2) rebuild merged sales history using the import's
        // overlap policy, 3) forecast from the merged history.
        insertImportedHistory($conn, $history, (int) $importId);

        $period = (int) ($_POST['period'] ?? 7);
        $mergedHistory = getSalesHistory($conn);
        $products = getProducts($conn);
        $ingredientStock = getIngredientStock($conn);
        $recipes = getProductRecipes($conn);
        $forecastPayload = buildDetailedForecastPayload($mergedHistory, $products, $ingredientStock, $recipes, $period);
        persistForecastData($conn, $mergedHistory, $forecastPayload, 0);
        mysqli_query($conn, 'COMMIT');

        echo json_encode([
            'success' => true,
            'message' => 'CSV imported successfully.',
            'importId' => $importId,
            'historyCount' => count($history),
            'forecast' => $forecastPayload,
        ]);
        exit;
    }

    $history = getSalesHistory($conn);
    $period = (int) ($_GET['period'] ?? 7);
    $products = getProducts($conn);
    $ingredientStock = getIngredientStock($conn);
    $recipes = getProductRecipes($conn);
    $forecastPayload = buildDetailedForecastPayload($history, $products, $ingredientStock, $recipes, $period);

    if ($method === 'POST' && $action === 'refresh') {
        persistForecastData($conn, $history, $forecastPayload, 0);
    }

    echo json_encode([
        'success' => true,
        'message' => 'Forecast data loaded.',
        'historyCount' => count($history),
        'forecast' => $forecastPayload,
    ]);
} catch (Exception $e) {
    if (isset($conn) && mysqli_errno($conn)) {
        mysqli_query($conn, 'ROLLBACK');
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}