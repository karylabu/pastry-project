<?php
/**
 * Ensure variant prices for all products
 * - Cakes: slice_price, small_price, big_price (distinct)
 * - Meals: meal_price, combo_price
 * - Starters: small_price, big_price
 */

require_once __DIR__ . '/../includes/db.php';
header('Content-Type: application/json');

if (!$conn) {
    echo json_encode(['success' => false, 'message' => 'DB connection failed']);
    exit;
}

$logs = [];
try {
    $products = $conn->query("SELECT * FROM products WHERE available = 1");
    if (!$products) throw new Exception($conn->error);

    $updated = 0;

    while ($p = $products->fetch_assoc()) {
        $id = (int)$p['id'];
        $cat = strtolower($p['category'] ?? '');
        $base = (float)$p['price'];
        // If base price is zero, try to infer from slice/small/big if present
        if ($base <= 0) {
            $base = (float)($p['small_price'] ?? 0) ?: (float)($p['slice_price'] ?? 0) ?: (float)($p['big_price'] ?? 0);
            if ($base <= 0) $base = 100.0; // fallback
        }

        $slice = (float)($p['slice_price'] ?? 0);
        $small = (float)($p['small_price'] ?? 0);
        $big   = (float)($p['big_price'] ?? 0);
        $meal  = (float)($p['meal_price'] ?? 0);
        $combo = (float)($p['combo_price'] ?? 0);

        $needsUpdate = false;
        // Cakes
        if ($cat === 'cakes') {
            if ($slice <= 0) {
                $slice = round(max(1, $base * 0.25), 2);
                $needsUpdate = true;
            }
            if ($small <= 0) {
                $small = round(max($slice + 50, $base * 1.2), 2);
                $needsUpdate = true;
            }
            if ($big <= 0) {
                $big = round(max($small + 150, $base * 2.0), 2);
                $needsUpdate = true;
            }
            // ensure strictly increasing
            if (!($small > $slice)) { $small = round($slice + 50,2); $needsUpdate = true; }
            if (!($big > $small)) { $big = round($small + 150,2); $needsUpdate = true; }

            if ($needsUpdate) {
                $stmt = $conn->prepare("UPDATE products SET slice_price = ?, small_price = ?, big_price = ? WHERE id = ?");
                $stmt->bind_param('dddi', $slice, $small, $big, $id);
                $stmt->execute();
                $stmt->close();
                $logs[] = "Updated cakes id={$id} ({$p['name']}) slice={$slice} small={$small} big={$big}";
                $updated++;
            }

        } elseif ($cat === 'meals') {
            if ($meal <= 0) { $meal = round(max($base + 20, $base * 1.1),2); $needsUpdate = true; }
            if ($combo <= 0) { $combo = round(max($base + 110, $meal + 80),2); $needsUpdate = true; }
            if (!($meal > $base)) { $meal = round($base + 20,2); $needsUpdate = true; }
            if (!($combo > $meal)) { $combo = round($meal + 80,2); $needsUpdate = true; }

            if ($needsUpdate) {
                $stmt = $conn->prepare("UPDATE products SET meal_price = ?, combo_price = ? WHERE id = ?");
                $stmt->bind_param('ddi', $meal, $combo, $id);
                $stmt->execute();
                $stmt->close();
                $logs[] = "Updated meals id={$id} ({$p['name']}) regular={$base} meal={$meal} combo={$combo}";
                $updated++;
            }

        } else {
            // Starters + others: set small and big if missing, ensure difference
            if ($small <= 0) { $small = round(max( ( $base * 1.15 ), $base + 20 ), 2); $needsUpdate = true; }
            if ($big <= 0) { $big = round(max($small + 50, $base * 1.6),2); $needsUpdate = true; }
            if (!($small > $base)) { $small = round($base + 20,2); $needsUpdate = true; }
            if (!($big > $small)) { $big = round($small + 50,2); $needsUpdate = true; }

            if ($needsUpdate) {
                $stmt = $conn->prepare("UPDATE products SET small_price = ?, big_price = ? WHERE id = ?");
                $stmt->bind_param('ddi', $small, $big, $id);
                $stmt->execute();
                $stmt->close();
                $logs[] = "Updated product id={$id} ({$p['name']}) base={$base} small={$small} big={$big}";
                $updated++;
            }
        }
    }

    echo json_encode(['success'=>true,'updated'=>$updated,'logs'=>$logs], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    echo json_encode(['success'=>false,'message'=>$e->getMessage(),'logs'=>$logs], JSON_PRETTY_PRINT);
}

$conn->close();
