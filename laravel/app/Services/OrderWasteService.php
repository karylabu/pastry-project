<?php

namespace App\Services;

use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\HttpException;

class OrderWasteService
{
    public function itemNames(array $orderIds): array
    {
        if ($orderIds === []) {
            return [];
        }

        $orders = Schema::hasTable('orders') && Schema::hasColumn('orders', 'items')
            ? DB::table('orders')->whereIn('id', $orderIds)->get(['id', 'items'])->keyBy('id')
            : collect();
        $names = [];
        foreach ($orderIds as $orderId) {
            $order = $orders->get($orderId);
            $name = $this->orderItemName((int) $orderId, $order?->items);
            if ($name !== "Order #{$orderId}") {
                $names[$orderId] = $name;
            }
        }

        return $names;
    }

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
        $itemName = $this->orderItemName((int) $order->id, $order->items ?? null);
        $now = now();
        $wasteId = DB::table('waste_log')->insertGetId([
            'datetime' => $now,
            'item' => $itemName,
            'qty' => 1,
            'unit_cost' => $total,
            'item_type' => 'Finished Product',
            'reason' => $reason,
            'user_id' => $userId,
            'reference_type' => 'order_waste',
            'reference_id' => $order->id,
            'unit' => 'order',
            'idempotency_key' => "order-waste:{$order->id}",
            'created_at' => $now,
        ]);

        return [
            'record' => DB::table('waste_log')->where('id', $wasteId)->first(),
            'already_recorded' => false,
        ];
    }

    private function orderItemName(int $orderId, ?string $legacyItems): string
    {
        $names = [];
        if (Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'product')) {
            $columns = ['product'];
            if (Schema::hasColumn('order_items', 'qty')) {
                $columns[] = 'qty';
            }

            foreach (DB::table('order_items')->where('order_id', $orderId)->get($columns) as $item) {
                $name = trim((string) ($item->product ?? ''));
                if ($name !== '') {
                    $quantity = max(1, (int) ($item->qty ?? 1));
                    $names[] = $quantity > 1 ? "{$name} x{$quantity}" : $name;
                }
            }
        }

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
