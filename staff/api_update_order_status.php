<?php
ini_set('display_errors', 0);
error_reporting(0);
require_once __DIR__ . '/../includes/api_auth.php';
require_once __DIR__ . '/../includes/inventory.php';
require_once __DIR__ . '/../includes/realtime_events.php';

$authenticatedUser = apiUser();
if (!$authenticatedUser) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authentication required.']);
    exit;
}

if (strtolower(trim((string) ($authenticatedUser['role'] ?? ''))) !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'You are not authorized for this action.']);
    exit;
}

while (ob_get_level()) {
    ob_end_clean();
}

mysqli_report(MYSQLI_REPORT_OFF);

function sendJson(bool $success, string $message, array $extra = []): void {
    $payload = array_merge([
        "success" => $success,
        "message" => $message,
    ], $extra);
    echo json_encode($payload);
    exit();
}

class OrderPreparationException extends RuntimeException {}

function getSessionUserId(): int {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        @session_start();
    }
    return isset($_SESSION['user']['id']) ? intval($_SESSION['user']['id']) : 0;
}

function insertAuditLog(mysqli $conn, int $userId, string $context, string $action, string $entityType, int $entityId, string $note): bool {
    $stmt = $conn->prepare(
        "INSERT INTO audit_log (user_id, context, action, entity_type, entity_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())"
    );
    if (!$stmt) {
        return false;
    }

    $stmt->bind_param('isssis', $userId, $context, $action, $entityType, $entityId, $note);
    $ok = $stmt->execute();
    $stmt->close();
    return $ok;
}

function insertCustomerNotification(mysqli $conn, int $userId, string $title, string $message, string $type, string $actionUrl = ''): bool {
    if (!$conn || !$userId) return false;

    try {
        // SCHEMA NOTE: the notifications table is maintained through
        // versioned migrations; no runtime ALTER TABLE here.
        $tables = $conn->query("SHOW TABLES LIKE 'notifications'");
        if (!$tables || $tables->num_rows === 0) {
            return false;
        }

        $stmt = $conn->prepare("INSERT INTO notifications (user_id, title, message, type, action_url, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())");
        if (!$stmt) {
            return false;
        }

        $stmt->bind_param("issss", $userId, $title, $message, $type, $actionUrl);
        $ok = $stmt->execute();
        $stmt->close();
        return $ok;
    } catch (Throwable $e) {
        error_log('api_update_order_status notification error: ' . $e->getMessage());
        return false;
    }
}

function sendOrderStatusSms(?string $phone, int $orderId, string $status, bool $isCustomCakeOrder = false, ?float $downpaymentAmount = null): array {
    if (empty($phone)) {
        return ['sent' => false, 'error' => 'No phone number found'];
    }

    $phone = preg_replace('/\D/', '', $phone);
    if (substr($phone, 0, 2) === '63') {
        $phone = substr($phone, 2);
    }
    $phone = ltrim($phone, '0');
    if ($phone === '') {
        return ['sent' => false, 'error' => 'Invalid phone number'];
    }
    $phone = '63' . $phone;

    $statusMessage = match ($status) {
        'Pending' => $isCustomCakeOrder
            ? 'has had its downpayment verified and is pending preparation'
            : 'has been received and is awaiting confirmation',
        'Confirmed' => $isCustomCakeOrder
            ? 'your customized cake order has been accepted and is awaiting preparation'
            : 'has been confirmed and is awaiting preparation',
        'Awaiting Payment' => $isCustomCakeOrder
            ? 'is awaiting the required downpayment'
            : 'is awaiting payment',
        'Awaiting Balance Payment' => 'is awaiting the remaining balance payment',
        'Preparing' => 'is now being prepared',
        'Ready for Pickup' => 'is ready for pickup',
        'Completed' => 'has been completed',
        'Cancelled' => 'has been cancelled',
        default => 'status is now ' . $status,
    };
    if ($status === 'Awaiting Payment' && $isCustomCakeOrder) {
        $amountText = $downpaymentAmount !== null ? ' of ₱' . number_format($downpaymentAmount, 2) : '';
        $message = "Pastry Project: Your custom cake order #{$orderId} was accepted. Please send the downpayment{$amountText} and submit your payment proof in your account.";
    } elseif ($status === 'Awaiting Balance Payment' && $isCustomCakeOrder) {
        $amountText = $downpaymentAmount !== null ? ' of ₱' . number_format($downpaymentAmount, 2) : '';
        $message = "Pastry Project: Your custom cake order #{$orderId} is prepared and pickup is pending payment. Please pay the remaining balance{$amountText} and submit your payment proof in your account.";
    } elseif ($status === 'Pending' && $isCustomCakeOrder) {
        $message = "Pastry Project: Your downpayment for custom cake order #{$orderId} was verified. Your order is now pending preparation.";
    } elseif ($status === 'Confirmed' && $isCustomCakeOrder) {
        $message = "Pastry Project: Order #{$orderId}, {$statusMessage}.";
    } elseif ($status === 'Ready for Pickup' && $isCustomCakeOrder) {
        $message = "Pastry Project: Your custom cake order #{$orderId} is ready for pickup.";
    } else {
        $message = "Pastry Project: Your order #{$orderId} {$statusMessage}.";
    }
    $payload = json_encode([
        'api_token' => '3e0c021fc064ea07bb524064e62125caf19f511e',
        'phone_number' => $phone,
        'message' => $message,
    ]);

    $ch = curl_init('https://www.iprogsms.com/api/v1/sms_messages');
    if ($ch === false) {
        return ['sent' => false, 'error' => 'SMS client unavailable'];
    }

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    file_put_contents(
        __DIR__ . '/sms_log.txt',
        date('Y-m-d H:i:s') . " | ORDER:{$orderId} | STATUS:{$status} | PHONE:{$phone} | HTTP:{$httpCode} | RESPONSE:{$response} | ERROR:{$curlError}\n",
        FILE_APPEND
    );

    if ($curlError) {
        return ['sent' => false, 'error' => $curlError];
    }
    if ($httpCode < 200 || $httpCode >= 300) {
        return ['sent' => false, 'error' => $response ?: "SMS request failed with HTTP {$httpCode}"];
    }

    return ['sent' => true, 'error' => null];
}

/* =========================
    DATABASE
 ========================= */
/*
| SCHEMA NOTE: The orders/notifications schemas are maintained exclusively
| through versioned migrations in database/migrations/. This API must never
| run ALTER TABLE / CREATE TABLE statements at request time.
*/
function loadOrderItemsFromJson(string $itemsJson): array {
    $items = json_decode($itemsJson ?: '[]', true);
    if (!is_array($items)) {
        return [];
    }

    $lines = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }

        $qty = max(1, intval($item['qty'] ?? $item['quantity'] ?? 1));
        $productId = intval($item['product_id'] ?? $item['id'] ?? 0);
        $productSizeId = intval($item['product_size_id'] ?? 0);
        $variant = trim((string) ($item['variant'] ?? ''));
        $productName = trim((string) ($item['name'] ?? $item['product'] ?? ''));
        if ($productId === 0 && $productName === '') {
            continue;
        }

        $key = ($productId > 0 ? "pid:{$productId}" : 'name:' . mb_strtolower($productName)) . "|size:{$productSizeId}|variant:" . mb_strtolower($variant);
        if (!isset($lines[$key])) {
            $lines[$key] = [
                'product_id' => $productId,
                'product_size_id' => $productSizeId,
                'variant' => $variant,
                'product_name' => $productName,
                'qty' => 0,
            ];
        }

        $lines[$key]['qty'] += $qty;
    }

    return array_values($lines);
}

function loadLegacyOrderItems(mysqli $conn, int $orderId): array {
    $items = [];
    $orderId = intval($orderId);
    $result = $conn->query("SELECT product_id, product_size_id, variant, product, qty FROM order_items WHERE order_id = {$orderId}");
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $productName = trim((string) ($row['product'] ?? ''));
            $productId = (int) ($row['product_id'] ?? 0);
            $productSizeId = (int) ($row['product_size_id'] ?? 0);
            $variant = trim((string) ($row['variant'] ?? ''));
            $qty = max(1, intval($row['qty'] ?? 1));
            if ($productName === '') {
                continue;
            }

            $key = ($productId > 0 ? "pid:{$productId}" : 'name:' . mb_strtolower($productName)) . "|size:{$productSizeId}|variant:" . mb_strtolower($variant);
            if (!isset($items[$key])) {
                $items[$key] = [
                    'product_id' => $productId,
                    'product_size_id' => $productSizeId,
                    'variant' => $variant,
                    'product_name' => $productName,
                    'qty' => 0,
                ];
            }
            $items[$key]['qty'] += $qty;
        }
        $result->free();
    }

    return array_values($items);
}

function resolveProduct(mysqli $conn, int $productId, string $productName): ?array {
    if ($productId > 0) {
        $stmt = $conn->prepare("SELECT id, name, category, stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE");
        if ($stmt) {
            $stmt->bind_param('i', $productId);
            $stmt->execute();
            $result = $stmt->get_result();
            $product = $result ? $result->fetch_assoc() : null;
            $stmt->close();
            if ($product) {
                return $product;
            }
        }
    }

    if ($productName !== '') {
        $lowerName = mb_strtolower($productName);
        $stmt = $conn->prepare("SELECT id, name, category, stock FROM products WHERE LOWER(name) = ? LIMIT 1 FOR UPDATE");
        if ($stmt) {
            $stmt->bind_param('s', $lowerName);
            $stmt->execute();
            $result = $stmt->get_result();
            $product = $result ? $result->fetch_assoc() : null;
            $stmt->close();
            if ($product) {
                return $product;
            }
        }
    }

    return null;
}

function collectInventoryPlan(mysqli $conn, array $orderLines): array {
    $plan = ['products' => []];

    foreach ($orderLines as $line) {
        $qty = max(1, intval($line['qty'] ?? 0));
        if ($qty <= 0) {
            continue;
        }

        $product = resolveProduct($conn, intval($line['product_id'] ?? 0), trim((string) ($line['product_name'] ?? '')));
        if (!$product) {
            return [
                'success' => false,
                'message' => 'Order contains an unknown product',
            ];
        }

        $productId = intval($product['id']);
        $productName = trim((string) ($product['name'] ?? ''));
        $plan['products'][$productId] = [
            'product_id' => $productId,
            'name' => $productName,
            'qty' => ($plan['products'][$productId]['qty'] ?? 0) + $qty,
        ];
    }

    return [
        'success' => true,
        'plan' => $plan,
    ];
}

function collectOrderIngredientRequirements(mysqli $conn, array $orderLines): array {
        $requirements = [];
        $sizeColumn = $conn->query("SHOW COLUMNS FROM product_recipes LIKE 'product_size_id'");
        $hasRecipeSizes = $sizeColumn && $sizeColumn->num_rows > 0;

        foreach ($orderLines as $line) {
            $product = resolveProduct($conn, (int) ($line['product_id'] ?? 0), trim((string) ($line['product_name'] ?? '')));
            if (!$product) {
                throw new OrderPreparationException('Order contains an unknown product.');
            }

            $productId = (int) $product['id'];
            $productSizeId = (int) ($line['product_size_id'] ?? 0);
            if ($productSizeId <= 0 && trim((string) ($line['variant'] ?? '')) !== '') {
                $sizeStmt = $conn->prepare('SELECT id FROM product_sizes WHERE product_id = ? AND LOWER(size) = LOWER(?) LIMIT 1');
                if (!$sizeStmt) {
                    throw new OrderPreparationException('Unable to resolve the ordered cake size.');
                }
                $variant = trim((string) $line['variant']);
                $sizeStmt->bind_param('is', $productId, $variant);
                $sizeStmt->execute();
                $productSizeId = (int) ($sizeStmt->get_result()->fetch_assoc()['id'] ?? 0);
                $sizeStmt->close();
            }
            $quantity = max(1, (int) ($line['qty'] ?? 1));
            $sql = 'SELECT pr.ingredient_id, pr.qty, i.name, i.unit FROM product_recipes pr INNER JOIN ingredients i ON i.id = pr.ingredient_id WHERE pr.product_id = ? AND pr.active = 1';
            if ($hasRecipeSizes) {
                $sql .= $productSizeId > 0 ? ' AND pr.product_size_id = ?' : ' AND pr.product_size_id IS NULL';
            }
            $stmt = $conn->prepare($sql);
            if (!$stmt) {
                throw new OrderPreparationException('Unable to load product ingredient recipes.');
            }
            if ($hasRecipeSizes && $productSizeId > 0) {
                $stmt->bind_param('ii', $productId, $productSizeId);
            } else {
                $stmt->bind_param('i', $productId);
            }
            if (!$stmt->execute()) {
                $stmt->close();
                throw new OrderPreparationException('Unable to load product ingredient recipes.');
            }
            $result = $stmt->get_result();
            $recipeCount = 0;
            while ($recipe = $result->fetch_assoc()) {
                $recipeCount++;
                $ingredientId = (int) $recipe['ingredient_id'];
                $key = (string) $ingredientId;
                if (!isset($requirements[$key])) {
                    $requirements[$key] = [
                        'ingredient_id' => $ingredientId,
                        'name' => (string) $recipe['name'],
                        'unit' => (string) $recipe['unit'],
                        'quantity' => 0.0,
                    ];
                }
                $requirements[$key]['quantity'] += (float) $recipe['qty'] * $quantity;
            }
            $stmt->close();

            if ($recipeCount === 0 && stripos((string) ($product['category'] ?? ''), 'cake') !== false) {
                throw new OrderPreparationException("No active ingredient recipe is configured for {$product['name']}. Add its recipe before preparing this order.");
            }
        }

        return array_values($requirements);
    }

function collectCustomCakeIngredientRequirements(mysqli $conn, int $orderId): array {
    $tiers = [];
    $customTiersTable = $conn->query("SHOW TABLES LIKE 'customized_cake_tiers'");
    $customizedOrdersTable = $conn->query("SHOW TABLES LIKE 'customized_cake_orders'");

    if ($customTiersTable && $customTiersTable->num_rows > 0 && $customizedOrdersTable && $customizedOrdersTable->num_rows > 0) {
        $stmt = $conn->prepare('SELECT tier.flavor_id, size.multiplier FROM customized_cake_orders AS custom_order INNER JOIN customized_cake_tiers AS tier ON tier.customized_cake_order_id = custom_order.id INNER JOIN cake_sizes AS size ON size.id = tier.size_id WHERE custom_order.order_id = ? ORDER BY tier.tier_number');
        $stmt->bind_param('i', $orderId);
        $stmt->execute();
        $result = $stmt->get_result();
        while ($tier = $result->fetch_assoc()) {
            $tiers[] = ['flavor_id' => (int) $tier['flavor_id'], 'size_multiplier' => (float) $tier['multiplier'], 'quantity' => 1];
        }
        $stmt->close();
    } else {
        $customOrdersTable = $conn->query("SHOW TABLES LIKE 'custom_cake_orders'");
        if (!$customOrdersTable || $customOrdersTable->num_rows === 0) {
            throw new OrderPreparationException('Custom cake recipe details are unavailable.');
        }

        $stmt = $conn->prepare('SELECT flavor, cake_size, quantity FROM custom_cake_orders WHERE order_id = ?');
        $stmt->bind_param('i', $orderId);
        $stmt->execute();
        $result = $stmt->get_result();
        while ($customOrder = $result->fetch_assoc()) {
            $flavorNames = array_values(array_filter(array_map('trim', explode(',', (string) ($customOrder['flavor'] ?? '')))));
            $sizeLabels = array_values(array_filter(array_map('trim', preg_split('/\s*\/\s*/', (string) ($customOrder['cake_size'] ?? '')) ?: [])));
            if (!$flavorNames || !$sizeLabels) {
                throw new OrderPreparationException('Custom cake flavor is missing; ingredients were not deducted.');
            }
            if (count($flavorNames) === 1 && count($sizeLabels) > 1) {
                $flavorNames = array_fill(0, count($sizeLabels), $flavorNames[0]);
            }
            if (count($flavorNames) !== count($sizeLabels)) {
                throw new OrderPreparationException('Custom cake tier flavor and size details do not match.');
            }

            $sizeResult = $conn->query('SELECT code, label, multiplier FROM cake_sizes WHERE active = 1');
            $availableSizes = [];
            if ($sizeResult) {
                while ($size = $sizeResult->fetch_assoc()) {
                    $availableSizes[] = $size;
                }
                $sizeResult->free();
            }

            foreach ($sizeLabels as $index => $sizeLabel) {
                $flavorName = $flavorNames[$index];
                $flavorStmt = $conn->prepare('SELECT id FROM cake_flavors WHERE active = 1 AND LOWER(name) = LOWER(?) LIMIT 1');
                $flavorStmt->bind_param('s', $flavorName);
                $flavorStmt->execute();
                $flavorId = (int) ($flavorStmt->get_result()->fetch_assoc()['id'] ?? 0);
                $flavorStmt->close();
                if ($flavorId <= 0) {
                    throw new OrderPreparationException("No active recipe flavor matches {$flavorName}.");
                }

                $sizeInput = strtolower(preg_replace('/[^a-z0-9]/', '', $sizeLabel));
                $sizeMultiplier = null;
                foreach ($availableSizes as $size) {
                    $code = strtolower(preg_replace('/[^a-z0-9]/', '', (string) $size['code']));
                    $label = strtolower(preg_replace('/[^a-z0-9]/', '', (string) $size['label']));
                    if ($sizeInput === $code || $sizeInput === $label) {
                        $sizeMultiplier = (float) $size['multiplier'];
                        break;
                    }
                }
                if ($sizeMultiplier === null) {
                    throw new OrderPreparationException("No cake size recipe matches {$sizeLabel}.");
                }
                $tiers[] = [
                    'flavor_id' => $flavorId,
                    'size_multiplier' => $sizeMultiplier,
                    'quantity' => max(1, (int) ($customOrder['quantity'] ?? 1)),
                ];
            }
        }
        $stmt->close();
    }

    if (!$tiers) {
        throw new OrderPreparationException('Custom cake recipe details are unavailable.');
    }

    $requirements = [];
    foreach ($tiers as $tier) {
        $recipeStmt = $conn->prepare('SELECT recipe.id, base_size.multiplier AS base_multiplier FROM cake_recipes AS recipe INNER JOIN cake_sizes AS base_size ON base_size.id = recipe.base_size_id WHERE recipe.flavor_id = ? AND recipe.active = 1 ORDER BY recipe.id LIMIT 1');
        $recipeStmt->bind_param('i', $tier['flavor_id']);
        $recipeStmt->execute();
        $baseRecipe = $recipeStmt->get_result()->fetch_assoc();
        $recipeStmt->close();
        if (!$baseRecipe || (float) $baseRecipe['base_multiplier'] <= 0) {
            throw new OrderPreparationException('No active custom cake recipe was found.');
        }
        $recipeId = (int) $baseRecipe['id'];
        $quantityScale = (float) $tier['size_multiplier'] / (float) $baseRecipe['base_multiplier'] * max(1, (int) ($tier['quantity'] ?? 1));
        $stmt = $conn->prepare('SELECT recipe_ingredient.ingredient_id, recipe_ingredient.quantity, recipe_ingredient.unit AS recipe_unit, ingredient.name, ingredient.unit AS inventory_unit FROM cake_recipe_ingredients AS recipe_ingredient INNER JOIN ingredients AS ingredient ON ingredient.id = recipe_ingredient.ingredient_id WHERE recipe_ingredient.recipe_id = ? ORDER BY recipe_ingredient.id');
        $stmt->bind_param('i', $recipeId);
        $stmt->execute();
        $result = $stmt->get_result();
        $lineCount = 0;
        while ($line = $result->fetch_assoc()) {
            $lineCount++;
            $fromUnit = strtolower(trim((string) $line['recipe_unit']));
            $toUnit = strtolower(trim((string) $line['inventory_unit']));
            $conversions = ['kg' => ['g' => 1000], 'g' => ['kg' => 0.001], 'l' => ['ml' => 1000], 'ml' => ['l' => 0.001]];
            if ($fromUnit !== $toUnit && isset($conversions[$fromUnit][$toUnit])) {
                $conversion = $conversions[$fromUnit][$toUnit];
            } elseif ($fromUnit === $toUnit || $fromUnit === '' || $toUnit === '') {
                $conversion = 1;
            } else {
                throw new OrderPreparationException("Recipe unit {$fromUnit} does not match inventory unit {$toUnit} for {$line['name']}.");
            }

            $ingredientId = (int) $line['ingredient_id'];
            $key = (string) $ingredientId;
            if (!isset($requirements[$key])) {
                $requirements[$key] = [
                    'ingredient_id' => $ingredientId,
                    'name' => (string) $line['name'],
                    'unit' => (string) $line['inventory_unit'],
                    'quantity' => 0.0,
                ];
            }
            $requirements[$key]['quantity'] += (float) $line['quantity'] * $conversion * $quantityScale;
        }
        $stmt->close();
        if ($lineCount === 0) {
            throw new OrderPreparationException('No ingredients are configured for a custom cake recipe.');
        }
    }

    return array_values($requirements);
}

function orderIngredientsAlreadyDeducted(mysqli $conn, int $orderId): bool {
    $customConsumptionTable = $conn->query("SHOW TABLES LIKE 'customized_cake_inventory_consumptions'");
    if ($customConsumptionTable && $customConsumptionTable->num_rows > 0) {
        $customStmt = $conn->prepare("SELECT COUNT(*) AS total FROM customized_cake_inventory_consumptions WHERE order_id = ? AND status = 'consumed'");
        $customStmt->bind_param('i', $orderId);
        $customStmt->execute();
        $customAlreadyDeducted = (int) ($customStmt->get_result()->fetch_assoc()['total'] ?? 0) > 0;
        $customStmt->close();
        if ($customAlreadyDeducted) {
            return true;
        }
    }

    $stmt = $conn->prepare("SELECT COUNT(*) AS total FROM ingredient_movements WHERE reference_type = 'order' AND reference_id = ? AND action = 'stock_out'");
    if (!$stmt) {
        throw new OrderPreparationException('Unable to verify previous ingredient deductions.');
    }
    $stmt->bind_param('i', $orderId);
    $stmt->execute();
    $alreadyDeducted = (int) ($stmt->get_result()->fetch_assoc()['total'] ?? 0) > 0;
    $stmt->close();
    return $alreadyDeducted;
}

function insertOrderIngredientMovement(mysqli $conn, int $ingredientId, ?int $batchId, float $quantity, string $note, int $userId, int $orderId, float $previousStock, float $newStock): bool {
    $stmt = $conn->prepare("INSERT INTO ingredient_movements (ingredient_id, batch_id, action, qty, note, user_id, reference_type, reference_id, previous_stock, new_stock) VALUES (?, ?, 'stock_out', ?, ?, ?, 'order', ?, ?, ?)");
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param('iidsiidd', $ingredientId, $batchId, $quantity, $note, $userId, $orderId, $previousStock, $newStock);
    $success = $stmt->execute();
    $stmt->close();
    return $success;
}

function deductOrderIngredients(mysqli $conn, int $orderId, array $requirements, int $userId): void {
        if (!$requirements) {
            return;
        }

        $hasBatchTable = $conn->query("SHOW TABLES LIKE 'ingredient_batches'")->num_rows > 0;
        $hasDiscardTable = $conn->query("SHOW TABLES LIKE 'discard_requests'")->num_rows > 0;
        $usableBatchFilter = 'ingredient_id = ? AND quantity_remaining > 0 AND (expiry_date IS NULL OR expiry_date >= CURDATE())';
        if ($hasDiscardTable) {
            $usableBatchFilter .= " AND NOT EXISTS (SELECT 1 FROM discard_requests dr WHERE dr.ingredient_batch_id = ingredient_batches.id AND dr.status = 'Pending')";
        }

        $plans = [];
        foreach ($requirements as $requirement) {
            $ingredientId = (int) $requirement['ingredient_id'];
            $required = (float) $requirement['quantity'];
            if ($required <= 0) {
                continue;
            }

            $ingredientStmt = $conn->prepare('SELECT id, name, stock FROM ingredients WHERE id = ? LIMIT 1 FOR UPDATE');
            if (!$ingredientStmt) {
                throw new OrderPreparationException('Unable to lock ingredient inventory.');
            }
            $ingredientStmt->bind_param('i', $ingredientId);
            $ingredientStmt->execute();
            $ingredient = $ingredientStmt->get_result()->fetch_assoc();
            $ingredientStmt->close();
            if (!$ingredient) {
                throw new OrderPreparationException("Ingredient {$requirement['name']} no longer exists.");
            }

            $batches = [];
            $hasIngredientBatches = false;
            if ($hasBatchTable) {
                $countStmt = $conn->prepare('SELECT COUNT(*) AS total FROM ingredient_batches WHERE ingredient_id = ?');
                $countStmt->bind_param('i', $ingredientId);
                $countStmt->execute();
                $hasIngredientBatches = (int) ($countStmt->get_result()->fetch_assoc()['total'] ?? 0) > 0;
                $countStmt->close();
            }

            if ($hasIngredientBatches) {
                $batchSql = "SELECT id, quantity_remaining FROM ingredient_batches WHERE {$usableBatchFilter} ORDER BY expiry_date IS NULL, expiry_date, id FOR UPDATE";
                $batchStmt = $conn->prepare($batchSql);
                $batchStmt->bind_param('i', $ingredientId);
                $batchStmt->execute();
                $batchResult = $batchStmt->get_result();
                while ($batch = $batchResult->fetch_assoc()) {
                    $batches[] = ['id' => (int) $batch['id'], 'remaining' => (float) $batch['quantity_remaining']];
                }
                $batchStmt->close();

                $available = array_sum(array_column($batches, 'remaining'));
                if ($available + 0.000001 < $required) {
                    throw new OrderPreparationException("Insufficient usable stock for {$ingredient['name']}. Required: {$required}; available: {$available}.");
                }

                $remaining = $required;
                $allocations = [];
                foreach ($batches as $batch) {
                    if ($remaining <= 0.000001) break;
                    $consumed = min($remaining, $batch['remaining']);
                    $allocations[] = ['batch_id' => $batch['id'], 'quantity' => $consumed];
                    $remaining -= $consumed;
                }
                $plans[] = ['ingredient' => $ingredient, 'required' => $required, 'allocations' => $allocations];
            } else {
                $available = (float) $ingredient['stock'];
                if ($available + 0.000001 < $required) {
                    throw new OrderPreparationException("Insufficient stock for {$ingredient['name']}. Required: {$required}; available: {$available}.");
                }
                $plans[] = ['ingredient' => $ingredient, 'required' => $required, 'allocations' => []];
            }
        }

        foreach ($plans as $plan) {
            $ingredient = $plan['ingredient'];
            $ingredientId = (int) $ingredient['id'];
            $before = (float) $ingredient['stock'];
            if ($plan['allocations']) {
                foreach ($plan['allocations'] as $allocation) {
                    $consumed = (float) $allocation['quantity'];
                    $batchId = (int) $allocation['batch_id'];
                    $updateBatch = $conn->prepare('UPDATE ingredient_batches SET quantity_remaining = quantity_remaining - ?, updated_at = NOW() WHERE id = ? AND quantity_remaining >= ?');
                    $updateBatch->bind_param('did', $consumed, $batchId, $consumed);
                    if (!$updateBatch->execute() || $updateBatch->affected_rows !== 1) {
                        $updateBatch->close();
                        throw new OrderPreparationException("Failed to deduct batch stock for {$ingredient['name']}.");
                    }
                    $updateBatch->close();

                    $stockStmt = $conn->prepare("SELECT COALESCE(SUM(ib.quantity_remaining), 0) AS stock FROM ingredient_batches ib WHERE ib.ingredient_id = ? AND ib.quantity_remaining > 0 AND (ib.expiry_date IS NULL OR ib.expiry_date >= CURDATE())" . ($hasDiscardTable ? " AND NOT EXISTS (SELECT 1 FROM discard_requests dr WHERE dr.ingredient_batch_id = ib.id AND dr.status = 'Pending')" : ''));
                    $stockStmt->bind_param('i', $ingredientId);
                    $stockStmt->execute();
                    $after = (float) ($stockStmt->get_result()->fetch_assoc()['stock'] ?? 0);
                    $stockStmt->close();
                    $syncStmt = $conn->prepare('UPDATE ingredients SET stock = ?, updated_at = NOW() WHERE id = ?');
                    $syncStmt->bind_param('di', $after, $ingredientId);
                    if (!$syncStmt->execute() || !insertOrderIngredientMovement($conn, $ingredientId, $batchId, $consumed, "Order #{$orderId} ingredient consumption", $userId, $orderId, $before, $after)) {
                        $syncStmt->close();
                        throw new OrderPreparationException("Failed to record ingredient consumption for {$ingredient['name']}.");
                    }
                    $syncStmt->close();
                    $before = $after;
                }
            } else {
                $required = (float) $plan['required'];
                $after = $before - $required;
                $updateIngredient = $conn->prepare('UPDATE ingredients SET stock = ?, updated_at = NOW() WHERE id = ? AND stock >= ?');
                $updateIngredient->bind_param('did', $after, $ingredientId, $required);
                if (!$updateIngredient->execute() || $updateIngredient->affected_rows !== 1 || !insertOrderIngredientMovement($conn, $ingredientId, null, $required, "Order #{$orderId} ingredient consumption", $userId, $orderId, $before, $after)) {
                    $updateIngredient->close();
                    throw new OrderPreparationException("Failed to record ingredient consumption for {$ingredient['name']}.");
                }
                $updateIngredient->close();
            }
        }
}

function applyInventoryPlan(mysqli $conn, int $orderId, string $status, array $plan, int $userId): array {
    $note = "Order #{$orderId} inventory deduction on {$status}";

    foreach ($plan['products'] as $productEntry) {
        $productId = intval($productEntry['product_id']);
        $qty = intval($productEntry['qty']);

        $stmt = $conn->prepare("SELECT stock FROM products WHERE id = ? FOR UPDATE");
        if (!$stmt) {
            return ['success' => false, 'message' => 'Failed to prepare product stock update'];
        }
        $stmt->bind_param('i', $productId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $previous = $row ? (float) $row['stock'] : -1;
        if ($previous < $qty) {
            return ['success' => false, 'message' => 'Insufficient product stock'];
        }

        $newStock = $previous - $qty;
        $stmt = $conn->prepare("UPDATE products SET stock = ? WHERE id = ?");
        $stmt->bind_param('di', $newStock, $productId);
        if (!$stmt->execute() || !recordProductMovement($conn, $productId, 'Order', -$qty, $previous, $newStock, $note, 'order', $orderId, $userId)) {
            $stmt->close();
            return ['success' => false, 'message' => 'Failed to record order inventory movement'];
        }
        $stmt->close();
    }

    return ['success' => true];
}

function shouldDeductInventory(string $oldStatus, string $newStatus): bool {
    $newStatus = trim($newStatus);
    $oldStatus = trim($oldStatus);
    return in_array($newStatus, ['Confirmed', 'Preparing'], true) && $oldStatus !== $newStatus;
}

/**
 * Count inventory movements recorded for an order for a given movement type.
 * Used to make deduction idempotent: an order may only be deducted while its
 * stock has NOT already been deducted (or has been restored by cancellation).
 */
function orderMovementCount(mysqli $conn, int $orderId, string $movementType): int {
    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS c FROM product_inventory_movements
         WHERE reference_type = 'order' AND reference_id = ? AND movement_type = ?"
    );
    if (!$stmt) {
        return -1;
    }
    $stmt->bind_param('is', $orderId, $movementType);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ? (int) $row['c'] : -1;
}

function awardLoyaltyPoints(mysqli $conn, int $userId, int $orderId, float $total): void {
    if ($userId <= 0 || $orderId <= 0) {
        return;
    }

    $conn->query("CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        order_id INT NULL,
        type ENUM('earn', 'redeem') NOT NULL,
        points INT NOT NULL,
        discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        reward_code VARCHAR(32) NULL,
        max_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_loyalty_order (order_id),
        INDEX idx_loyalty_user (user_id, created_at)
    ) ENGINE=InnoDB");
    $conn->query("ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0");
    $conn->query("ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS max_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 100");

    $points = (int) floor(max(0, $total) / 100) * 10;
    if ($points <= 0) {
        return;
    }

    $stmt = $conn->prepare("INSERT IGNORE INTO loyalty_transactions (user_id, order_id, type, points) VALUES (?, ?, 'earn', ?)");
    if ($stmt) {
        $stmt->bind_param('iii', $userId, $orderId, $points);
        $stmt->execute();
        $stmt->close();
    }
}

$conn = @new mysqli("localhost", "root", "", "pastry_db");

if ($conn->connect_error) {
    sendJson(false, "DB connect failed");
}

/* =========================
   INPUT
========================= */
$raw = file_get_contents("php://input");
$data = [];

if (!empty($raw)) {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $data = $decoded;
    }
}

if (empty($data) && !empty($_POST)) {
    $data = $_POST;
}

$id = isset($data['id']) ? intval($data['id']) : 0;
$status = isset($data['status']) ? trim($data['status']) : "";
$pickupOutcome = trim((string) ($data['pickup_outcome'] ?? ''));

$allowedStatuses = ['Awaiting Payment', 'Awaiting Balance Payment', 'Pending', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Completed', 'Cancelled'];
if (!$id || !in_array($status, $allowedStatuses, true)) {
    sendJson(false, "Invalid input");
}
if ($pickupOutcome !== '' && !in_array($pickupOutcome, ['picked_up', 'not_picked_up'], true)) {
    sendJson(false, 'Invalid pickup outcome.');
}
if (($pickupOutcome === 'picked_up' && $status !== 'Completed') || ($pickupOutcome === 'not_picked_up' && $status !== 'Ready for Pickup')) {
    sendJson(false, 'Pickup outcome does not match the requested order status.');
}

/* =========================
   UPDATE ORDER
========================= */
try {
    $conn->begin_transaction();
    $orderStmt = $conn->prepare("SELECT status, items, total, downpayment_amount, user_id, email, phone, payment, payment_status, payment_proof_path, delivery_date, pickup_outcome FROM orders WHERE id = ? LIMIT 1 FOR UPDATE");
    if (!$orderStmt) {
        throw new Exception("Order lookup failed");
    }

    $orderStmt->bind_param('i', $id);
    $orderStmt->execute();
    $orderRow = $orderStmt->get_result()->fetch_assoc();
    $orderStmt->close();

    if (!$orderRow) {
        throw new Exception("Order not found");
    }

    $oldStatus = trim((string) ($orderRow['status'] ?? 'Pending'));
    if ($pickupOutcome !== '') {
        if ($oldStatus !== 'Ready for Pickup') {
            throw new Exception('Pickup can only be recorded for an order that is Ready for Pickup.');
        }

        $scheduledDate = trim((string) ($orderRow['delivery_date'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $scheduledDate) || $scheduledDate === '0000-00-00') {
            $customTable = $conn->query("SHOW TABLES LIKE 'custom_cake_orders'");
            if ($customTable && $customTable->num_rows > 0) {
                $scheduleStmt = $conn->prepare('SELECT delivery_date, notes FROM custom_cake_orders WHERE order_id = ? LIMIT 1');
                if ($scheduleStmt) {
                    $scheduleStmt->bind_param('i', $id);
                    $scheduleStmt->execute();
                    $customSchedule = $scheduleStmt->get_result()->fetch_assoc() ?: [];
                    $scheduleStmt->close();
                    $scheduledDate = trim((string) ($customSchedule['delivery_date'] ?? ''));
                    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $scheduledDate) || $scheduledDate === '0000-00-00') {
                        $customDetails = json_decode((string) ($customSchedule['notes'] ?? ''), true);
                        $scheduledDate = is_array($customDetails) ? trim((string) ($customDetails['pickup_date'] ?? '')) : '';
                    }
                }
            }
        }
        if ($scheduledDate !== date('Y-m-d')) {
            throw new Exception('Pickup outcome can only be recorded on the scheduled date.');
        }

        if ($pickupOutcome === 'not_picked_up') {
            $pickupStmt = $conn->prepare("UPDATE orders SET pickup_outcome = 'not_picked_up', pickup_outcome_at = NOW() WHERE id = ?");
            if (!$pickupStmt) {
                throw new Exception('Unable to record pickup outcome.');
            }
            $pickupStmt->bind_param('i', $id);
            if (!$pickupStmt->execute()) {
                $pickupStmt->close();
                throw new Exception('Unable to record pickup outcome.');
            }
            $pickupStmt->close();
            $conn->commit();
            publishRealtimeEvent($conn, 'order.updated', (int) ($orderRow['user_id'] ?? 0), $id);
            $conn->close();
            sendJson(true, 'Order marked as not picked up.', ['id' => $id, 'status' => $oldStatus, 'pickup_outcome' => 'not_picked_up']);
        }
    }

    $isGcashOrder = strtolower(trim((string) ($orderRow['payment'] ?? ''))) === 'gcash';
    $paymentStatus = strtolower(trim((string) ($orderRow['payment_status'] ?? 'pending')));
    if ($isGcashOrder && $status === 'Preparing' && !in_array($paymentStatus, ['paid', 'proof_submitted'], true)) {
        throw new Exception('Verify GCash payment before preparing this order');
    }
    if ($isGcashOrder && $status === 'Preparing' && $paymentStatus === 'proof_submitted' && empty($orderRow['payment_proof_path'])) {
        throw new Exception('Payment proof is missing for this order');
    }
    $itemsJson = $orderRow['items'] ?? '[]';
    $isCustomCakeOrder = false;
    $customOrderSql = "SELECT EXISTS (SELECT 1 FROM custom_cake_orders WHERE order_id = ?)";
    $customOrderTables = $conn->query("SHOW TABLES LIKE 'customized_cake_orders'");
    $hasCustomizedRecipeOrders = $customOrderTables && $customOrderTables->num_rows > 0;
    if ($hasCustomizedRecipeOrders) {
        $customOrderSql .= " OR EXISTS (SELECT 1 FROM customized_cake_orders WHERE order_id = ?)";
    }
    $customOrderCheck = $conn->prepare($customOrderSql . ' AS is_custom_cake');
    if (!$customOrderCheck) {
        throw new Exception('Custom cake order lookup failed');
    }
    if ($hasCustomizedRecipeOrders) {
        $customOrderCheck->bind_param('ii', $id, $id);
    } else {
        $customOrderCheck->bind_param('i', $id);
    }
    if (!$customOrderCheck->execute()) {
        $customOrderCheck->close();
        throw new Exception('Custom cake order lookup failed');
    }
    $customOrderRow = $customOrderCheck->get_result()->fetch_assoc();
    $customOrderCheck->close();
    $isCustomCakeOrder = (int) ($customOrderRow['is_custom_cake'] ?? 0) === 1;
    $storedDownpaymentAmount = (float) ($orderRow['downpayment_amount'] ?? 0);
    if ($isCustomCakeOrder && $storedDownpaymentAmount <= 0 && $conn->query("SHOW TABLES LIKE 'custom_cake_orders'")->num_rows > 0) {
        $quoteStmt = $conn->prepare('SELECT notes FROM custom_cake_orders WHERE order_id = ? LIMIT 1');
        if ($quoteStmt) {
            $quoteStmt->bind_param('i', $id);
            $quoteStmt->execute();
            $quoteNotes = $quoteStmt->get_result()->fetch_assoc()['notes'] ?? '';
            $quoteStmt->close();
            $quoteDetails = json_decode((string) $quoteNotes, true);
            if (is_array($quoteDetails)) {
                $storedDownpaymentAmount = (float) ($quoteDetails['downpayment_amount'] ?? 0);
                if ($storedDownpaymentAmount <= 0 && (float) ($quoteDetails['downpayment_percent'] ?? 0) > 0) {
                    $storedDownpaymentAmount = round((float) $orderRow['total'] * (float) $quoteDetails['downpayment_percent'] / 100, 2);
                }
            }
        }
    }
    $isRequestingDownpayment = $isCustomCakeOrder && $oldStatus === 'Pending' && $status === 'Awaiting Payment';
    $isAcceptingDownpayment = $isCustomCakeOrder && $oldStatus === 'Awaiting Payment' && $status === 'Pending';
    $isRequestingBalancePayment = $isCustomCakeOrder && $oldStatus === 'Preparing' && $status === 'Awaiting Balance Payment';
    $isAcceptingBalancePayment = $isCustomCakeOrder && $oldStatus === 'Awaiting Balance Payment' && $status === 'Ready for Pickup';
    $isReviewingGcashProof = $isGcashOrder && $oldStatus === 'Awaiting Payment' && $status === 'Pending';
    $downpaymentAmount = isset($data['downpayment_amount']) && is_numeric($data['downpayment_amount'])
        ? max(0, (float) $data['downpayment_amount'])
        : null;

    if ($status === 'Awaiting Payment' && !$isRequestingDownpayment) {
        throw new Exception('Only a reviewed custom cake request can move to Awaiting Payment.');
    }
    if ($isRequestingDownpayment && ($downpaymentAmount === null || $downpaymentAmount <= 0 || $downpaymentAmount >= (float) $orderRow['total'])) {
        throw new Exception('A downpayment amount between zero and the order total is required.');
    }
    if ($status === 'Awaiting Balance Payment' && !$isRequestingBalancePayment) {
        throw new Exception('Only a custom cake order in preparation can request its remaining balance.');
    }
    if ($isRequestingBalancePayment && $paymentStatus !== 'paid') {
        throw new Exception('The downpayment must be verified before requesting the remaining balance.');
    }
    if ($isRequestingBalancePayment && ($storedDownpaymentAmount <= 0 || $storedDownpaymentAmount >= (float) $orderRow['total'])) {
        throw new Exception('The accepted downpayment quote is missing or invalid. Update the custom cake quote before requesting its balance.');
    }
    if ($isCustomCakeOrder && $status === 'Ready for Pickup' && !$isAcceptingBalancePayment) {
        throw new Exception('A custom cake must have an approved remaining-balance proof before it is ready for pickup.');
    }
    if ($isAcceptingDownpayment && ($paymentStatus !== 'proof_submitted' || empty($orderRow['payment_proof_path']))) {
        throw new Exception('Verify the submitted downpayment proof before accepting payment.');
    }
    if ($isAcceptingBalancePayment && ($paymentStatus !== 'proof_submitted' || empty($orderRow['payment_proof_path']))) {
        throw new Exception('Verify the submitted remaining-balance proof before marking this order ready for pickup.');
    }
    if ($isReviewingGcashProof && ($paymentStatus !== 'proof_submitted' || empty($orderRow['payment_proof_path']))) {
        throw new Exception('Verify the submitted GCash payment proof before moving this order to Pending.');
    }
    $currentUserId = getSessionUserId();
    $loyaltyUserId = intval($orderRow['user_id'] ?? 0);
    if ($loyaltyUserId <= 0 && !empty($orderRow['email'])) {
        $userStmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        if ($userStmt) {
            $userStmt->bind_param('s', $orderRow['email']);
            $userStmt->execute();
            $userResult = $userStmt->get_result()->fetch_assoc();
            $userStmt->close();
            $loyaltyUserId = intval($userResult['id'] ?? 0);
        }
    }

    if (shouldDeductInventory($oldStatus, $status) && !$isCustomCakeOrder) {
        // Idempotency guard: skip deduction when this order's stock is
        // already deducted (deductions > restorations). Prevents double
        // deduction on status flip-flops like Confirmed -> Pending -> Confirmed.
            $deductedCount = orderMovementCount($conn, $id, 'Order');
            $restoredCount = orderMovementCount($conn, $id, 'Cancellation');
            if ($deductedCount < 0 || $restoredCount < 0) {
                throw new Exception("Failed to verify order inventory state");
            }
            $alreadyDeducted = $deductedCount > 0 && $deductedCount > $restoredCount;

        $orderLines = loadOrderItemsFromJson($itemsJson);
        if (empty($orderLines)) {
            $orderLines = loadLegacyOrderItems($conn, $id);
        }

        $planResult = collectInventoryPlan($conn, $orderLines);
        if (!$planResult['success']) {
            throw new Exception($planResult['message']);
        }

        $plan = $planResult['plan'];
        // Skip the deduction entirely when this order's stock is already
        // deducted (deductions > restorations) - prevents double-deduction.
        $applyResult = $alreadyDeducted
            ? ['success' => true]
            : applyInventoryPlan($conn, $id, $status, $plan, $currentUserId);
        if (!$applyResult['success']) {
            throw new Exception($applyResult['message']);
        }
    }

    if (shouldDeductInventory($oldStatus, $status) && !orderIngredientsAlreadyDeducted($conn, $id)) {
        $ingredientOrderLines = loadOrderItemsFromJson($itemsJson);
        if (!$ingredientOrderLines) {
            $ingredientOrderLines = loadLegacyOrderItems($conn, $id);
        }
        $ingredientRequirements = $isCustomCakeOrder
            ? collectCustomCakeIngredientRequirements($conn, $id)
            : collectOrderIngredientRequirements($conn, $ingredientOrderLines);
        deductOrderIngredients($conn, $id, $ingredientRequirements, $currentUserId);
    }

    if ($status === 'Cancelled' && $oldStatus !== 'Cancelled') {
        $movementStmt = $conn->prepare("SELECT product_id, quantity FROM product_inventory_movements WHERE movement_type = 'Order' AND reference_type = 'order' AND reference_id = ? FOR UPDATE");
        $movementStmt->bind_param('i', $id);
        $movementStmt->execute();
        $movementResult = $movementStmt->get_result();
        while ($movement = $movementResult->fetch_assoc()) {
            $productId = (int) $movement['product_id'];
            $restoreQty = abs((float) $movement['quantity']);
            if ($restoreQty <= 0 || productMovementExists($conn, $productId, 'Cancellation', 'order', $id)) {
                continue;
            }

            $productStmt = $conn->prepare("SELECT stock FROM products WHERE id = ? FOR UPDATE");
            $productStmt->bind_param('i', $productId);
            $productStmt->execute();
            $productRow = $productStmt->get_result()->fetch_assoc();
            $productStmt->close();
            if (!$productRow) {
                $conn->rollback();
                sendJson(false, 'Product not found while restoring cancelled order');
            }

            $previous = (float) $productRow['stock'];
            $newStock = $previous + $restoreQty;
            $productStmt = $conn->prepare("UPDATE products SET stock = ? WHERE id = ?");
            $productStmt->bind_param('di', $newStock, $productId);
            if (!$productStmt->execute() || !recordProductMovement($conn, $productId, 'Cancellation', $restoreQty, $previous, $newStock, "Order #{$id} cancelled", 'order', $id, $currentUserId)) {
                $productStmt->close();
                $conn->rollback();
                sendJson(false, 'Failed to restore cancelled order stock');
            }
            $productStmt->close();
        }
        $movementStmt->close();
    }

    if ($isRequestingDownpayment) {
        $stmt = $conn->prepare("UPDATE orders SET status=?, payment_status='pending', downpayment_amount=? WHERE id=?");
        if ($stmt) $stmt->bind_param('sdi', $status, $downpaymentAmount, $id);
    } elseif ($isRequestingBalancePayment) {
        $stmt = $conn->prepare("UPDATE orders SET status=?, payment_status='pending', downpayment_amount=? WHERE id=?");
        if ($stmt) $stmt->bind_param('sdi', $status, $storedDownpaymentAmount, $id);
    } elseif ($isAcceptingDownpayment || $isAcceptingBalancePayment || $isReviewingGcashProof || ($isGcashOrder && $status === 'Preparing' && $paymentStatus === 'proof_submitted')) {
        $stmt = $conn->prepare("UPDATE orders SET status=?, payment_status='paid' WHERE id=?");
    } else {
        $stmt = $conn->prepare("UPDATE orders SET status=? WHERE id=?");
    }
    if (!$stmt) {
        throw new Exception("Prepare failed");
    }

    if (!$isRequestingDownpayment && !$isRequestingBalancePayment) {
        $stmt->bind_param("si", $status, $id);
    }
    if (!$stmt->execute()) {
        $stmt->close();
        throw new Exception("Update failed");
    }
    $stmt->close();

    if ($pickupOutcome === 'picked_up') {
        $pickupStmt = $conn->prepare("UPDATE orders SET pickup_outcome = 'picked_up', pickup_outcome_at = NOW() WHERE id = ?");
        if (!$pickupStmt) {
            throw new Exception('Unable to record pickup outcome.');
        }
        $pickupStmt->bind_param('i', $id);
        if (!$pickupStmt->execute()) {
            $pickupStmt->close();
            throw new Exception('Unable to record pickup outcome.');
        }
        $pickupStmt->close();
    }

    if ($status === 'Completed' && $oldStatus !== 'Completed') {
        awardLoyaltyPoints($conn, $loyaltyUserId, $id, floatval($orderRow['total'] ?? 0));
    }

    $conn->commit();
    publishRealtimeEvent($conn, 'order.updated', $loyaltyUserId, $id);

    if ($currentUserId > 0) {
        $statusNote = "Order #{$id} status changed from {$oldStatus} to {$status}";
        insertAuditLog($conn, $currentUserId, 'orders', 'status_change', 'order', $id, $statusNote);
    }

    $customNotificationCheck = "EXISTS (SELECT 1 FROM custom_cake_orders WHERE order_id = orders.id)";
    if ($hasCustomizedRecipeOrders) {
        $customNotificationCheck .= " OR EXISTS (SELECT 1 FROM customized_cake_orders WHERE order_id = orders.id)";
    }
    $notifLookup = $conn->prepare("SELECT user_id, email, customer, ({$customNotificationCheck}) AS is_custom_cake FROM orders WHERE id = ?");
    $notifUserId = 0;
    if ($notifLookup) {
        $notifLookup->bind_param("i", $id);
        $notifLookup->execute();
        $notifRow = $notifLookup->get_result()->fetch_assoc();
        $notifLookup->close();

        if ($notifRow) {
            $notifUserId = intval($notifRow['user_id'] ?? 0);
            if ($notifUserId <= 0 && !empty($notifRow['email'])) {
                $userLookup = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
                if ($userLookup) {
                    $userLookup->bind_param("s", $notifRow['email']);
                    $userLookup->execute();
                    $userResult = $userLookup->get_result()->fetch_assoc();
                    $userLookup->close();
                    if ($userResult) {
                        $notifUserId = intval($userResult['id']);
                    }
                }
            }

            if ($notifUserId > 0) {
                $isCustomCake = (int) ($notifRow['is_custom_cake'] ?? 0) === 1;

                if ($isCustomCake) {
                    switch ($status) {
                        case 'Preparing':
                            $notifType = 'Success';
                            $notifTitle = 'Custom cake order being prepared';
                            $notifMessage = 'Your accepted custom cake order is now being prepared.';
                            break;
                        case 'Confirmed':
                            $notifType = 'Success';
                            $notifTitle = 'Custom cake request accepted';
                            $notifMessage = 'Your custom cake request has been accepted and is awaiting preparation.';
                            break;
                        case 'Awaiting Payment':
                            $notifType = 'Info';
                            $notifTitle = 'Custom cake downpayment required';
                            $notifMessage = 'Your custom cake quote is ready. Please submit the downpayment and payment proof.';
                            break;
                        case 'Awaiting Balance Payment':
                            $notifType = 'Info';
                            $notifTitle = 'Custom cake balance due';
                            $notifMessage = 'Your custom cake is prepared. Pay the remaining balance and submit payment proof before pickup.';
                            break;
                        case 'Pending':
                            $notifType = 'Success';
                            $notifTitle = 'Custom cake downpayment verified';
                            $notifMessage = 'Your downpayment was verified. Your custom cake order is pending preparation.';
                            break;
                        case 'Ready for Pickup':
                            $notifType = 'Success';
                            $notifTitle = 'Custom cake ready for pickup';
                            $notifMessage = 'Your remaining-balance payment was verified. Your custom cake is ready for pickup.';
                            break;
                        case 'Completed':
                            $notifType = 'Success';
                            $notifTitle = 'Custom cake order completed';
                            $notifMessage = 'Your custom cake order has been completed.';
                            break;
                        case 'Cancelled':
                            $notifType = 'Warning';
                            $notifTitle = 'Custom cake request declined';
                            $notifMessage = 'Your custom cake request has been declined. Please contact us for details.';
                            break;
                        default:
                            $notifType = 'Info';
                            $notifTitle = 'Custom cake request updated';
                            $notifMessage = "Your custom cake request status is now {$status}.";
                    }
                } else {
                    switch ($status) {
                        case 'Preparing':
                            $notifType = 'Success';
                            $notifTitle = 'Order being prepared';
                            $notifMessage = 'Your order is now being prepared.';
                            break;
                        case 'Confirmed':
                            $notifType = 'Success';
                            $notifTitle = 'Order confirmed';
                            $notifMessage = 'Your order has been confirmed and is awaiting preparation.';
                            break;
                        case 'Ready for Pickup':
                            $notifType = 'Success';
                            $notifTitle = 'Order ready';
                            $notifMessage = 'Your order is ready for pickup or delivery.';
                            break;
                        case 'Completed':
                            $notifType = 'Success';
                            $notifTitle = 'Order completed';
                            $notifMessage = 'Your order has been completed.';
                            break;
                        case 'Cancelled':
                            $notifType = 'Warning';
                            $notifTitle = 'Order cancelled';
                            $notifMessage = 'Your order has been cancelled. Please contact us for details.';
                            break;
                        default:
                            $notifType = 'Info';
                            $notifTitle = 'Order update';
                            $notifMessage = 'Your order status has been updated.';
                    }
                }

                insertCustomerNotification($conn, $notifUserId, $notifTitle, $notifMessage, $notifType, '/customer/orders');
            }
        }
    }

    /* =========================
       SMS LOGIC
    ========================= */
    $notificationPaymentAmount = $isRequestingBalancePayment
        ? max(0, (float) $orderRow['total'] - $storedDownpaymentAmount)
        : $downpaymentAmount;
    $smsResult = $oldStatus !== $status
        ? sendOrderStatusSms($orderRow['phone'] ?? null, $id, $status, $isCustomCakeOrder, $notificationPaymentAmount)
        : ['sent' => false, 'error' => 'Status did not change'];

    $conn->close();
    sendJson(true, "Order updated", [
        "id" => $id,
        "status" => $status,
        "pickup_outcome" => $pickupOutcome !== '' ? $pickupOutcome : ($orderRow['pickup_outcome'] ?? null),
        "sms_sent" => $smsResult['sent'],
        "sms_error" => $smsResult['error']
    ]);
} catch (Throwable $e) {
    if (isset($conn) && $conn) {
        $conn->close();
    }
    error_log('api_update_order_status fatal: ' . $e->getMessage());
    sendJson(false, $e instanceof OrderPreparationException ? $e->getMessage() : "Unexpected server error");
}
?>