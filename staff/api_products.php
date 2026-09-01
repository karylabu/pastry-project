<?php
require_once __DIR__ . '/../includes/api_auth.php';

requireInventoryRead();

/* ================= DB ================= */

$host = 'localhost';
$db   = 'pastry_db';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

try {

    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

} catch (Exception $e) {

    echo json_encode([
        "success" => false,
        "error" => "DB connection failed"
    ]);
    exit;
}

/* ================= HELPER: CHECK PRODUCTION AVAILABILITY ================= */
function checkProductionAvailability($pdo, $productId) {
    try {
        // Get active recipe
        $recipeStmt = $pdo->prepare("
            SELECT pr.ingredient_id, pr.qty, i.name
            FROM product_recipes pr
            JOIN ingredients i ON i.id = pr.ingredient_id
            WHERE pr.product_id = ? AND pr.active = 1
            ORDER BY pr.id ASC
        ");
        $recipeStmt->execute([$productId]);
        $recipe = $recipeStmt->fetchAll();

        // No active recipe
        if (count($recipe) === 0) {
            return [
                'is_producible' => false,
                'reason' => 'No active recipe'
            ];
        }

        // Check each ingredient
        foreach ($recipe as $ingredient) {
            $ing_id = (int)$ingredient['ingredient_id'];
            $required = (float)$ingredient['qty'];
            $ing_name = $ingredient['name'];

            // Get usable batch stock
            $batchStmt = $pdo->prepare("
                SELECT COALESCE(SUM(quantity_remaining), 0) as total
                FROM ingredient_batches
                WHERE ingredient_id = ?
                  AND quantity_remaining > 0
                  AND (expiry_date IS NULL OR expiry_date >= CURDATE())
                  AND NOT EXISTS (
                    SELECT 1 FROM discard_requests dr 
                    WHERE dr.ingredient_batch_id = ingredient_batches.id 
                    AND dr.status = 'Pending'
                  )
            ");
            $batchStmt->execute([$ing_id]);
            $batchRow = $batchStmt->fetch();
            $usable = (float)($batchRow['total'] ?? 0);

            // Insufficient stock
            if ($usable < $required) {
                return [
                    'is_producible' => false,
                    'reason' => 'Insufficient ' . $ing_name
                ];
            }
        }

        return [
            'is_producible' => true,
            'reason' => null
        ];

    } catch (Exception $e) {
        return [
            'is_producible' => false,
            'reason' => 'Unable to check availability'
        ];
    }
}

/* ================= GET PRODUCTS ================= */

$action = $_GET['action'] ?? 'list';

if ($action === 'summary') {
    try {
        $summaryStmt = $pdo->query(
            "SELECT
                COUNT(*) AS total_finished_products,
                SUM(stock > 0 AND stock <= minimum_stock) AS low_stock,
                SUM(stock = 0) AS out_of_stock
             FROM products"
        );
        $summary = $summaryStmt->fetch() ?: [];
        $movementStmt = $pdo->query(
            "SELECT
                COALESCE(SUM(CASE WHEN movement_type = 'Production' THEN quantity ELSE 0 END), 0) AS today_production,
                COALESCE(SUM(CASE WHEN movement_type = 'Waste' THEN ABS(quantity) ELSE 0 END), 0) AS today_waste
             FROM product_inventory_movements
             WHERE created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY"
        );
        $movements = $movementStmt->fetch() ?: [];
        echo json_encode([
            'success' => true,
            'summary' => [
                'total_finished_products' => (int) ($summary['total_finished_products'] ?? 0),
                'low_stock' => (int) ($summary['low_stock'] ?? 0),
                'out_of_stock' => (int) ($summary['out_of_stock'] ?? 0),
                'today_production' => (float) ($movements['today_production'] ?? 0),
                'today_waste' => (float) ($movements['today_waste'] ?? 0),
            ],
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Unable to load inventory summary']);
        exit;
    }
}

if ($action === 'list') {

    try {

        $sql = "SELECT * FROM products";
        $stmt = $pdo->query($sql);
        $hasVariantsTable = (bool) $pdo->query(
            "SELECT COUNT(*) FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = 'product_variants'"
        )->fetchColumn();

        $products = [];

        while ($row = $stmt->fetch()) {
            $productId = intval($row['id']);

            $variants = [];
            if ($hasVariantsTable) {
                $variantStmt = $pdo->prepare(
                    "SELECT id, variant_size, stock_quantity, threshold, price
                     FROM product_variants
                     WHERE product_id = ?
                     ORDER BY FIELD(variant_size, 'slice', 'small', 'big')"
                );
                $variantStmt->execute([$productId]);
                $variants = $variantStmt->fetchAll();
            }

            $availability = checkProductionAvailability($pdo, $productId);
            
            $products[] = [
                "id" => $productId,
                "name" => $row["name"],
                "category" => $row["category"],
                "price" => $row["price"],
                "image" => $row["image"],
                "stock" => $row["stock"] ?? 0,
                "minimum_stock" => $row["minimum_stock"] ?? 5,
                "available" => $row["available"] ?? 1,
                "is_producible" => $availability['is_producible'],
                "availability_reason" => $availability['reason'],
                "variants" => array_map(function ($variant) {
                    return [
                        'id' => intval($variant['id']),
                        'variant_size' => $variant['variant_size'],
                        'stock_quantity' => intval($variant['stock_quantity']),
                        'threshold' => intval($variant['threshold']),
                        'price' => (float)$variant['price'],
                        'available' => intval($variant['stock_quantity']) > 0,
                    ];
                }, $variants),
            ];
        }

        echo json_encode($products);
        exit;

    } catch (Exception $e) {

        echo json_encode([
            "success" => false,
            "error" => "Query failed"
        ]);

        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_GET['action'] ?? '';

    if ($action === 'create') {
        requireInventoryManager();
        $name = trim($_POST['name'] ?? '');
        $category = trim($_POST['category'] ?? '');
        $price = floatval($_POST['price'] ?? 0);
        $stock = intval($_POST['stock'] ?? 0);
        $description = trim($_POST['description'] ?? '');

        if ($name === '' || $category === '' || $price <= 0) {
            echo json_encode([
                "success" => false,
                "error" => "Missing or invalid product data"
            ]);
            exit;
        }

        $imageName = '🍰';
        if (!empty($_FILES['image']['name']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $uploadDir = __DIR__ . '/../uploads/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }

            $ext = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
            $allowed = ['png', 'jpg', 'jpeg', 'gif'];
            if (in_array($ext, $allowed, true)) {
                $baseName = 'p' . rand(100, 999);
                $finalName = $baseName . '.' . $ext;
                $tries = 0;
                while (file_exists($uploadDir . $finalName) && $tries < 10) {
                    $finalName = $baseName . rand(1, 9) . '.' . $ext;
                    $tries++;
                }
                if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadDir . $finalName)) {
                    $imageName = $finalName;
                }
            }
        }

        try {
            $insert = $pdo->prepare(
                "INSERT INTO products (name, category, price, stock, image, description, available) VALUES (?, ?, ?, ?, ?, ?, 1)"
            );
            $insert->execute([$name, $category, $price, $stock, $imageName, $description]);
            $productId = $pdo->lastInsertId();

            $ingredientIds = $_POST['ingredient_id'] ?? [];
            $ingredientQtys = $_POST['ingredient_qty'] ?? [];
            if (is_array($ingredientIds) && is_array($ingredientQtys)) {
                $recipeInsert = $pdo->prepare(
                    "INSERT INTO product_recipes (product_id, ingredient_id, qty) VALUES (?, ?, ?)"
                );
                foreach ($ingredientIds as $index => $ingredientId) {
                    $ingredientId = intval($ingredientId);
                    $qty = floatval($ingredientQtys[$index] ?? 0);
                    if ($ingredientId > 0 && $qty > 0) {
                        $recipeInsert->execute([$productId, $ingredientId, $qty]);
                    }
                }
            }

            echo json_encode([
                "success" => true,
                "product_id" => $productId
            ]);
            exit;
        } catch (Exception $e) {
            echo json_encode([
                "success" => false,
                "error" => "Failed to create product"
            ]);
            exit;
        }
    }

    if ($action === 'update') {
        requireInventoryManager();
        $id = intval($_POST['id'] ?? 0);
        $name = trim($_POST['name'] ?? '');
        $category = trim($_POST['category'] ?? '');
        $price = floatval($_POST['price'] ?? 0);
        $stock = intval($_POST['stock'] ?? 0);
        $description = trim($_POST['description'] ?? '');

        if ($id <= 0) {
            echo json_encode(["success" => false, "error" => "Missing product id"]);
            exit;
        }
        if ($stock < 0) {
            echo json_encode(["success" => false, "error" => "Stock cannot be negative"]);
            exit;
        }

        try {
            // Handle image upload if present
            $imageName = null;
            if (!empty($_FILES['image']['name']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = __DIR__ . '/../uploads/';
                if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

                $ext = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
                $allowed = ['png', 'jpg', 'jpeg', 'gif'];
                if (in_array($ext, $allowed, true)) {
                    $baseName = 'p' . rand(100, 999);
                    $finalName = $baseName . '.' . $ext;
                    $tries = 0;
                    while (file_exists($uploadDir . $finalName) && $tries < 10) {
                        $finalName = $baseName . rand(1, 9) . '.' . $ext;
                        $tries++;
                    }
                    if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadDir . $finalName)) {
                        $imageName = $finalName;
                    }
                }
            }

            // Build update query dynamically
            $fields = [];
            $params = [];
            if ($name !== '') { $fields[] = 'name = ?'; $params[] = $name; }
            if ($category !== '') { $fields[] = 'category = ?'; $params[] = $category; }
            if ($price > 0) { $fields[] = 'price = ?'; $params[] = $price; }
            if (isset($_POST['stock'])) { $fields[] = 'stock = ?'; $params[] = $stock; }
            if ($description !== '') { $fields[] = 'description = ?'; $params[] = $description; }
            if ($imageName !== null) { $fields[] = 'image = ?'; $params[] = $imageName; }

            if (count($fields) === 0) {
                echo json_encode(["success" => false, "error" => "No fields to update"]);
                exit;
            }

            $previousStock = null;
            $pdo->beginTransaction();
            if (isset($_POST['stock'])) {
                $stockStmt = $pdo->prepare("SELECT stock FROM products WHERE id = ? FOR UPDATE");
                $stockStmt->execute([$id]);
                $stockRow = $stockStmt->fetch();
                if (!$stockRow) {
                    $pdo->rollBack();
                    echo json_encode(["success" => false, "error" => "Product not found"]);
                    exit;
                }
                $previousStock = (int) $stockRow['stock'];
            }

            $sql = "UPDATE products SET " . implode(', ', $fields) . " WHERE id = ?";
            $params[] = $id;
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);

            if ($previousStock !== null && $stock !== $previousStock) {
                $movementQuantity = $stock - $previousStock;
                $movementUserId = (int) ($_SESSION['user']['id'] ?? 0);
                $movementStmt = $pdo->prepare(
                    "INSERT INTO product_inventory_movements
                     (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference_type, user_id)
                     VALUES (?, 'Inventory Correction', ?, ?, ?, 'Product edit stock correction', 'stock_adjustment', ?)"
                );
                $movementStmt->execute([$id, $movementQuantity, $previousStock, $stock, $movementUserId ?: null]);
            }

            $pdo->commit();

            echo json_encode(["success" => true, "updated" => $stmt->rowCount()]);
            exit;

        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            echo json_encode(["success" => false, "error" => "Update failed"]);
            exit;
        }
    }
}

/* ================= INVALID ================= */

echo json_encode([
    "success" => false,
    "error" => "Invalid action"
]);

?>