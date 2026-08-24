<?php
/**
 * Fix Products Database Script
 * Updates products to have proper categories and pricing for sizes
 * Categories: Cakes, Meals, Starters
 */

require_once __DIR__ . '/../includes/db.php';

if (!$conn) {
    die(json_encode(['success' => false, 'message' => 'Database connection failed']));
}

// Set header for JSON response
header('Content-Type: application/json');

try {
    // Step 1: Update categories - map old categories to new ones
    $categoryUpdates = [
        "Pasta" => "Starters",
        "Pizza" => "Starters",
        "Drinks" => "Starters"
    ];

    foreach ($categoryUpdates as $old => $new) {
        $sql = "UPDATE products SET category = ? WHERE category = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("ss", $new, $old);
        $stmt->execute();
        $stmt->close();
    }

    // Step 2: Add missing starter products if they don't exist
    $starterProducts = [
        ['name' => 'Spring Rolls', 'category' => 'Starters', 'price' => 0.00, 'image' => 'spring_rolls.png', 'description' => 'Crispy fried spring rolls with sweet sauce'],
        ['name' => 'Lumpia', 'category' => 'Starters', 'price' => 0.00, 'image' => 'lumpia.png', 'description' => 'Golden fried lumpia served with sauce'],
        ['name' => 'Cheese Sticks', 'category' => 'Starters', 'price' => 0.00, 'image' => 'cheese_sticks.png', 'description' => 'Melted cheese sticks with dipping sauce'],
        ['name' => 'Bruschetta', 'category' => 'Starters', 'price' => 0.00, 'image' => 'bruschetta.png', 'description' => 'Toasted bread with tomato and garlic'],
        ['name' => 'Buffalo Wings', 'category' => 'Starters', 'price' => 0.00, 'image' => 'buffalo_wings.png', 'description' => 'Spicy buffalo chicken wings']
    ];

    foreach ($starterProducts as $product) {
        // Check if product exists
        $checkSql = "SELECT id FROM products WHERE name = ? AND category = ?";
        $stmt = $conn->prepare($checkSql);
        $stmt->bind_param("ss", $product['name'], $product['category']);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            // Product doesn't exist, insert it
            $insertSql = "INSERT INTO products (name, category, price, stock, image, description, available, slice_price, small_price, big_price, meal_price, combo_price) 
                         VALUES (?, ?, ?, 50, ?, ?, 1, 0, 0, 0, 0, 0)";
            $insertStmt = $conn->prepare($insertSql);
            $insertStmt->bind_param("ssds", $product['name'], $product['category'], $product['price'], $product['image'], $product['description']);
            $insertStmt->execute();
            $insertStmt->close();
        }
        $stmt->close();
    }

    // Step 3: Update pricing for all products to have different sizes
    // For Cakes: slice, small, big prices should all be different (already set in data)
    // For Meals: regular (price), meal_price, combo_price should all be different
    // For Starters: set basic prices and variant prices

    // Update Starters to have proper variant prices
    $startersUpdate = [
        'Spring Rolls' => ['price' => 120.00, 'small_price' => 120.00, 'big_price' => 220.00, 'meal_price' => 120.00, 'combo_price' => 220.00],
        'Lumpia' => ['price' => 140.00, 'small_price' => 140.00, 'big_price' => 250.00, 'meal_price' => 140.00, 'combo_price' => 250.00],
        'Cheese Sticks' => ['price' => 100.00, 'small_price' => 100.00, 'big_price' => 180.00, 'meal_price' => 100.00, 'combo_price' => 180.00],
        'Bruschetta' => ['price' => 130.00, 'small_price' => 130.00, 'big_price' => 230.00, 'meal_price' => 130.00, 'combo_price' => 230.00],
        'Buffalo Wings' => ['price' => 150.00, 'small_price' => 150.00, 'big_price' => 280.00, 'meal_price' => 150.00, 'combo_price' => 280.00]
    ];

    foreach ($startersUpdate as $name => $prices) {
        $updateSql = "UPDATE products SET price = ?, small_price = ?, big_price = ?, meal_price = ?, combo_price = ? WHERE name = ? AND category = 'Starters'";
        $stmt = $conn->prepare($updateSql);
        $stmt->bind_param("ddddds", $prices['price'], $prices['small_price'], $prices['big_price'], $prices['meal_price'], $prices['combo_price'], $name);
        $stmt->execute();
        $stmt->close();
    }

    // Step 4: Verify all Meals have proper variant pricing
    $mealsSQL = "SELECT id, name, price FROM products WHERE category = 'Meals'";
    $result = $conn->query($mealsSQL);
    
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            // Meals should have: regular price (base), meal_price, combo_price
            $basePrice = $row['price'] ? $row['price'] : 199.00;
            $mealPrice = $basePrice; // Meal size = base price
            $comboPrice = $basePrice + 110; // Combo = base + beverage/extra
            
            $mealUpdateSql = "UPDATE products SET meal_price = ?, combo_price = ? WHERE id = ?";
            $stmt = $conn->prepare($mealUpdateSql);
            $stmt->bind_param("ddi", $mealPrice, $comboPrice, $row['id']);
            $stmt->execute();
            $stmt->close();
        }
    }

    // Step 5: Verify all Cakes have proper variant pricing
    $cakesSQL = "SELECT id, name, slice_price, small_price, big_price FROM products WHERE category = 'Cakes'";
    $result = $conn->query($cakesSQL);
    
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            // Verify prices are different
            $slice = $row['slice_price'] ? $row['slice_price'] : 100.00;
            $small = $row['small_price'] ? $row['small_price'] : 450.00;
            $big = $row['big_price'] ? $row['big_price'] : 790.00;
            
            // Make sure they're different
            if ($small <= $slice) $small = $slice + 150;
            if ($big <= $small) $big = $small + 200;
            
            $cakeUpdateSql = "UPDATE products SET slice_price = ?, small_price = ?, big_price = ? WHERE id = ?";
            $stmt = $conn->prepare($cakeUpdateSql);
            $stmt->bind_param("dddi", $slice, $small, $big, $row['id']);
            $stmt->execute();
            $stmt->close();
        }
    }

    // Step 6: Get summary of updated data
    $categoryCounts = [];
    $categorySQL = "SELECT category, COUNT(*) as count FROM products WHERE available = 1 GROUP BY category";
    $result = $conn->query($categorySQL);
    
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $categoryCounts[$row['category']] = $row['count'];
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Products updated successfully',
        'categories' => [
            'Cakes' => $categoryCounts['Cakes'] ?? 0,
            'Meals' => $categoryCounts['Meals'] ?? 0,
            'Starters' => $categoryCounts['Starters'] ?? 0
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
} finally {
    $conn->close();
}
?>
