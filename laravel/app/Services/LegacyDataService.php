<?php

namespace App\Services;

class LegacyDataService
{
    public function __construct()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        // Ensure legacy helpers are available
        $data = base_path('../includes/data.php');
        if (file_exists($data)) {
            require_once $data;
        }
    }

    public function getProducts(): array
    {
        $db = getDB();
        return $db['products'] ?? [];
    }

    public function getOrdersForEmail(string $email): array
    {
        $orders = getDB()['orders'] ?? [];
        return array_values(array_filter($orders, fn($o) => ($o['email'] ?? '') === $email));
    }

    public function placeOrder(array $data)
    {
        return db_place_order($data);
    }

    public function getCartItems(): array
    {
        return get_cart_items();
    }

    public function addToCart(int $productId, string $size = 'slice', int $quantity = 1): bool
    {
        return add_to_cart($productId, $size, $quantity);
    }

    public function getNotifications($userId): array
    {
        return db_get_notifications($userId);
    }
}
