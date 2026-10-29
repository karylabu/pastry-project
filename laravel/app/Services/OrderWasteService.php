<?php

namespace App\Services;

use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\HttpException;

class OrderWasteService
{
    public function record(int $orderId, ?int $userId, string $reason): array
    {
        return DB::transaction(function () use ($orderId, $userId, $reason) {
            $order = DB::table('orders')->where('id', $orderId)->lockForUpdate()->first(['id', 'total', 'items']);
            if (!$order) {
                throw new HttpException(404, 'Order not found.');
            }

            return $this->createWasteRecord($order, $userId, $reason);
        });
    }

    public function recordUnclaimedIfDue(int $orderId, CarbonInterface $cutoff): bool
    {
        if (!Schema::hasColumn('orders', 'ready_for_pickup_at')) {
            return false;
        }

        return DB::transaction(function () use ($orderId, $cutoff) {
            $order = DB::table('orders')
                ->where('id', $orderId)
                ->lockForUpdate()
                ->first(['id', 'status', 'total', 'items', 'ready_for_pickup_at']);

            if (!$order
                || $order->status !== 'Ready for Pickup'
                || !$order->ready_for_pickup_at
                || $order->ready_for_pickup_at > $cutoff->toDateTimeString()) {
                return false;
            }

            $this->createWasteRecord($order, null, 'Unclaimed after 3 days');

            return true;
        });
    }

    private function createWasteRecord(object $order, ?int $userId, string $reason): array
    {
        if (!Schema::hasTable('waste_log')) {
            throw new HttpException(503, 'Waste tracking is unavailable.');
        }

        $existing = DB::table('waste_log')
            ->where('reference_type', 'order_waste')
            ->where('reference_id', $order->id)
            ->first();
        if ($existing) {
            return ['record' => $existing, 'already_recorded' => true];
        }

        $total = round((float) $order->total, 2);
        $items = $this->orderItems((int) $order->id, $order->items ?? null);
        if ($items === [] || collect($items)->contains(fn (array $item) => $item['unit_cost'] === null)) {
            $items = [[
                'item' => $this->orderItemName((int) $order->id, $order->items ?? null),
                'qty' => 1,
                'unit_cost' => $total,
                'unit' => 'order',
            ]];
        }

        $now = now();
        $wasteIds = [];
        foreach ($items as $index => $item) {
            $wasteIds[] = DB::table('waste_log')->insertGetId([
                'datetime' => $now,
                'item' => $item['item'],
                'qty' => $item['qty'],
                'unit_cost' => round((float) $item['unit_cost'], 2),
                'item_type' => 'Finished Product',
                'reason' => $reason,
                'user_id' => $userId,
                'reference_type' => 'order_waste',
                'reference_id' => $order->id,
                'unit' => $item['unit'],
                'idempotency_key' => "order-waste:{$order->id}:{$index}",
                'created_at' => $now,
            ]);
        }

        return [
            'record' => DB::table('waste_log')->where('id', $wasteIds[0])->first(),
            'already_recorded' => false,
        ];
    }

    private function orderItems(int $orderId, ?string $legacyItems): array
    {
        $items = [];
        if (Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'product')) {
            $columns = ['product'];
            $hasQuantity = Schema::hasColumn('order_items', 'qty');
            $hasPrice = Schema::hasColumn('order_items', 'price');
            if ($hasQuantity) {
                $columns[] = 'qty';
            }
            if ($hasPrice) {
                $columns[] = 'price';
            }

            foreach (DB::table('order_items')->where('order_id', $orderId)->get($columns) as $item) {
                $name = trim((string) ($item->product ?? ''));
                if ($name === '') {
                    continue;
                }
                $items[] = [
                    'item' => $name,
                    'qty' => max(1, (int) ($item->qty ?? 1)),
                    'unit_cost' => $hasPrice && $item->price !== null ? (float) $item->price : null,
                    'unit' => 'pcs',
                ];
            }
        }

        $hasDatabaseItems = $items !== [];
        if ($legacyItems) {
            $decoded = json_decode($legacyItems, true);
            if (is_array($decoded)) {
                foreach ($decoded as $legacyItem) {
                    if (!is_array($legacyItem)) {
                        continue;
                    }
                    $name = trim((string) ($legacyItem['name'] ?? $legacyItem['product'] ?? ''));
                    $price = $legacyItem['price'] ?? $legacyItem['unit_price'] ?? null;
                    if ($name === '' || !is_numeric($price)) {
                        continue;
                    }
                    $match = collect($items)->search(fn (array $item) => $item['item'] === $name && $item['unit_cost'] === null);
                    if ($match !== false) {
                        $items[$match]['unit_cost'] = (float) $price;
                        continue;
                    }
                    if (!$hasDatabaseItems) {
                        $items[] = [
                            'item' => $name,
                            'qty' => max(1, (int) ($legacyItem['qty'] ?? $legacyItem['quantity'] ?? 1)),
                            'unit_cost' => (float) $price,
                            'unit' => 'pcs',
                        ];
                    }
                }
            }
        }

        return $items;
    }

    private function orderItemName(int $orderId, ?string $legacyItems): string
    {
        $names = array_map(fn (array $item) => $item['item'], $this->orderItems($orderId, $legacyItems));
        if ($names === [] && $legacyItems) {
            $items = json_decode($legacyItems, true);
            if (is_array($items)) {
                foreach ($items as $item) {
                    if (!is_array($item)) {
                        continue;
                    }
                    $name = trim((string) ($item['name'] ?? $item['product'] ?? ''));
                    if ($name !== '') {
                        $quantity = max(1, (int) ($item['qty'] ?? $item['quantity'] ?? 1));
                        $names[] = $quantity > 1 ? "{$name} x{$quantity}" : $name;
                    }
                }
            }
        }

        return $names === [] ? "Order #{$orderId}" : implode(', ', $names);
    }
}
