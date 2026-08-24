<?php

namespace App\Observers;

use App\Models\AdminAlert;
use App\Models\AdminNotification;
use App\Models\Ingredient;

class IngredientObserver
{
    public function updated(Ingredient $ingredient): void
    {
        if (! $ingredient->wasChanged('stock')) {
            return;
        }

        $originalStock = (float) $ingredient->getOriginal('stock');
        $currentStock = (float) $ingredient->stock;
        $threshold = (float) $ingredient->threshold;

        if ($originalStock >= $threshold && $currentStock < $threshold) {
            $message = sprintf(
                'Ingredient "%s" is below threshold: %.3f / %.3f remaining.',
                $ingredient->name,
                $currentStock,
                $threshold
            );

            $attributes = [
                'type' => 'low_stock',
                'title' => 'Low stock alert',
                'message' => $message,
                'data' => [
                    'ingredient_id' => $ingredient->id,
                    'stock' => $currentStock,
                    'threshold' => $threshold,
                ],
                'action_url' => "/admin/inventory/ingredients/{$ingredient->id}",
            ];

            AdminNotification::notifyRoles(['admin', 'staff'], $attributes);
            AdminAlert::notifyRoles(['admin', 'staff'], $attributes);
        }
    }
}
