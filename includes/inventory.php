<?php

function inventoryUserId(): int
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        @session_start();
    }
    return isset($_SESSION['user']['id']) ? (int) $_SESSION['user']['id'] : 0;
}

function recordProductMovement(mysqli $conn, int $productId, string $type, float $quantity, float $previous, float $newStock, string $reason, ?string $referenceType, ?int $referenceId, int $userId, ?int $productVariantId = null): bool
{
    $stmt = $conn->prepare("INSERT INTO product_inventory_movements (product_id, product_variant_id, movement_type, quantity, previous_stock, new_stock, reason, reference_type, reference_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    if (!$stmt) return false;
    $stmt->bind_param('iisdddssii', $productId, $productVariantId, $type, $quantity, $previous, $newStock, $reason, $referenceType, $referenceId, $userId);
    $ok = $stmt->execute();
    $stmt->close();
    return $ok;
}

function productMovementExists(mysqli $conn, int $productId, string $type, string $referenceType, int $referenceId, ?int $productVariantId = null): bool
{
    $stmt = $conn->prepare("SELECT id FROM product_inventory_movements WHERE product_id = ? AND product_variant_id <=> ? AND movement_type = ? AND reference_type = ? AND reference_id = ? LIMIT 1");
    if (!$stmt) return false;
    $stmt->bind_param('iissi', $productId, $productVariantId, $type, $referenceType, $referenceId);
    $stmt->execute();
    $found = $stmt->get_result()->num_rows > 0;
    $stmt->close();
    return $found;
}

function insertIngredientMovement(mysqli $conn, int $ingredientId, string $action, float $quantity, string $note, int $userId, ?string $referenceType = null, ?int $referenceId = null): bool
{
    $stmt = $conn->prepare("INSERT INTO ingredient_movements (ingredient_id, action, qty, note, user_id, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
    if (!$stmt) return false;
    $stmt->bind_param('isdsisi', $ingredientId, $action, $quantity, $note, $userId, $referenceType, $referenceId);
    $ok = $stmt->execute();
    $stmt->close();
    return $ok;
}
