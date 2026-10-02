<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CustomerProductCatalog
{
    public function products(bool $availableOnly = true): array
    {
        $query = DB::table('products')->orderBy('category')->orderBy('name');
        if ($availableOnly) {
            $query->where('available', true);
        }

        return $query->get()
            ->map(fn ($product) => $this->formatProduct((array) $product))
            ->all();
    }

    public function bestSellers(): array
    {
        $sales = DB::table('orders')
            ->leftJoin('order_items', 'order_items.order_id', '=', 'orders.id')
            ->whereRaw('LOWER(orders.status) = ?', ['completed'])
            ->select('orders.items', 'order_items.product', 'order_items.qty')
            ->get();

        $salesByProduct = [];
        foreach ($sales as $sale) {
            $savedItems = json_decode((string) ($sale->items ?? ''), true);
            if (is_array($savedItems)) {
                foreach ($savedItems as $savedItem) {
                    $name = strtolower(trim((string) ($savedItem['product'] ?? $savedItem['name'] ?? '')));
                    if ($name !== '') {
                        $salesByProduct[$name] = ($salesByProduct[$name] ?? 0) + max(1, (int) ($savedItem['qty'] ?? 1));
                    }
                }
            }

            $name = strtolower(trim((string) ($sale->product ?? '')));
            if ($name !== '' && !is_array($savedItems)) {
                $salesByProduct[$name] = ($salesByProduct[$name] ?? 0) + max(1, (int) ($sale->qty ?? 1));
            }
        }

        $products = DB::table('products')
            ->where('available', true)
            ->where('stock', '>', 0)
            ->whereRaw("LOWER(category) IN ('cake', 'cakes')")
            ->get()
            ->map(function ($product) use ($salesByProduct) {
                $row = (array) $product;
                $name = strtolower(trim((string) ($row['name'] ?? '')));
                if ($name === '' || !isset($salesByProduct[$name])) {
                    return null;
                }

                $row['total_sold'] = $salesByProduct[$name];
                return $row;
            })
            ->filter()
            ->sort(function (array $left, array $right) {
                return ($right['total_sold'] <=> $left['total_sold'])
                    ?: strcasecmp((string) $left['name'], (string) $right['name']);
            })
            ->take(6)
            ->values();

        return $products->map(function (array $product) {
            $formatted = $this->formatProduct($product);
            if (empty($formatted['sizes'])) {
                $formatted['price'] = max(
                    (float) ($product['price'] ?? 0),
                    (float) ($product['small_price'] ?? 0),
                    (float) ($product['big_price'] ?? 0),
                    (float) ($product['meal_price'] ?? 0),
                    (float) ($product['combo_price'] ?? 0),
                    (float) ($product['solo_price'] ?? 0),
                    (float) ($product['sharing_price'] ?? 0)
                );
                $formatted['sizes'] = [[
                    'id' => 0,
                    'size' => 'Regular',
                    'price' => $formatted['price'],
                    'available' => (int) ($product['available'] ?? 1),
                ]];
            }
            $formatted['total_sold'] = (int) $product['total_sold'];

            return $formatted;
        })->all();
    }

    public function recommendations(int $userId, string $email): array
    {
        $hasUserId = Schema::hasColumn('orders', 'user_id');
        $orders = $this->ownedOrders($userId, $email, $hasUserId);
        if (!$orders->exists()) {
            return ['success' => true, 'has_order' => false, 'items' => []];
        }

        $historyQuery = DB::table('orders as o')
            ->select('o.items')
            ->whereRaw('LOWER(o.status) = ?', ['completed']);
        $this->constrainOwner($historyQuery, $userId, $email, $hasUserId, 'o');
        if (Schema::hasTable('order_items')) {
            $historyQuery->leftJoin('order_items as oi', 'oi.order_id', '=', 'o.id')
                ->addSelect('oi.product');
        }
        $historyRows = $historyQuery
            ->orderByDesc('o.created_at')
            ->orderByDesc('o.id')
            ->get();

        $previousProducts = [];
        foreach ($historyRows as $row) {
            $productName = strtolower(trim((string) ($row->product ?? '')));
            if ($productName !== '') {
                $previousProducts[$productName] = true;
            }

            $savedItems = json_decode((string) ($row->items ?? ''), true);
            if (is_array($savedItems)) {
                foreach ($savedItems as $savedItem) {
                    $savedName = strtolower(trim((string) ($savedItem['product'] ?? $savedItem['name'] ?? '')));
                    if ($savedName !== '') {
                        $previousProducts[$savedName] = true;
                    }
                }
            }
        }

        $popularMap = [];
        $maxPopular = 1;
        if (Schema::hasTable('order_items')) {
            $popularRows = DB::table('order_items')
                ->select('product', DB::raw('SUM(qty) as total_sold'))
                ->groupBy('product')
                ->orderByDesc('total_sold')
                ->limit(20)
                ->get();
            foreach ($popularRows as $row) {
                $name = strtolower(trim((string) ($row->product ?? '')));
                if ($name === '') {
                    continue;
                }
                $count = (float) $row->total_sold;
                $popularMap[$name] = $count;
                $maxPopular = max($maxPopular, $count);
            }
        }

        $coPurchaseMap = [];
        if (Schema::hasTable('order_items')) {
            $latestOrder = $this->ownedOrders($userId, $email, $hasUserId)
                ->whereRaw('LOWER(status) = ?', ['completed'])
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->value('id');
            if ($latestOrder) {
                $latestProducts = DB::table('order_items')
                    ->where('order_id', $latestOrder)
                    ->pluck('product')
                    ->filter()
                    ->unique()
                    ->values()
                    ->all();
                if ($latestProducts) {
                    $coPurchaseRows = DB::table('order_items as selected')
                        ->join('order_items as recommended', 'selected.order_id', '=', 'recommended.order_id')
                        ->whereIn('selected.product', $latestProducts)
                        ->whereColumn('selected.product', '<>', 'recommended.product')
                        ->select('recommended.product', DB::raw('COUNT(*) as co_purchase_count'))
                        ->groupBy('recommended.product')
                        ->orderByDesc('co_purchase_count')
                        ->get();
                    foreach ($coPurchaseRows as $row) {
                        $name = strtolower(trim((string) $row->product));
                        if ($name !== '') {
                            $coPurchaseMap[$name] = (float) $row->co_purchase_count;
                        }
                    }
                }
            }
        }

        $favoriteSet = [];
        if (Schema::hasTable('favorites')) {
            $favoriteSet = array_fill_keys(
                DB::table('favorites')->where('customer_id', $userId)->pluck('product_id')->map(fn ($id) => (string) $id)->all(),
                true
            );
        }

        $eligibleProducts = DB::table('products')
            ->where('available', true)
            ->where('stock', '>', 0)
            ->whereRaw("LOWER(category) IN ('cake', 'cakes')")
            ->orderBy('name')
            ->get()
            ->map(fn ($product) => (array) $product);

        $results = [];
        foreach ($eligibleProducts as $product) {
            $name = strtolower(trim((string) ($product['name'] ?? '')));
            if ($name === '' || !isset($previousProducts[$name])) {
                continue;
            }

            $purchaseScore = isset($previousProducts[$name]) ? 1.0 : 0.0;
            $similarityScore = 0.0;
            foreach (array_keys($previousProducts) as $previousName) {
                similar_text($previousName, $name, $similarity);
                $purchaseScore = max($purchaseScore, (float) $similarity / 100);

                $previousParts = preg_split('/[\s,\-\/]+/', $previousName);
                $currentParts = preg_split('/[\s,\-\/]+/', $name);
                $intersections = array_intersect(array_filter($previousParts), array_filter($currentParts));
                if ($intersections) {
                    $similarityScore = max($similarityScore, min(1, count($intersections) / max(1, count($currentParts))));
                }
            }

            $coPurchaseScore = $coPurchaseMap[$name] ?? 0;
            $normalizedPopularity = ($popularMap[$name] ?? 0) / $maxPopular;
            $recentActivity = isset($favoriteSet[(string) ($product['id'] ?? 0)]) ? 1 : 0;
            $score = 0.35 * $purchaseScore
                + 0.25 * $similarityScore
                + 0.20 * min($coPurchaseScore / 10, 1)
                + 0.15 * $normalizedPopularity
                + 0.05 * $recentActivity;

            $reason = 'Popular and in stock';
            if ($purchaseScore > 0.35) {
                $reason = 'Based on your previous orders';
            } elseif ($coPurchaseScore > 0) {
                $reason = 'Frequently bought with your previous purchases';
            } elseif ($normalizedPopularity > 0.4) {
                $reason = 'One of our most popular pastries';
            } elseif ($recentActivity > 0) {
                $reason = 'You saved this before';
            }

            $formatted = $this->formatProduct($product);
            $formatted['price'] = !empty($formatted['sizes'])
                ? (float) $formatted['sizes'][0]['price']
                : (float) ($product['price'] ?? 0);
            $formatted['score'] = round($score, 4);
            $formatted['reason'] = $reason;
            $results[] = $formatted;
        }

        if (!$results) {
            foreach ($eligibleProducts as $product) {
                $name = strtolower(trim((string) ($product['name'] ?? '')));
                if ($name === '') {
                    continue;
                }
                $formatted = $this->formatProduct($product);
                $formatted['price'] = !empty($formatted['sizes'])
                    ? (float) $formatted['sizes'][0]['price']
                    : (float) ($product['price'] ?? 0);
                $formatted['score'] = round(0.4 + (($popularMap[$name] ?? 0) / $maxPopular * 0.6), 4);
                $formatted['reason'] = 'Popular and in stock';
                $results[] = $formatted;
            }
        }

        usort($results, fn (array $left, array $right) => $right['score'] <=> $left['score']);

        return ['success' => true, 'items' => array_slice($results, 0, 6)];
    }

    private function formatProduct(array $product): array
    {
        $product['price'] = (float) ($product['price'] ?? 0);
        $product['sizes'] = $this->sizeOptions($product);

        return $product;
    }

    private function sizeOptions(array $product): array
    {
        $rows = DB::table('product_sizes')
            ->where('product_id', (int) ($product['id'] ?? 0))
            ->whereRaw("LOWER(size) <> 'slice'")
            ->orderByRaw("CASE LOWER(size) WHEN 'small' THEN 1 WHEN 'big' THEN 2 WHEN 'regular' THEN 3 WHEN 'meal' THEN 4 WHEN 'combo' THEN 5 WHEN 'solo' THEN 6 WHEN 'sharing' THEN 7 ELSE 99 END")
            ->orderBy('id')
            ->get();

        $sizes = [];
        $seenSizes = [];
        foreach ($rows as $row) {
            $size = trim((string) ($row->size ?? ''));
            $key = strtolower($size);
            if ($size === '' || isset($seenSizes[$key])) {
                continue;
            }
            $seenSizes[$key] = true;
            $sizes[] = [
                'id' => (int) $row->id,
                'size' => $size,
                'price' => (float) $row->price,
                'available' => (int) ($row->available ?? 1),
            ];
        }

        if ($sizes) {
            return $sizes;
        }

        $category = strtolower(trim((string) ($product['category'] ?? '')));
        if ($category === 'cakes') {
            $fallbacks = [
                ['size' => 'small', 'price' => $product['small_price'] ?? 0],
                ['size' => 'big', 'price' => $product['big_price'] ?? 0],
            ];
        } elseif (in_array($category, ['meals', 'pasta', 'pizza'], true)) {
            $fallbacks = [
                ['size' => 'regular', 'price' => $product['price'] ?? 0],
                ['size' => 'meal', 'price' => $product['meal_price'] ?? 0],
                ['size' => 'combo', 'price' => $product['combo_price'] ?? 0],
            ];
        } elseif (in_array($category, ['starter', 'starters'], true)) {
            $fallbacks = [
                ['size' => 'solo', 'price' => $product['solo_price'] ?? 0],
                ['size' => 'sharing', 'price' => $product['sharing_price'] ?? 0],
            ];
        } else {
            $fallbacks = [['size' => 'regular', 'price' => $product['price'] ?? 0]];
        }

        $sizes = [];
        foreach ($fallbacks as $fallback) {
            $price = (float) $fallback['price'];
            if ($price <= 0) {
                continue;
            }
            $sizes[] = [
                'id' => 0,
                'size' => $fallback['size'],
                'price' => $price,
                'available' => (int) ($product['available'] ?? 1),
            ];
        }

        return $sizes;
    }

    private function ownedOrders(int $userId, string $email, bool $hasUserId)
    {
        $query = DB::table('orders');
        $this->constrainOwner($query, $userId, $email, $hasUserId);

        return $query;
    }

    private function constrainOwner($query, int $userId, string $email, bool $hasUserId, string $alias = ''): void
    {
        $prefix = $alias === '' ? '' : $alias . '.';
        $query->where(function ($owner) use ($userId, $email, $hasUserId, $prefix) {
            if ($hasUserId) {
                $owner->where($prefix . 'user_id', $userId);
                if ($email !== '') {
                    $owner->orWhereRaw('LOWER(' . $prefix . 'email) = LOWER(?)', [$email]);
                }
            } elseif ($email !== '') {
                $owner->whereRaw('LOWER(' . $prefix . 'email) = LOWER(?)', [$email]);
            } else {
                $owner->whereRaw('1 = 0');
            }
        });
    }
}