<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class CakeSalesAnalytics
{
    public function report(array $filters): array
    {
        [$start, $end] = $this->resolveDates($filters);
        $products = $this->cakeProducts();
        $productsById = $products->keyBy('id');
        $productsByName = $products->keyBy(fn ($product) => $this->nameKey($product->name));
        $sizes = DB::table('product_sizes')->get()->groupBy('product_id');
        $completedOrders = DB::table('orders')
            ->whereRaw('LOWER(status) = ?', ['completed'])
            ->whereBetween('created_at', [$start . ' 00:00:00', $end . ' 23:59:59'])
            ->orderBy('created_at')
            ->get();

        $customRows = DB::table('custom_cake_orders as custom')
            ->join('orders', 'orders.id', '=', 'custom.order_id')
            ->whereRaw('LOWER(orders.status) = ?', ['completed'])
            ->whereBetween('orders.created_at', [$start . ' 00:00:00', $end . ' 23:59:59'])
            ->get();
        $customByOrder = $customRows->keyBy('order_id');

        $orderIds = $completedOrders->pluck('id')->all();
        $normalizedItems = $this->normalizedOrderItems($orderIds);
        $regularSales = [];
        $customSales = [];

        foreach ($completedOrders as $order) {
            if ($customByOrder->has($order->id)) {
                $custom = $customByOrder->get($order->id);
                $quantity = max(1, (int) ($custom->quantity ?? 1));
                $revenue = (float) ($order->subtotal ?? 0) > 0
                    ? (float) $order->subtotal
                    : ((float) $order->total > 0
                        ? (float) $order->total
                        : (float) ($custom->estimated_price ?? 0) * $quantity);
                $customSales[] = [
                    'order_id' => (int) $order->id,
                    'date' => substr((string) $order->created_at, 0, 10),
                    'quantity' => $quantity,
                    'revenue' => $revenue,
                    'flavor' => trim((string) ($custom->flavor ?? 'Unknown')) ?: 'Unknown',
                    'size' => trim((string) ($custom->cake_size ?? 'Unknown')) ?: 'Unknown',
                    'design' => trim((string) ($custom->theme_design ?? 'Unknown')) ?: 'Unknown',
                    'occasion' => trim((string) ($custom->occasion ?? 'Unknown')) ?: 'Unknown',
                ];
                continue;
            }

            foreach ($normalizedItems[$order->id] ?? [] as $item) {
                $product = $this->resolveProduct($item, $productsById, $productsByName);
                if (!$product) continue;
                $quantity = max(0, (float) ($item['qty'] ?? 0));
                if ($quantity <= 0) continue;
                $price = $this->resolveItemPrice($item, $product, $sizes->get($product->id, collect()));
                $size = $this->resolveSize($item, $sizes->get($product->id, collect()));
                $regularSales[] = [
                    'order_id' => (int) $order->id,
                    'date' => substr((string) $order->created_at, 0, 10),
                    'product_id' => (int) $product->id,
                    'product' => $product->name,
                    'category' => $product->category,
                    'size' => $size,
                    'quantity' => $quantity,
                    'price' => $price,
                    'revenue' => $quantity * $price,
                ];
            }
        }

        $flavors = $this->rankRegularProducts($regularSales, $customSales);
        $sizesBySale = $this->rankDimension($regularSales, $customSales, 'size');
        $designs = $this->rankDimension([], $customSales, 'design');
        $cakeTypeBreakdown = $this->regularVsCustomized($regularSales, $customSales);
        $summary = $this->summary($regularSales, $customSales);
        $ingredientAnalytics = $this->ingredientAnalytics($start, $end, $regularSales, $sizes);
        $wasteAnalytics = $this->wasteAnalytics($start, $end);

        return [
            'filters' => ['start_date' => $start, 'end_date' => $end],
            'summary' => $summary,
            'salesTrend' => $this->salesTrend($regularSales, $customSales, $start, $end),
            'flavors' => $flavors,
            'sizes' => $sizesBySale,
            'designs' => $designs,
            'cakeTypeBreakdown' => $cakeTypeBreakdown,
            'topFlavors' => $flavors,
            'topSizes' => $sizesBySale,
            'topDesigns' => $designs,
            'regularVsCustomized' => $cakeTypeBreakdown,
            'customizedAnalytics' => [
                'flavors' => $this->rankCustomDimension($customSales, 'flavor'),
                'sizes' => $this->rankCustomDimension($customSales, 'size'),
                'designs' => $this->rankCustomDimension($customSales, 'design'),
                'occasions' => $this->rankCustomDimension($customSales, 'occasion'),
            ],
            'ingredientAnalytics' => $ingredientAnalytics,
            'inventoryAlerts' => $this->inventoryAlerts(),
            'wasteAnalytics' => $wasteAnalytics,
            'businessInsights' => $this->businessInsights($summary, $flavors, $sizesBySale, $designs, $ingredientAnalytics, $wasteAnalytics),
        ];
    }

    private function cakeProducts()
    {
        return DB::table('products')
            ->whereRaw("LOWER(category) IN ('cake', 'cakes')")
            ->get();
    }

    private function normalizedOrderItems(array $orderIds): array
    {
        if (!$orderIds) return [];
        $rows = DB::table('order_items')->whereIn('order_id', $orderIds)->get()->groupBy('order_id');
        $items = [];
        foreach ($orderIds as $orderId) {
            $stored = $rows->get($orderId, collect());
            if ($stored->isNotEmpty()) {
                $items[$orderId] = $stored->map(fn ($item) => [
                    'product_id' => $item->product_id,
                    'name' => $item->product,
                    'qty' => $item->qty,
                    'price' => $item->price,
                    'variant' => $item->variant,
                    'details' => $item->details,
                ])->all();
                continue;
            }
            $order = DB::table('orders')->where('id', $orderId)->value('items');
            $decoded = json_decode((string) $order, true);
            $items[$orderId] = is_array($decoded) ? $decoded : [];
        }
        return $items;
    }

    private function resolveProduct(array $item, $byId, $byName)
    {
        $productId = (int) ($item['product_id'] ?? $item['id'] ?? 0);
        if ($productId > 0 && $byId->has($productId)) return $byId->get($productId);
        return $byName->get($this->nameKey($item['name'] ?? $item['product'] ?? ''));
    }

    private function resolveItemPrice(array $item, $product, $sizes): float
    {
        $captured = (float) ($item['price'] ?? $item['unit_price'] ?? 0);
        if ($captured > 0) return $captured;
        $variant = strtolower(trim((string) ($item['variant'] ?? '')));
        foreach ($sizes as $size) {
            if ($variant !== '' && strtolower(trim((string) $size->size)) === $variant) return (float) $size->price;
        }
        return 0.0;
    }

    private function resolveSize(array $item, $sizes): string
    {
        $variant = trim((string) ($item['variant'] ?? ''));
        if ($variant !== '') return $variant;
        $details = is_string($item['details'] ?? null) ? json_decode($item['details'], true) : ($item['details'] ?? []);
        return trim((string) ($details['size'] ?? $details['variant'] ?? 'Unknown')) ?: 'Unknown';
    }

    private function summary(array $regular, array $custom): array
    {
        $saleOrderIds = array_unique(array_merge(
            array_column($regular, 'order_id'),
            array_column($custom, 'order_id')
        ));
        $regularQty = array_sum(array_column($regular, 'quantity'));
        $customQty = array_sum(array_column($custom, 'quantity'));
        $regularRevenue = array_sum(array_column($regular, 'revenue'));
        $customRevenue = array_sum(array_column($custom, 'revenue'));
        $totalQty = $regularQty + $customQty;
        $totalRevenue = $regularRevenue + $customRevenue;
        return [
            'total_cake_sales' => count($saleOrderIds),
            'cakes_sold' => $totalQty,
            'cake_revenue' => $totalRevenue,
            'regular_cakes_sold' => $regularQty,
            'customized_cakes_sold' => $customQty,
            'regular_revenue' => $regularRevenue,
            'customized_revenue' => $customRevenue,
            'average_order_value' => count($regular) + count($custom) ? $totalRevenue / (count($regular) + count($custom)) : 0,
        ];
    }

    private function salesTrend(array $regular, array $custom, string $start, string $end): array
    {
        $buckets = ['daily' => [], 'weekly' => [], 'monthly' => []];
        $startDate = new \DateTimeImmutable($start);
        $endDate = new \DateTimeImmutable($end);
        for ($date = $startDate; $date <= $endDate; $date = $date->modify('+1 day')) {
            $key = $date->format('Y-m-d');
            $buckets['daily'][$key] = ['period' => $key, 'quantity' => 0, 'revenue' => 0];
        }
        foreach (array_merge($regular, $custom) as $sale) {
            $date = $sale['date'];
            $week = date('o-\\WW', strtotime($date));
            $month = substr($date, 0, 7);
            foreach ([['daily', $date], ['weekly', $week], ['monthly', $month]] as [$period, $key]) {
                $buckets[$period][$key]['period'] = $key;
                $buckets[$period][$key]['quantity'] = ($buckets[$period][$key]['quantity'] ?? 0) + $sale['quantity'];
                $buckets[$period][$key]['revenue'] = ($buckets[$period][$key]['revenue'] ?? 0) + $sale['revenue'];
            }
        }
        foreach ($buckets as $key => $rows) $buckets[$key] = array_values($rows);
        return $buckets;
    }

    private function rankRegularProducts(array $regular, array $custom): array
    {
        $rows = [];
        foreach ($regular as $sale) {
            $key = $sale['product_id'] . '|' . $sale['product'];
            $rows[$key]['name'] = $sale['product'];
            $rows[$key]['quantity'] = ($rows[$key]['quantity'] ?? 0) + $sale['quantity'];
            $rows[$key]['revenue'] = ($rows[$key]['revenue'] ?? 0) + $sale['revenue'];
        }
        foreach ($custom as $sale) {
            $key = 'custom|' . $sale['flavor'];
            $rows[$key]['name'] = $sale['flavor'];
            $rows[$key]['quantity'] = ($rows[$key]['quantity'] ?? 0) + $sale['quantity'];
            $rows[$key]['revenue'] = ($rows[$key]['revenue'] ?? 0) + $sale['revenue'];
        }
        return $this->rankRows(array_values($rows));
    }

    private function rankDimension(array $regular, array $custom, string $field): array
    {
        $rows = [];
        foreach (array_merge($regular, $custom) as $sale) {
            $value = trim((string) ($sale[$field] ?? 'Unknown')) ?: 'Unknown';
            $rows[$value]['name'] = $value;
            $rows[$value]['quantity'] = ($rows[$value]['quantity'] ?? 0) + $sale['quantity'];
            $rows[$value]['revenue'] = ($rows[$value]['revenue'] ?? 0) + $sale['revenue'];
        }
        return $this->rankRows(array_values($rows));
    }

    private function rankCustomDimension(array $sales, string $field): array
    {
        return $this->rankRows(array_values(array_reduce($sales, function ($carry, $sale) use ($field) {
            $value = trim((string) ($sale[$field] ?? 'Unknown')) ?: 'Unknown';
            $carry[$value]['name'] = $value;
            $carry[$value]['quantity'] = ($carry[$value]['quantity'] ?? 0) + $sale['quantity'];
            $carry[$value]['revenue'] = ($carry[$value]['revenue'] ?? 0) + $sale['revenue'];
            return $carry;
        }, [])));
    }

    private function rankRows(array $rows): array
    {
        usort($rows, fn ($a, $b) => $b['quantity'] <=> $a['quantity']);
        $total = array_sum(array_column($rows, 'quantity')) ?: 1;
        foreach ($rows as $index => &$row) {
            $row['rank'] = $index + 1;
            $row['percentage'] = round(($row['quantity'] / $total) * 100, 2);
        }
        return $rows;
    }

    private function regularVsCustomized(array $regular, array $custom): array
    {
        $rows = [];
        foreach ([['regular', $regular], ['customized', $custom]] as [$type, $sales]) {
            $quantity = array_sum(array_column($sales, 'quantity'));
            $revenue = array_sum(array_column($sales, 'revenue'));
            $rows[$type] = ['quantity' => $quantity, 'revenue' => $revenue, 'average_order_value' => count($sales) ? $revenue / count($sales) : 0];
        }
        $total = $rows['regular']['quantity'] + $rows['customized']['quantity'] ?: 1;
        foreach ($rows as &$row) $row['percentage'] = round(($row['quantity'] / $total) * 100, 2);
        return $rows;
    }

    private function businessInsights(array $summary, array $flavors, array $sizes, array $designs, array $ingredients, array $waste): array
    {
        $insights = [];
        $risk = $ingredients['high_demand_cakes'][0] ?? null;
        $topIngredient = $ingredients['most_used'][0] ?? null;
        $topWaste = $waste['by_item'][0] ?? null;
        $topFlavor = $flavors[0] ?? null;
        $topSize = $sizes[0] ?? null;
        $topDesign = $designs[0] ?? null;

        if ($risk) {
            $insights[] = ['type' => 'high_demand_low_stock', 'priority' => 'high', 'title' => 'Inventory Attention', 'message' => "{$risk['cake']} is highly demanded while {$risk['ingredient']} stock is currently low."];
        }
        if ($topIngredient && (float) ($topIngredient['quantity'] ?? 0) > 0) {
            $message = "{$topIngredient['name']} is the most heavily consumed ingredient during this period.";
            if (($topIngredient['status'] ?? '') === 'low') $message .= " Current stock is low relative to estimated usage.";
            $insights[] = ['type' => 'ingredient_demand', 'priority' => 'high', 'title' => 'Ingredient Demand', 'message' => $message];
        }
        if ($topWaste && (float) ($topWaste['quantity'] ?? 0) > 0) {
            $insights[] = ['type' => 'waste_risk', 'priority' => 'medium', 'title' => 'Waste Attention', 'message' => "{$topWaste['name']} has the highest recorded waste during this period."];
        }
        if ($topFlavor && (float) ($topFlavor['quantity'] ?? 0) > 0) {
            $insights[] = ['type' => 'top_seller', 'priority' => 'medium', 'title' => 'Top Seller', 'message' => "{$topFlavor['name']} is the top-selling cake or flavor with {$topFlavor['quantity']} cakes sold."];
        }
        if ($topSize && (float) ($topSize['quantity'] ?? 0) > 0) {
            $insights[] = ['type' => 'popular_size', 'priority' => 'low', 'title' => 'Popular Size', 'message' => "{$topSize['name']} is the most popular cake size, representing {$topSize['percentage']}% of cake units sold."];
        }
        if ($topDesign && (float) ($topDesign['quantity'] ?? 0) > 0) {
            $insights[] = ['type' => 'customized_demand', 'priority' => 'low', 'title' => 'Customization Trend', 'message' => "{$topDesign['name']} is the most requested customization option."];
        }
        if (!$insights && (int) ($summary['cakes_sold'] ?? 0) === 0) {
            return [['type' => 'limited_data', 'priority' => 'low', 'title' => 'Business Insights', 'message' => 'Not enough data to generate business insights yet.']];
        }
        return array_slice($insights, 0, 6);
    }

    private function ingredientAnalytics(string $start, string $end, array $regularSales, $sizes): array
    {
        $actualConsumption = DB::table('ingredient_movements as movement')
            ->join('ingredients as ingredient', 'ingredient.id', '=', 'movement.ingredient_id')
            ->where('movement.action', 'stock_out')
            ->where('movement.reference_type', 'production')
            ->whereBetween('movement.created_at', [$start . ' 00:00:00', $end . ' 23:59:59'])
            ->select('ingredient.id', 'ingredient.name', 'ingredient.unit', 'ingredient.stock', 'ingredient.threshold', DB::raw('SUM(movement.qty) as quantity'))
            ->groupBy('ingredient.id', 'ingredient.name', 'ingredient.unit', 'ingredient.stock', 'ingredient.threshold')
            ->orderByDesc('quantity')->get();
        $ingredients = DB::table('ingredients')->orderBy('name')->get();
        $lowStock = $ingredients->filter(fn ($ingredient) => (float) $ingredient->stock <= (float) $ingredient->threshold)->sortBy('stock')->values();
        $lowStockIds = $lowStock->pluck('id')->map(fn ($id) => (int) $id)->all();
        $recipeQuery = DB::table('product_recipes as recipe')
            ->join('ingredients as ingredient', 'ingredient.id', '=', 'recipe.ingredient_id')
            ->join('products as product', 'product.id', '=', 'recipe.product_id')
            ->whereRaw("LOWER(product.category) IN ('cake', 'cakes')")
            ->where('recipe.active', true);
        if (Schema::hasColumn('product_recipes', 'product_size_id')) {
            $recipeQuery->leftJoin('product_sizes as size', 'size.id', '=', 'recipe.product_size_id')
                ->addSelect('recipe.product_size_id', 'size.size');
        }
        $recipes = $recipeQuery->addSelect('recipe.product_id', 'recipe.ingredient_id', 'recipe.qty', 'product.name as product_name', 'ingredient.name as ingredient_name', 'ingredient.unit')->get();
        $recipesByProduct = $recipes->groupBy('product_id');
        $estimated = [];
        $demand = [];
        foreach ($regularSales as $sale) {
            $productRecipes = $recipesByProduct->get($sale['product_id'], collect());
            $sizeRecipes = $productRecipes->filter(fn ($recipe) => isset($recipe->product_size_id) && $recipe->product_size_id !== null);
            $matchingRecipes = $sizeRecipes->isNotEmpty()
                ? $sizeRecipes->filter(fn ($recipe) => strcasecmp((string) $recipe->size, (string) $sale['size']) === 0)
                : $productRecipes->filter(fn ($recipe) => !isset($recipe->product_size_id) || $recipe->product_size_id === null);
            foreach ($matchingRecipes as $recipe) {
                $usage = (float) $recipe->qty * (float) $sale['quantity'];
                $key = (int) $recipe->ingredient_id;
                $estimated[$key]['id'] = $key;
                $estimated[$key]['name'] = $recipe->ingredient_name;
                $estimated[$key]['unit'] = $recipe->unit;
                $estimated[$key]['quantity'] = ($estimated[$key]['quantity'] ?? 0) + $usage;
                if (in_array((int) $recipe->ingredient_id, $lowStockIds, true)) {
                    $key = $sale['product_id'] . '|' . $recipe->ingredient_id;
                    $demand[$key]['cake'] = $sale['product'];
                    $demand[$key]['ingredient'] = $recipe->ingredient_name;
                    $demand[$key]['unit'] = $recipe->unit;
                    $demand[$key]['estimated_quantity'] = ($demand[$key]['estimated_quantity'] ?? 0) + $usage;
                }
            }
        }
        $estimatedTotal = array_sum(array_column($estimated, 'quantity')) ?: 1;
        $days = max(1, (int) ((new \DateTimeImmutable($start))->diff(new \DateTimeImmutable($end))->days + 1));
        foreach ($estimated as $id => &$row) {
            $ingredient = $ingredients->firstWhere('id', $id);
            $row['percentage'] = round(($row['quantity'] / $estimatedTotal) * 100, 2);
            $row['current_stock'] = $ingredient ? (float) $ingredient->stock : 0;
            $row['threshold'] = $ingredient ? (float) $ingredient->threshold : 0;
            $row['estimated_daily_usage'] = $row['quantity'] / $days;
            $row['estimated_days_remaining'] = $row['estimated_daily_usage'] > 0 ? round($row['current_stock'] / $row['estimated_daily_usage'], 1) : null;
            $row['status'] = $row['current_stock'] <= $row['threshold'] ? 'low' : 'normal';
        }
        unset($row);
        usort($estimated, fn ($a, $b) => $b['quantity'] <=> $a['quantity']);
        usort($demand, fn ($a, $b) => $b['estimated_quantity'] <=> $a['estimated_quantity']);
        return [
            'most_used' => array_values($estimated),
            'consumption' => array_values($estimated),
            'actual_consumption' => $actualConsumption,
            'stock' => $ingredients,
            'low_stock' => $lowStock,
            'high_demand_cakes' => array_values($demand),
            'customized_note' => 'Customized cake ingredient usage is omitted when no reliable recipe relationship exists.',
        ];
    }

    private function inventoryAlerts(): array
    {
        return ['low_stock_ingredients' => DB::table('ingredients')->whereColumn('stock', '<=', 'threshold')->orderBy('stock')->get()];
    }

    private function wasteAnalytics(string $start, string $end): array
    {
        $rows = DB::table('waste_log as waste')
            ->leftJoin('ingredients as ingredient', 'ingredient.id', '=', 'waste.ingredient_id')
            ->leftJoin('products as product', 'product.id', '=', 'waste.product_id')
            ->whereBetween('waste.datetime', [$start . ' 00:00:00', $end . ' 23:59:59'])
            ->where('waste.qty', '>', 0)
            ->select('waste.*', 'ingredient.name as ingredient_name', 'ingredient.unit as ingredient_unit', 'ingredient.stock as ingredient_stock', 'ingredient.threshold as ingredient_threshold', 'product.name as product_name')
            ->get();
        $byItem = $rows->groupBy(fn ($row) => ($row->ingredient_id ?: 'item') . '|' . ($row->ingredient_unit ?: 'unit'))
            ->map(function ($group) {
                $first = $group->first();
                return [
                    'name' => $first->ingredient_name ?: $first->item,
                    'quantity' => $group->sum('qty'),
                    'unit' => $first->ingredient_unit ?: ($first->unit ?: 'unit'),
                    'cost' => $group->sum(fn ($row) => (float) $row->qty * (float) $row->unit_cost),
                ];
            })->sortByDesc('quantity')->values();
        $totalByUnit = $byItem->groupBy('unit')->map(fn ($group, $unit) => ['unit' => $unit, 'quantity' => $group->sum('quantity')])->values();
        $byItemTotals = $byItem->groupBy('unit')->map(fn ($group) => $group->sum('quantity'));
        $byItem = $byItem->map(function ($item) use ($byItemTotals) {
            $unitTotal = (float) ($byItemTotals[$item['unit']] ?? 0);
            $item['percentage'] = $unitTotal > 0 ? round(($item['quantity'] / $unitTotal) * 100, 2) : 0;
            return $item;
        })->values();
        $byDate = $rows->groupBy(fn ($row) => substr((string) $row->datetime, 0, 10))->map(fn ($group, $date) => ['date' => $date, 'quantity' => $group->sum('qty'), 'cost' => $group->sum(fn ($row) => (float) $row->qty * (float) $row->unit_cost)])->all();
        $trend = [];
        for ($date = new \DateTimeImmutable($start); $date <= new \DateTimeImmutable($end); $date = $date->modify('+1 day')) {
            $key = $date->format('Y-m-d');
            $trend[] = $byDate[$key] ?? ['date' => $key, 'quantity' => 0, 'cost' => 0];
        }
        $highWasteLowStock = $byItem->filter(function ($item) use ($rows) {
            $row = $rows->first(fn ($waste) => (($waste->ingredient_name ?: $waste->item) === $item['name']));
            return $row && $row->ingredient_id && (float) $row->ingredient_stock <= (float) $row->ingredient_threshold;
        })->map(function ($item) use ($rows) {
            $row = $rows->first(fn ($waste) => (($waste->ingredient_name ?: $waste->item) === $item['name']));
            $item['current_stock'] = (float) $row->ingredient_stock;
            $item['threshold'] = (float) $row->ingredient_threshold;
            $item['status'] = 'high_waste_low_stock';
            return $item;
        })->values();
        $associations = $rows->filter(fn ($row) => $row->product_id && $row->product_name)->map(fn ($row) => ['product' => $row->product_name, 'ingredient' => $row->ingredient_name ?: $row->item, 'quantity' => (float) $row->qty, 'reason' => $row->reason])->values();
        $wasteValue = $rows->sum(fn ($row) => (float) $row->qty * (float) $row->unit_cost);
        return [
            'quantity' => $rows->sum('qty'),
            'cost' => $wasteValue,
            'total_by_unit' => $totalByUnit,
            'waste_value' => $wasteValue,
            'records' => $rows->count(),
            'by_reason' => $rows->groupBy('reason')->map(fn ($group, $reason) => ['reason' => $reason, 'quantity' => $group->sum('qty'), 'cost' => $group->sum(fn ($row) => (float) $row->qty * (float) $row->unit_cost)])->values(),
            'by_item' => $byItem,
            'trend' => $trend,
            'high_waste_low_stock' => $highWasteLowStock,
            'product_associations' => $associations,
        ];
    }

    private function resolveDates(array $filters): array
    {
        $today = now()->startOfDay();
        $preset = (string) ($filters['preset'] ?? '');
        if ($preset === 'today') [$start, $end] = [$today, $today];
        elseif ($preset === 'yesterday') [$start, $end] = [$today->copy()->subDay(), $today->copy()->subDay()];
        elseif ($preset === 'last_7_days') [$start, $end] = [$today->copy()->subDays(6), $today];
        elseif ($preset === 'last_30_days') [$start, $end] = [$today->copy()->subDays(29), $today];
        elseif ($preset === 'this_week') [$start, $end] = [$today->copy()->startOfWeek(), $today];
        elseif ($preset === 'this_month') [$start, $end] = [$today->copy()->startOfMonth(), $today];
        elseif ($preset === 'this_year') [$start, $end] = [$today->copy()->startOfYear(), $today];
        else [$start, $end] = [$filters['start_date'] ?? $today->copy()->subDays(29), $filters['end_date'] ?? $today];
        $start = $start instanceof \DateTimeInterface ? $start->format('Y-m-d') : (string) $start;
        $end = $end instanceof \DateTimeInterface ? $end->format('Y-m-d') : (string) $end;
        if (!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $start) || !preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $end) || $start > $end) throw new RuntimeException('Invalid analytics date range.');
        return [$start, $end];
    }

    private function nameKey($name): string
    {
        return strtolower(trim(preg_replace('/\\s+/', ' ', (string) $name)));
    }
}
