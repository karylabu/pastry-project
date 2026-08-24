<?php
/**
 * Pastry Shop - Product Database Fixer
 * 
 * This script fixes the products database to ensure:
 * 1. Categories are correctly set to: Cakes, Meals, Starters
 * 2. Each product has different sizes and prices
 * 3. All variant prices are properly set
 * 
 * Usage: Run this from the command line or browser
 * Command line: php customer/fix_products_db.php
 * Browser: http://localhost/customer/fix_products_db.php
 */

ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../includes/db.php';

if (!$conn) {
    die(json_encode(['success' => false, 'message' => 'Database connection failed']));
}

header('Content-Type: application/json');

try {
    $logs = [];
    
    // Log: Start
    $logs[] = "=== Starting Product Database Fix ===";
    
    // Step 1: Update old categories to new ones
    $logs[] = "\n[Step 1] Updating product categories...";
    $categoryUpdates = [
        "Pasta" => "Starters",
        "Pizza" => "Starters",
        "Drinks" => "Starters"
    ];
    
    foreach ($categoryUpdates as $old => $new) {
        $sql = "UPDATE products SET category = ? WHERE category = ?";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $conn->error);
        }
        $stmt->bind_param("ss", $new, $old);
        if (!$stmt->execute()) {
            throw new Exception("Execute failed: " . $stmt->error);
        }
        $affected = $stmt->affected_rows;
        $stmt->close();
        $logs[] = "  ✓ Updated {$affected} products from '{$old}' to '{$new}'";
    }
    
    // Step 2: Ensure all Cake products have proper variant pricing
    $logs[] = "\n[Step 2] Setting Cake variant prices...";
    $cakePrices = [
        9 => ['slice' => 100.00, 'small' => 450.00, 'big' => 789.00],
        10 => ['slice' => 100.00, 'small' => 450.00, 'big' => 790.00],
        11 => ['slice' => 105.00, 'small' => 490.00, 'big' => 880.00],
        12 => ['slice' => 105.00, 'small' => 490.00, 'big' => 880.00],
        13 => ['slice' => 105.00, 'small' => 490.00, 'big' => 880.00],
        14 => ['slice' => 105.00, 'small' => 490.00, 'big' => 880.00],
        15 => ['slice' => 110.00, 'small' => 510.00, 'big' => 920.00],
        16 => ['slice' => 110.00, 'small' => 510.00, 'big' => 920.00],
        17 => ['slice' => 110.00, 'small' => 530.00, 'big' => 950.00],
        18 => ['slice' => 110.00, 'small' => 530.00, 'big' => 950.00],
        19 => ['slice' => 105.00, 'small' => 530.00, 'big' => 1000.00],
        20 => ['slice' => 135.00, 'small' => 700.00, 'big' => 1300.00],
        21 => ['slice' => 175.00, 'small' => 900.00, 'big' => 1750.00],
    ];
    
    $cakeCount = 0;
    foreach ($cakePrices as $id => $prices) {
        $sql = "UPDATE products SET slice_price = ?, small_price = ?, big_price = ?, meal_price = 0, combo_price = 0 
                WHERE id = ? AND category = 'Cakes'";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $conn->error);
        }
        $stmt->bind_param("dddi", $prices['slice'], $prices['small'], $prices['big'], $id);
        if (!$stmt->execute()) {
            throw new Exception("Execute failed: " . $stmt->error);
        }
        $cakeCount += $stmt->affected_rows;
        $stmt->close();
    }
    $logs[] = "  ✓ Updated {$cakeCount} cake products with variant pricing";
    
    // Step 3: Ensure all Meal products have proper variant pricing
    $logs[] = "\n[Step 3] Setting Meal variant prices...";
    $sql = "UPDATE products SET 
            price = COALESCE(NULLIF(price, 0), 199.00),
            slice_price = 199.00,
            small_price = 219.00,
            big_price = 309.00,
            meal_price = 219.00,
            combo_price = 309.00
            WHERE category = 'Meals'";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $conn->error);
    }
    $stmt->execute();
    $mealCount = $stmt->affected_rows;
    $stmt->close();
    $logs[] = "  ✓ Updated {$mealCount} meal products with variant pricing";
    
    // Step 4: Set up Starters category products
    $logs[] = "\n[Step 4] Setting Starter variant prices...";
    $starterPrices = [
        32 => ['price' => 140.00, 'small' => 165.00, 'big' => 200.00, 'meal' => 165.00],
        33 => ['price' => 140.00, 'small' => 165.00, 'big' => 200.00, 'meal' => 165.00],
        34 => ['price' => 140.00, 'small' => 165.00, 'big' => 200.00, 'meal' => 165.00],
        35 => ['price' => 140.00, 'small' => 165.00, 'big' => 200.00, 'meal' => 165.00],
        36 => ['price' => 140.00, 'small' => 165.00, 'big' => 200.00, 'meal' => 165.00],
    ];
    
    $starterCount = 0;
    foreach ($starterPrices as $id => $prices) {
        $sql = "UPDATE products SET 
                price = ?, 
                small_price = ?, 
                big_price = ?, 
                meal_price = ?,
                combo_price = 0
                WHERE id = ? AND category = 'Starters'";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $conn->error);
        }
        $stmt->bind_param("ddddi", $prices['price'], $prices['small'], $prices['big'], $prices['meal'], $id);
        if (!$stmt->execute()) {
            throw new Exception("Execute failed: " . $stmt->error);
        }
        $starterCount += $stmt->affected_rows;
        $stmt->close();
    }
    $logs[] = "  ✓ Updated {$starterCount} starter products with variant pricing";
    
    // Step 5: Add new Starter products if they don't exist
    $logs[] = "\n[Step 5] Adding new Starter products...";
    $newStarters = [
        ['name' => 'Spring Rolls', 'price' => 120.00, 'image' => 'spring_rolls.png', 'desc' => 'Crispy fried spring rolls with sweet sauce'],
        ['name' => 'Bruschetta', 'price' => 130.00, 'image' => 'bruschetta.png', 'desc' => 'Toasted bread with tomato and garlic'],
        ['name' => 'Cheese Sticks', 'price' => 100.00, 'image' => 'cheese_sticks.png', 'desc' => 'Melted cheese sticks with dipping sauce'],
        ['name' => 'Buffalo Wings', 'price' => 150.00, 'image' => 'buffalo_wings.png', 'desc' => 'Spicy buffalo chicken wings'],
    ];
    
    $addedCount = 0;
    foreach ($newStarters as $product) {
        // Check if exists
        $checkSql = "SELECT id FROM products WHERE name = ? AND category = 'Starters'";
        $stmt = $conn->prepare($checkSql);
        $stmt->bind_param("s", $product['name']);
        $stmt->execute();
        $result = $stmt->get_result();
        $exists = $result->num_rows > 0;
        $stmt->close();
        
        if (!$exists) {
            $sql = "INSERT INTO products 
                   (name, category, price, stock, image, description, available, slice_price, small_price, big_price, meal_price, combo_price)
                   VALUES (?, 'Starters', ?, 50, ?, ?, 1, ?, ?, ?, 0, 0)";
            $stmt = $conn->prepare($sql);
            if (!$stmt) {
                throw new Exception("Prepare failed: " . $conn->error);
            }
            $smallPrice = $product['price'] + 80;
            $bigPrice = 0.0;
            $stmt->bind_param("sdssddd", $product['name'], $product['price'], $product['image'], $product['desc'], $product['price'], $smallPrice, $bigPrice);
            if (!$stmt->execute()) {
                throw new Exception("Execute failed: " . $stmt->error);
            }
            $addedCount++;
            $stmt->close();
        }
    }
    $logs[] = "  ✓ Added {$addedCount} new starter products";
    
    // Step 6: Verify all products have stock
    $logs[] = "\n[Step 6] Ensuring all products have stock...";
    $sql = "UPDATE products SET stock = 50 WHERE stock = 0 AND available = 1";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $conn->error);
    }
    $stmt->execute();
    $stockCount = $stmt->affected_rows;
    $stmt->close();
    $logs[] = "  ✓ Set stock for {$stockCount} products";
    
    // Step 7: Get statistics
    $logs[] = "\n[Step 7] Final Statistics:";
    $sql = "SELECT category, COUNT(*) as count FROM products WHERE available = 1 GROUP BY category ORDER BY category";
    $result = $conn->query($sql);
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $logs[] = "  • {$row['category']}: {$row['count']} products";
        }
    }
    
    // Sample verification
    $logs[] = "\n[Verification Samples]";
    $logs[] = "\nCakes sample (should have slice, small, big prices):";
    $sql = "SELECT id, name, slice_price, small_price, big_price FROM products WHERE category = 'Cakes' AND available = 1 LIMIT 2";
    $result = $conn->query($sql);
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $logs[] = "  {$row['name']}: Slice={$row['slice_price']}, Small={$row['small_price']}, Big={$row['big_price']}";
        }
    }
    
    $logs[] = "\nMeals sample (should have regular, meal, combo prices):";
    $sql = "SELECT id, name, price, meal_price, combo_price FROM products WHERE category = 'Meals' AND available = 1 LIMIT 2";
    $result = $conn->query($sql);
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $logs[] = "  {$row['name']}: Regular={$row['price']}, Meal={$row['meal_price']}, Combo={$row['combo_price']}";
        }
    }
    
    $logs[] = "\nStarters sample (should have varied prices):";
    $sql = "SELECT id, name, price, small_price FROM products WHERE category = 'Starters' AND available = 1 LIMIT 3";
    $result = $conn->query($sql);
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $logs[] = "  {$row['name']}: Base={$row['price']}, Small={$row['small_price']}";
        }
    }
    
    $logs[] = "\n=== Product Database Fix Completed Successfully! ===";
    
    echo json_encode([
        'success' => true,
        'message' => 'Products database has been fixed successfully',
        'logs' => $logs
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'logs' => $logs ?? []
    ], JSON_PRETTY_PRINT);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
?>
