<?php
/**
 * Test Availability Layer
 */

$conn = new mysqli("localhost", "root", "", "pastry_db");
if ($conn->connect_error) die("DB Error: " . $conn->connect_error);

echo "===== PRODUCTION AVAILABILITY TESTING =====\n\n";

// Test helper function
function checkAvailability($conn, $product_id) {
    // Get product
    $p = $conn->prepare("SELECT id, name FROM products WHERE id = ?");
    $p->bind_param('i', $product_id);
    $p->execute();
    $product = $p->get_result()->fetch_assoc();
    $p->close();
    
    if (!$product) return ['is_producible' => false, 'reason' => 'Product not found'];
    
    // Get active recipe
    $r = $conn->prepare("
        SELECT pr.ingredient_id, pr.qty, i.name
        FROM product_recipes pr
        JOIN ingredients i ON i.id = pr.ingredient_id
        WHERE pr.product_id = ? AND pr.active = 1
    ");
    $r->bind_param('i', $product_id);
    $r->execute();
    $recipeResult = $r->get_result();
    $recipe = [];
    while ($row = $recipeResult->fetch_assoc()) {
        $recipe[] = $row;
    }
    $recipeResult->free();
    $r->close();
    
    if (count($recipe) === 0) {
        return ['is_producible' => false, 'reason' => 'No active recipe'];
    }
    
    // Check each ingredient
    foreach ($recipe as $ingredient) {
        $ing_id = (int)$ingredient['ingredient_id'];
        $required = (float)$ingredient['qty'];
        $ing_name = $ingredient['name'];
        
        $b = $conn->prepare("
            SELECT COALESCE(SUM(quantity_remaining), 0) as total
            FROM ingredient_batches
            WHERE ingredient_id = ?
              AND quantity_remaining > 0
              AND (expiry_date IS NULL OR expiry_date >= CURDATE())
              AND NOT EXISTS (SELECT 1 FROM discard_requests dr WHERE dr.ingredient_batch_id = ingredient_batches.id AND dr.status = 'Pending')
        ");
        $b->bind_param('i', $ing_id);
        $b->execute();
        $batchRow = $b->get_result()->fetch_assoc();
        $usable = (float)($batchRow['total'] ?? 0);
        $b->close();
        
        if ($usable < $required) {
            return ['is_producible' => false, 'reason' => 'Insufficient ' . $ing_name];
        }
    }
    
    return ['is_producible' => true, 'reason' => null];
}

// TEST SCENARIO A: Chocolate Cake (should have recipe and ingredients)
echo "TEST A: Chocolate Cake (with valid ingredients)\n";
$a = checkAvailability($conn, 128);
echo "Result: " . ($a['is_producible'] ? 'AVAILABLE' : 'UNAVAILABLE') . "\n";
if ($a['reason']) echo "Reason: {$a['reason']}\n";
echo "\n";

// TEST SCENARIO B: Vanilla Cake (should have recipe and ingredients)
echo "TEST B: Vanilla Cake (with valid ingredients)\n";
$b = checkAvailability($conn, 129);
echo "Result: " . ($b['is_producible'] ? 'AVAILABLE' : 'UNAVAILABLE') . "\n";
if ($b['reason']) echo "Reason: {$b['reason']}\n";
echo "\n";

// TEST SCENARIO C: Product without recipe
echo "TEST C: Check a product without active recipe\n";
$c = checkAvailability($conn, 1);
echo "Result: " . ($c['is_producible'] ? 'AVAILABLE' : 'UNAVAILABLE') . "\n";
if ($c['reason']) echo "Reason: {$c['reason']}\n";
echo "\n";

// Show ingredient batch status for DEV ingredients
echo "===== INGREDIENT BATCH STATUS (DEV Products) =====\n";
$stmt = $conn->query("
    SELECT 
        i.id, i.name, i.stock,
        COUNT(DISTINCT ib.id) as batch_count,
        SUM(CASE WHEN ib.quantity_remaining > 0 AND (ib.expiry_date IS NULL OR ib.expiry_date >= CURDATE()) THEN 1 ELSE 0 END) as valid_batches,
        COALESCE(SUM(ib.quantity_remaining), 0) as total_qty
    FROM ingredients i
    LEFT JOIN ingredient_batches ib ON i.id = ib.ingredient_id
    WHERE i.name LIKE '[DEV]%'
    GROUP BY i.id, i.name, i.stock
");
while ($row = $stmt->fetch_assoc()) {
    echo "- {$row['name']}: {$row['stock']} master stock | {$row['valid_batches']}/{$row['batch_count']} valid batches | {$row['total_qty']} total usable\n";
}

$conn->close();
echo "\nTest Complete\n";
