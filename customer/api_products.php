<?php
require_once __DIR__ . '/cors.php';

/* ================= OPTIONS ================= */

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

/* ================= DATABASE ================= */

$host = 'localhost';
$db   = 'pastry_db';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {

    $pdo = new PDO($dsn, $user, $pass, $options);

} catch (\PDOException $e) {

    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);

    exit;
}

/* ================= ACTION ================= */

$action = $_GET['action'] ?? 'list';

function getProductSizeOptions(PDO $pdo, array $product): array {
    $productId = (int) ($product['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT id, size, price, available FROM product_sizes WHERE product_id = ? ORDER BY FIELD(size, 'slice', 'small', 'big', 'regular', 'meal', 'combo', 'solo', 'sharing'), id");
    $stmt->execute([$productId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($rows)) {
        $sizes = [];
        $seenSizes = [];
        foreach ($rows as $row) {
            $size = trim((string) ($row['size'] ?? ''));
            if ($size === '') {
                continue;
            }
            $sizeKey = strtolower($size);
            if (isset($seenSizes[$sizeKey])) {
                continue;
            }
            $seenSizes[$sizeKey] = true;
            $sizes[] = [
                'id' => (int) ($row['id'] ?? 0),
                'size' => $size,
                'price' => (float) ($row['price'] ?? 0),
                'available' => (int) ($row['available'] ?? 1),
            ];
        }
        return $sizes;
    }

    $category = strtolower(trim((string) ($product['category'] ?? '')));
    $sizeChecks = [];

    if ($category === 'cakes') {
        $sizeChecks = [
            ['size' => 'slice', 'price' => (float) ($product['slice_price'] ?? 0)],
            ['size' => 'small', 'price' => (float) ($product['small_price'] ?? 0)],
            ['size' => 'big', 'price' => (float) ($product['big_price'] ?? 0)],
        ];
    } elseif ($category === 'meals' || $category === 'pasta' || $category === 'pizza') {
        $sizeChecks = [
            ['size' => 'regular', 'price' => (float) ($product['price'] ?? 0)],
            ['size' => 'meal', 'price' => (float) ($product['meal_price'] ?? 0)],
            ['size' => 'combo', 'price' => (float) ($product['combo_price'] ?? 0)],
        ];
    } elseif ($category === 'starter' || $category === 'starters') {
        $sizeChecks = [
            ['size' => 'solo', 'price' => (float) ($product['solo_price'] ?? 0)],
            ['size' => 'sharing', 'price' => (float) ($product['sharing_price'] ?? 0)],
        ];
    } else {
        $sizeChecks = [
            ['size' => 'regular', 'price' => (float) ($product['price'] ?? 0)],
        ];
    }

    $filtered = [];
    foreach ($sizeChecks as $sizeEntry) {
        $sizeName = trim((string) ($sizeEntry['size'] ?? ''));
        $price = (float) ($sizeEntry['price'] ?? 0);
        if ($sizeName === '' || $price <= 0) {
            continue;
        }
        $filtered[] = [
            'id' => 0,
            'size' => $sizeName,
            'price' => $price,
            'available' => (int) ($product['available'] ?? 1),
        ];
    }

    return $filtered;
}

/* =========================================================
   1. GET PRODUCTS
========================================================= */

if ($action === 'list') {

    $stmt = $pdo->query("
        SELECT *
        FROM products
        WHERE available = 1
    ");

    $products = $stmt->fetchAll();
    foreach ($products as &$product) {
        $product['sizes'] = getProductSizeOptions($pdo, $product);
        $product['price'] = (float) ($product['price'] ?? 0);
        if (empty($product['sizes'])) {
            $product['price'] = max(
                (float) ($product['price'] ?? 0),
                (float) ($product['slice_price'] ?? 0),
                (float) ($product['small_price'] ?? 0),
                (float) ($product['big_price'] ?? 0),
                (float) ($product['meal_price'] ?? 0),
                (float) ($product['combo_price'] ?? 0),
                (float) ($product['solo_price'] ?? 0),
                (float) ($product['sharing_price'] ?? 0)
            );
            $product['sizes'] = [
                [
                    'id' => 0,
                    'size' => 'Regular',
                    'price' => $product['price'],
                    'available' => (int) ($product['available'] ?? 1),
                ]
            ];
        }
    }
    unset($product);

    echo json_encode($products);

    exit;
}

/* =========================================================
   1B. BEST SELLERS
========================================================= */

if ($action === 'bestsellers') {
    $salesStmt = $pdo->query("SELECT o.items, oi.product, oi.qty
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE LOWER(o.status) = 'completed'");
    $salesByProduct = [];
    foreach ($salesStmt->fetchAll() as $sale) {
        $savedItems = json_decode((string) ($sale['items'] ?? ''), true);
        if (is_array($savedItems)) {
            foreach ($savedItems as $savedItem) {
                $name = strtolower(trim((string) ($savedItem['product'] ?? $savedItem['name'] ?? '')));
                if ($name !== '') {
                    $salesByProduct[$name] = ($salesByProduct[$name] ?? 0) + max(1, (int) ($savedItem['qty'] ?? 1));
                }
            }
        }

        $name = strtolower(trim((string) ($sale['product'] ?? '')));
        if ($name !== '' && !is_array($savedItems)) {
            $salesByProduct[$name] = ($salesByProduct[$name] ?? 0) + max(1, (int) ($sale['qty'] ?? 1));
        }
    }

    $productsStmt = $pdo->query("SELECT * FROM products WHERE available = 1 AND stock > 0");
    $bestSellers = [];
    foreach ($productsStmt->fetchAll() as $product) {
        $name = strtolower(trim((string) ($product['name'] ?? '')));
        if ($name === '' || !isset($salesByProduct[$name])) {
            continue;
        }
        $product['total_sold'] = $salesByProduct[$name];
        $bestSellers[] = $product;
    }
    usort($bestSellers, fn ($a, $b) => $b['total_sold'] <=> $a['total_sold'] ?: strcasecmp($a['name'], $b['name']));
    $bestSellers = array_slice($bestSellers, 0, 6);

    foreach ($bestSellers as &$product) {
        $product['sizes'] = getProductSizeOptions($pdo, $product);
        $product['price'] = (float) ($product['price'] ?? 0);
        if (empty($product['sizes'])) {
            $product['price'] = max(
                (float) ($product['price'] ?? 0),
                (float) ($product['slice_price'] ?? 0),
                (float) ($product['small_price'] ?? 0),
                (float) ($product['big_price'] ?? 0),
                (float) ($product['meal_price'] ?? 0),
                (float) ($product['combo_price'] ?? 0),
                (float) ($product['solo_price'] ?? 0),
                (float) ($product['sharing_price'] ?? 0)
            );
            $product['sizes'] = [[
                'id' => 0,
                'size' => 'Regular',
                'price' => $product['price'],
                'available' => (int) ($product['available'] ?? 1),
            ]];
        }
        $product['total_sold'] = (int) ($product['total_sold'] ?? 0);
    }
    unset($product);

    echo json_encode($bestSellers);
    exit;
}

/* =========================================================
   2. CUSTOM CAKE ORDER
========================================================= */

if ($action === 'customize' && $_SERVER['REQUEST_METHOD'] === 'POST') {

    try {

        $pdo->beginTransaction();

        /* ================= FORM DATA ================= */

        $flavor     = $_POST['flavor'] ?? '';
        $tiers      = $_POST['tiers'] ?? '';
        $dedication = $_POST['dedication'] ?? '';
        $method     = $_POST['method'] ?? '';
        $date       = $_POST['date'] ?? '';
        $time       = $_POST['time'] ?? '';
        $notes      = $_POST['notes'] ?? '';

        /* ================= IMAGE UPLOAD ================= */

        $uploaded_images = [];

        if (!empty($_FILES['inspo_images'])) {

            $target_dir = "../uploads/inspo/";

            if (!is_dir($target_dir)) {
                mkdir($target_dir, 0777, true);
            }

            foreach ($_FILES['inspo_images']['tmp_name'] as $key => $tmp_name) {

                if ($_FILES['inspo_images']['error'][$key] === 0) {

                    $original_name = $_FILES['inspo_images']['name'][$key];

                    $file_ext = pathinfo($original_name, PATHINFO_EXTENSION);

                    $new_file_name =
                        "inspo_" .
                        time() .
                        "_" .
                        $key .
                        "." .
                        $file_ext;

                    if (
                        move_uploaded_file(
                            $tmp_name,
                            $target_dir . $new_file_name
                        )
                    ) {

                        $uploaded_images[] = $new_file_name;
                    }
                }
            }
        }

        $images_json = json_encode($uploaded_images);

        /* ================= INSERT ORDER ================= */

        $sql1 = "
            INSERT INTO orders
            (
                customer,
                email,
                type,
                status,
                total,
                payment,
                address,
                notes,
                order_date,
                is_customized
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)
        ";

        $stmt1 = $pdo->prepare($sql1);

        $stmt1->execute([
            'Guest Customer',
            'guest@email.com',
            'Custom',
            'Pending',
            0,
            'COD',
            '',
            $notes,
            1
        ]);

        $order_id = $pdo->lastInsertId();

        /* ================= INSERT CUSTOM DETAILS ================= */

        $sql2 = "
            INSERT INTO custom_cake_orders
            (
                order_id,
                flavor,
                tiers,
                dedication,
                delivery_method,
                delivery_date,
                delivery_time,
                notes,
                inspo_images
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ";

        $stmt2 = $pdo->prepare($sql2);

        $stmt2->execute([
            $order_id,
            $flavor,
            $tiers,
            $dedication,
            $method,
            $date,
            $time,
            $notes,
            $images_json
        ]);

        $pdo->commit();

        echo json_encode([
            "success" => true,
            "message" => "Custom cake request submitted successfully!",
            "order_id" => $order_id
        ]);

    } catch (Exception $e) {

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        echo json_encode([
            "success" => false,
            "error" => $e->getMessage()
        ]);
    }

    exit;
}

/* =========================================================
   3. REGULAR ORDER
========================================================= */

if ($action === 'add' && $_SERVER['REQUEST_METHOD'] === 'POST') {

    try {

        $pdo->beginTransaction();

        $input = json_decode(file_get_contents("php://input"), true);

        $items   = $input['items'] ?? [];
        $total   = $input['total'] ?? 0;
        $address = $input['address'] ?? '';

        /* ================= INSERT ORDER ================= */

        $sql = "
            INSERT INTO orders
            (
                customer,
                email,
                type,
                status,
                total,
                payment,
                address,
                notes,
                order_date,
                is_customized
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            'Guest Customer',
            'guest@email.com',
            'Standard',
            'Pending',
            $total,
            'COD',
            $address,
            '',
            0
        ]);

        $order_id = $pdo->lastInsertId();

        /* ================= INSERT ORDER ITEMS ================= */

        foreach ($items as $item) {

            $name     = $item['name'] ?? '';
            $variant  = $item['variant'] ?? '';
            $qty      = $item['qty'] ?? 1;
            $price    = $item['price'] ?? 0;

            $details = isset($item['selectionDetails'])
                ? json_encode($item['selectionDetails'])
                : '';

            $item_sql = "
                INSERT INTO order_items
                (
                    order_id,
                    product,
                    variant,
                    qty,
                    price,
                    details
                )
                VALUES
                (?, ?, ?, ?, ?, ?)
            ";

            $item_stmt = $pdo->prepare($item_sql);

            $item_stmt->execute([
                $order_id,
                $name,
                $variant,
                $qty,
                $price,
                $details
            ]);
        }

        $pdo->commit();

        echo json_encode([
            "success" => true,
            "message" => "Order placed successfully!",
            "order_id" => $order_id
        ]);

    } catch (Exception $e) {

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        echo json_encode([
            "success" => false,
            "error" => $e->getMessage()
        ]);
    }

    exit;
}

/* =========================================================
   4. RECOMMENDATIONS
========================================================= */

if ($action === 'recommendations') {
    session_start();

    $requestedUserId = isset($_GET['user_id']) ? (int) $_GET['user_id'] : 0;
    $userId = $requestedUserId > 0 ? $requestedUserId : ((int) ($_SESSION['user']['id'] ?? 0));

    if ($userId <= 0) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Authentication required.'
        ]);
        exit;
    }

    $userStmt = $pdo->prepare("SELECT email FROM users WHERE id = ? LIMIT 1");
    $userStmt->execute([$userId]);
    $userRow = $userStmt->fetch();
    $userEmail = strtolower(trim((string) ($userRow['email'] ?? '')));

    $columnCheck = $pdo->query("SHOW COLUMNS FROM orders LIKE 'user_id'");
    $hasUserIdColumn = $columnCheck && $columnCheck->rowCount() > 0;

        $orderHistorySql = $hasUserIdColumn
                ? "SELECT o.items, oi.product
           FROM orders o
           LEFT JOIN order_items oi ON oi.order_id = o.id
                     WHERE (o.user_id = ? OR LOWER(o.email) = LOWER(?))
                         AND LOWER(o.status) = 'completed'
                     ORDER BY o.created_at DESC, o.id DESC"
                : "SELECT o.items, oi.product
           FROM orders o
           LEFT JOIN order_items oi ON oi.order_id = o.id
                     WHERE LOWER(o.email) = LOWER(?)
                         AND LOWER(o.status) = 'completed'
                     ORDER BY o.created_at DESC, o.id DESC";

    $historyStmt = $pdo->prepare($orderHistorySql);
    if ($hasUserIdColumn) {
        $historyStmt->execute([$userId, $userEmail]);
    } else {
        $historyStmt->execute([$userEmail]);
    }
    $historyRows = $historyStmt->fetchAll();

    $previousProducts = [];
    foreach ($historyRows as $row) {
        $productName = trim((string) ($row['product'] ?? ''));
        if ($productName !== '' && !in_array(strtolower($productName), $previousProducts, true)) {
            $previousProducts[] = strtolower($productName);
        }

        $savedItems = json_decode((string) ($row['items'] ?? ''), true);
        if (is_array($savedItems)) {
            foreach ($savedItems as $savedItem) {
                $savedProductName = trim((string) ($savedItem['product'] ?? $savedItem['name'] ?? ''));
                $savedProductKey = strtolower($savedProductName);
                if ($savedProductKey !== '' && !in_array($savedProductKey, $previousProducts, true)) {
                    $previousProducts[] = $savedProductKey;
                }
            }
        }
    }

    $popularStmt = $pdo->query("SELECT oi.product, SUM(oi.qty) AS total_sold FROM order_items oi GROUP BY oi.product ORDER BY total_sold DESC LIMIT 20");
    $popularRows = $popularStmt ? $popularStmt->fetchAll() : [];
    $popularMap = [];
    $maxPopular = 1;
    foreach ($popularRows as $row) {
        $productName = strtolower(trim((string) ($row['product'] ?? '')));
        if ($productName === '') {
            continue;
        }
        $count = (float) ($row['total_sold'] ?? 0);
        $popularMap[$productName] = $count;
        $maxPopular = max($maxPopular, $count);
    }

    $coPurchaseSql = $hasUserIdColumn
        ? "SELECT oi2.product AS recommended_product, COUNT(*) AS co_purchase_count
           FROM order_items oi1
           JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product <> oi2.product
           WHERE oi1.product IN (
               SELECT DISTINCT oi.product
               FROM orders o
               JOIN order_items oi ON oi.order_id = o.id
                             WHERE o.user_id = ?
                                 AND LOWER(o.status) = 'completed'
                                 AND o.id = (
                                         SELECT latest.id
                                         FROM orders latest
                                         WHERE latest.user_id = ?
                                             AND LOWER(latest.status) = 'completed'
                                         ORDER BY latest.created_at DESC, latest.id DESC
                                         LIMIT 1
                                 )
           )
           GROUP BY oi2.product
           ORDER BY co_purchase_count DESC"
        : "SELECT oi2.product AS recommended_product, COUNT(*) AS co_purchase_count
           FROM order_items oi1
           JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product <> oi2.product
           WHERE oi1.product IN (
               SELECT DISTINCT oi.product
               FROM orders o
               JOIN order_items oi ON oi.order_id = o.id
                             WHERE LOWER(o.email) = LOWER(?)
                                 AND LOWER(o.status) = 'completed'
                                 AND o.id = (
                                         SELECT latest.id
                                         FROM orders latest
                                         WHERE LOWER(latest.email) = LOWER(?)
                                             AND LOWER(latest.status) = 'completed'
                                         ORDER BY latest.created_at DESC, latest.id DESC
                                         LIMIT 1
                                 )
           )
           GROUP BY oi2.product
           ORDER BY co_purchase_count DESC";

    $coPurchaseStmt = $pdo->prepare($coPurchaseSql);
    if ($hasUserIdColumn) {
        $coPurchaseStmt->execute([$userId, $userId]);
    } else {
        $coPurchaseStmt->execute([$userEmail, $userEmail]);
    }
    $coPurchaseRows = $coPurchaseStmt->fetchAll();

    $coPurchaseMap = [];
    foreach ($coPurchaseRows as $row) {
        $name = strtolower(trim((string) ($row['recommended_product'] ?? '')));
        if ($name !== '') {
            $coPurchaseMap[$name] = (float) ($row['co_purchase_count'] ?? 0);
        }
    }

    $favoriteStmt = $pdo->prepare("SELECT product_id FROM favorites WHERE customer_id = ? ORDER BY created_at DESC");
    $favoriteStmt->execute([$userId]);
    $favoriteIds = array_map('intval', $favoriteStmt->fetchAll(PDO::FETCH_COLUMN));
    $favoriteSet = array_fill_keys(array_map('strval', $favoriteIds), true);

    $eligibleProducts = $pdo->query("SELECT * FROM products WHERE available = 1 AND stock > 0 ORDER BY name ASC")->fetchAll();

    $results = [];
    $previousSet = array_fill_keys($previousProducts, true);

    foreach ($eligibleProducts as $product) {
        $productName = strtolower(trim((string) ($product['name'] ?? '')));
        if ($productName === '') {
            continue;
        }

        if (!isset($previousSet[$productName])) {
            continue;
        }

        $purchaseScore = 0;
        foreach ($previousProducts as $previousProduct) {
            similar_text($previousProduct, $productName, $similarity);
            $purchaseScore = max($purchaseScore, (float) $similarity / 100);
        }

        $similarityScore = 0;
        foreach ($previousProducts as $previousProduct) {
            $previousNameParts = preg_split('/[\s,\-\/]+/', $previousProduct);
            $currentNameParts = preg_split('/[\s,\-\/]+/', $productName);
            $intersections = array_intersect(array_filter($previousNameParts), array_filter($currentNameParts));
            if (!empty($intersections)) {
                $similarityScore = max($similarityScore, min(1, count($intersections) / max(1, count($currentNameParts))));
            }
        }

        $coPurchaseScore = $coPurchaseMap[$productName] ?? 0;
        $normalizedPopularity = ($popularMap[$productName] ?? 0) / max(1, $maxPopular);
        $recentActivity = isset($favoriteSet[(string) ($product['id'] ?? 0)]) ? 1 : 0;

        $weightedScore = (
            0.35 * $purchaseScore +
            0.25 * $similarityScore +
            0.20 * min($coPurchaseScore / 10, 1) +
            0.15 * $normalizedPopularity +
            0.05 * $recentActivity
        );

        $reason = 'Popular and in stock';
        if ($purchaseScore > 0.35) {
            $reason = 'Based on your previous orders';
        } elseif ($coPurchaseScore > 0) {
            $reason = 'Frequently bought with your previous purchases';
        } elseif ($normalizedPopularity > 0.4) {
            $reason = 'One of our most popular pastries';
        } elseif ($recentActivity > 0) {
            $reason = 'You saved this before';
        }

        $sizeOptions = getProductSizeOptions($pdo, $product);
        $primaryPrice = !empty($sizeOptions) ? (float) $sizeOptions[0]['price'] : (float) ($product['price'] ?? 0);

        $results[] = [
            'id' => (int) ($product['id'] ?? 0),
            'name' => $product['name'],
            'category' => $product['category'] ?? '',
            'price' => $primaryPrice,
            'image' => $product['image'] ?? '',
            'description' => $product['description'] ?? '',
            'stock' => (int) ($product['stock'] ?? 0),
            'available' => (int) ($product['available'] ?? 1),
            'sizes' => $sizeOptions,
            'score' => round($weightedScore, 4),
            'reason' => $reason,
        ];
    }

    if (empty($results)) {
        foreach ($eligibleProducts as $product) {
            $productName = strtolower(trim((string) ($product['name'] ?? '')));
            if ($productName === '') {
                continue;
            }

            $fallbackPopularity = ($popularMap[$productName] ?? 0) / max(1, $maxPopular);
            $sizeOptions = getProductSizeOptions($pdo, $product);
            $primaryPrice = !empty($sizeOptions) ? (float) $sizeOptions[0]['price'] : (float) ($product['price'] ?? 0);

            $results[] = [
                'id' => (int) ($product['id'] ?? 0),
                'name' => $product['name'],
                'category' => $product['category'] ?? '',
                'price' => $primaryPrice,
                'image' => $product['image'] ?? '',
                'description' => $product['description'] ?? '',
                'stock' => (int) ($product['stock'] ?? 0),
                'available' => (int) ($product['available'] ?? 1),
                'sizes' => $sizeOptions,
                'score' => round(0.4 + ($fallbackPopularity * 0.6), 4),
                'reason' => 'Popular and in stock',
            ];
        }
    }

    usort($results, fn ($a, $b) => $b['score'] <=> $a['score']);

    echo json_encode([
        'success' => true,
        'items' => array_slice($results, 0, 6)
    ]);
    exit;
}

/* =========================================================
   INVALID ACTION
========================================================= */

echo json_encode([
    "success" => false,
    "error" => "Invalid action requested"
]);

?>
