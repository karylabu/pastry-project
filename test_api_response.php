<?php
/**
 * Test API Products Response with Availability Fields
 */

// Simulate authentication
$_SESSION = ['user_id' => 999, 'role' => 'admin'];

// Mock the API auth
function requireInventoryRead() {}

// Now include the API
$_GET['action'] = 'list';

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
    echo json_encode(["success" => false, "error" => "DB connection failed"]);
    exit;
}

// Helper function from api_products.php
function checkProductionAvailability($pdo, $productId) {
    try {
        $recipeStmt = $pdo->prepare("
            SELECT pr.ingredient_id, pr.qty, i.name
            FROM product_recipes pr
            JOIN ingredients i ON i.id = pr.ingredient_id
            WHERE pr.product_id = ? AND pr.active = 1
            ORDER BY pr.id ASC
        ");
        $recipeStmt->execute([$productId]);
        $recipe = $recipeStmt->fetchAll();

        if (count($recipe) === 0) {
            return ['is_producible' => false, 'reason' => 'No active recipe'];
        }

        foreach ($recipe as $ingredient) {
            $ing_id = (int)$ingredient['ingredient_id'];
            $required = (float)$ingredient['qty'];
            $ing_name = $ingredient['name'];

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

            if ($usable < $required) {
                return ['is_producible' => false, 'reason' => 'Insufficient ' . $ing_name];
            }
        }

        return ['is_producible' => true, 'reason' => null];
    } catch (Exception $e) {
        return ['is_producible' => false, 'reason' => 'Unable to check availability'];
    }
}

// Test with DEV products
echo "===== API RESPONSE TEST (Products with Availability) =====\n\n";

$sql = "SELECT * FROM products WHERE id IN (128, 129)";
$stmt = $pdo->query($sql);
$products = [];

while ($row = $stmt->fetch()) {
    $productId = intval($row['id']);
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
        "variants" => []
    ];
}

// Pretty print
foreach ($products as $product) {
    echo "Product ID: {$product['id']}\n";
    echo "Name: {$product['name']}\n";
    echo "Stock: {$product['stock']}\n";
    echo "is_producible: " . ($product['is_producible'] ? 'true' : 'false') . "\n";
    echo "availability_reason: " . ($product['availability_reason'] ?? 'null') . "\n";
    echo "---\n";
}

echo "\nJSON Response Sample:\n";
echo json_encode([$products[0]], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

$pdo = null;
