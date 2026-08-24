<?php
require_once __DIR__ . '/../../customer/cors.php';
require_once __DIR__ . '/../../includes/db.php';

function ensurePredictiveTables(mysqli $conn): void {
    if (!$conn) {
        return;
    }

    mysqli_query($conn, "
        CREATE TABLE IF NOT EXISTS analytics_imports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            file_name VARCHAR(255) NOT NULL,
            source_name VARCHAR(100) DEFAULT 'POS Export',
            uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(20) NOT NULL DEFAULT 'completed',
            rows_received INT NOT NULL DEFAULT 0,
            rows_processed INT NOT NULL DEFAULT 0,
            error_message TEXT NULL
        ) ENGINE=InnoDB
    ");

    mysqli_query($conn, "
        CREATE TABLE IF NOT EXISTS analytics_sales_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            import_id INT DEFAULT NULL,
            product_name VARCHAR(255) NOT NULL,
            sale_date DATE NOT NULL,
            units_sold DECIMAL(10,2) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_product_date (product_name, sale_date)
        ) ENGINE=InnoDB
    ");

    mysqli_query($conn, "
        CREATE TABLE IF NOT EXISTS analytics_forecasts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_name VARCHAR(255) NOT NULL,
            forecast_date DATE NOT NULL,
            predicted_units DECIMAL(10,2) NOT NULL DEFAULT 0,
            confidence_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_forecast_product (product_name, forecast_date)
        ) ENGINE=InnoDB
    ");

    mysqli_query($conn, "
        CREATE TABLE IF NOT EXISTS analytics_reorder_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_name VARCHAR(255) NOT NULL,
            ingredient_name VARCHAR(255) NOT NULL,
            recommended_qty DECIMAL(10,2) NOT NULL DEFAULT 0,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    ");

    mysqli_query($conn, "
        CREATE TABLE IF NOT EXISTS analytics_procurement_alerts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_name VARCHAR(255) NOT NULL,
            ingredient_name VARCHAR(255) NOT NULL,
            severity VARCHAR(20) NOT NULL DEFAULT 'warning',
            message TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    ");
}

function normalizeProductName(mixed $value): string {
    return trim(preg_replace('/\s+/', ' ', (string) $value));
}

function getSalesHistory(mysqli $conn): array {
    $history = [];

    $tables = mysqli_query($conn, "SHOW TABLES LIKE 'order_items'");
    $hasOrderItems = $tables && mysqli_num_rows($tables) > 0;

    if ($hasOrderItems) {
        $sql = "
            SELECT o.created_at AS order_date, oi.product, oi.qty
            FROM orders o
            LEFT JOIN order_items oi ON oi.order_id = o.id
            WHERE o.status IS NULL OR o.status NOT IN ('Cancelled', 'cancelled')
            AND oi.product IS NOT NULL AND TRIM(oi.product) <> ''
            ORDER BY o.created_at ASC
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

    while ($row = mysqli_fetch_assoc($result)) {
        if ($hasOrderItems) {
            $orderDate = $row['order_date'] ?? '';
            $product = normalizeProductName($row['product'] ?? '');
            $qty = max(0, (float) ($row['qty'] ?? 0));
            if ($orderDate && $product && $qty > 0) {
                $history[] = [
                    'date' => date('Y-m-d', strtotime($orderDate)),
                    'product' => $product,
                    'quantity' => $qty,
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
                $history[] = [
                    'date' => date('Y-m-d', strtotime($orderDate)),
                    'product' => $product,
                    'quantity' => $qty,
                ];
            }
        }
    }

    return $history;
}

function getIngredientStock(mysqli $conn): array {
    $result = mysqli_query($conn, "SELECT id, name, stock, threshold, unit FROM ingredients ORDER BY name ASC");
    if (!$result) {
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

function getProductRecipes(mysqli $conn): array {
    $result = mysqli_query($conn, "
        SELECT p.name AS product_name, i.name AS ingredient_name, pr.qty AS usage
        FROM product_recipes pr
        LEFT JOIN products p ON p.id = pr.product_id
        LEFT JOIN ingredients i ON i.id = pr.ingredient_id
        ORDER BY p.name ASC, i.name ASC
    ");
    if (!$result) {
        return [];
    }

    $recipes = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $productName = normalizeProductName($row['product_name'] ?? '');
        $ingredientName = trim((string) ($row['ingredient_name'] ?? ''));
        $usage = max(0, (float) ($row['usage'] ?? 0));
        if ($productName && $ingredientName) {
            $recipes[$productName][] = [
                'name' => $ingredientName,
                'usage' => $usage,
            ];
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

function persistForecastData(mysqli $conn, array $history, array $forecastPayload, int $importId = 0): void {
    if (!$conn) {
        return;
    }

    mysqli_query($conn, "DELETE FROM analytics_sales_history");
    mysqli_query($conn, "DELETE FROM analytics_forecasts");
    mysqli_query($conn, "DELETE FROM analytics_reorder_logs");
    mysqli_query($conn, "DELETE FROM analytics_procurement_alerts");

    if ($importId > 0) {
        mysqli_query($conn, "UPDATE analytics_imports SET rows_processed = " . count($history) . " WHERE id = $importId");
    }

    $stmtHistory = mysqli_prepare($conn, "INSERT INTO analytics_sales_history (import_id, product_name, sale_date, units_sold) VALUES (?, ?, ?, ?)");
    $stmtForecast = mysqli_prepare($conn, "INSERT INTO analytics_forecasts (product_name, forecast_date, predicted_units, confidence_score) VALUES (?, ?, ?, ?)");
    $stmtReorder = mysqli_prepare($conn, "INSERT INTO analytics_reorder_logs (product_name, ingredient_name, recommended_qty, status) VALUES (?, ?, ?, ?)");
    $stmtAlert = mysqli_prepare($conn, "INSERT INTO analytics_procurement_alerts (product_name, ingredient_name, severity, message) VALUES (?, ?, ?, ?)");

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

    foreach ($forecastPayload['products'] ?? [] as $productData) {
        $productName = $productData['product'];
        $series = $productData['projectedSeries'] ?? [];
        $forecastDate = date('Y-m-d', strtotime('+1 day'));
        foreach ($series as $index => $value) {
            $date = date('Y-m-d', strtotime('+' . ($index + 1) . ' day'));
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

ensurePredictiveTables($conn);

$method = $_SERVER['REQUEST_METHOD'];
$action = '';

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

        $filePath = $_FILES['file']['tmp_name'];
        $fileName = basename($_FILES['file']['name']);
        $csvText = file_get_contents($filePath);
        $rows = array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $csvText)));
        if (empty($rows)) {
            throw new Exception('The uploaded file is empty.');
        }

        $headers = array_map(function ($header) {
            return strtolower(trim($header));
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
        $importStmt = mysqli_prepare($conn, "INSERT INTO analytics_imports (file_name, source_name, rows_received, rows_processed, status) VALUES (?, ?, ?, ?, 'completed')");
        mysqli_stmt_bind_param($importStmt, 'ssii', $fileName, $sourceName, $rowsReceived, $rowsProcessed);
        $sourceName = 'POS Export';
        $rowsReceived = count($rows) - 1;
        $rowsProcessed = count($history);
        mysqli_stmt_execute($importStmt);
        $importId = mysqli_insert_id($conn);
        mysqli_stmt_close($importStmt);

        $ingredientStock = getIngredientStock($conn);
        $recipes = getProductRecipes($conn);
        $forecastPayload = buildForecastPayload($history, $ingredientStock, $recipes);
        persistForecastData($conn, $history, $forecastPayload, (int) $importId);
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
    $ingredientStock = getIngredientStock($conn);
    $recipes = getProductRecipes($conn);
    $forecastPayload = buildForecastPayload($history, $ingredientStock, $recipes);

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
