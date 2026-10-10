<?php

namespace App\Http\Controllers;

use App\Services\InventoryService;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class StaffApiController extends Controller
{
    public function __construct()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    protected function corsResponse(array $payload, int $status = 200)
    {
        $origin = request()->header('Origin');
        $response = response()->json($payload, $status)
            ->header('Access-Control-Allow-Credentials', 'true')
            ->header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            ->header('Vary', 'Origin');
        if ($origin) {
            $response->header('Access-Control-Allow-Origin', $origin);
        }
        return $response;
    }

    protected function parseJson(Request $request): array
    {
        $data = $request->json()->all();
        if (empty($data)) {
            $data = json_decode($request->getContent(), true) ?? [];
        }
        return is_array($data) ? $data : [];
    }

    public function login(Request $request)
    {
        if ($request->isMethod('options')) {
            return $this->corsResponse(['success' => true]);
        }

        $data = $this->parseJson($request);
        $email = trim($data['email'] ?? $request->input('email', ''));
        $password = trim($data['password'] ?? $request->input('password', ''));

        if (!$email || !$password) {
            return $this->corsResponse(['success' => false, 'message' => 'Please provide both email and password.'], 400);
        }

        $user = DB::table('users')->where('email', $email)->first();
        if (!$user) {
            return $this->corsResponse(['success' => false, 'message' => 'User account not found.'], 401);
        }

        $role = strtolower((string) ($user->role ?? ''));
        if ($role !== 'admin') {
            return $this->corsResponse(['success' => false, 'message' => 'Admin access required.'], 403);
        }
        if (strtolower(trim((string) ($user->status ?? 'active'))) !== 'active') {
            return $this->corsResponse(['success' => false, 'message' => 'This account is deactivated.'], 403);
        }

        $passwordValid = Hash::check($password, $user->password);

        if (!$passwordValid) {
            return $this->corsResponse(['success' => false, 'message' => 'Incorrect password.'], 401);
        }

        $token = bin2hex(random_bytes(32));
        DB::table('user_sessions')->updateOrInsert(
            ['user_id' => $user->id],
            [
                'token' => $token,
                'created_at' => now(),
                'expires_at' => now()->addDays(30),
            ]
        );

        return $this->corsResponse([
            'success' => true,
            'message' => 'Login successful',
            'user' => [
                'id' => (string)$user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $role,
            ],
            'token' => $token,
        ]);
    }

    public function getProducts(Request $request)
    {
        if ($request->isMethod('options')) {
            return $this->corsResponse(['success' => true]);
        }

        $admin = $this->requireRole($request, 'admin');
        if (!$admin instanceof User) {
            return $admin;
        }

        if ($request->query('action') === 'update' && $request->isMethod('post')) {
            try {
                $data = $this->parseJson($request);
                $productId = $data['id'] ?? null;
                $variantId = $data['product_variant_id'] ?? null;
                $available = $data['available'] ?? 1;

                if ($variantId) {
                    DB::table('product_sizes')->where('id', $variantId)->update(['available' => $available]);
                } else if ($productId) {
                    DB::table('products')->where('id', $productId)->update(['available' => $available]);
                }
                return $this->corsResponse(['success' => true, 'message' => 'Updated']);
            } catch (\Exception $e) {
                return $this->corsResponse(['success' => false, 'message' => $e->getMessage()], 500);
            }
        }

        try {
            $products = DB::table('products')->orderBy('name')->get();
            $results = [];

            foreach ($products as $product) {
                $variants = DB::table('product_sizes')->where('product_id', $product->id)->get();

                $totalStock = 0;
                if ($variants->count() > 0) {
                    foreach ($variants as $v) {
                        $totalStock += (int)($v->stock ?? 0);
                    }
                } else {
                    $totalStock = (int)($product->stock ?? 0);
                }

                $results[] = [
                    'id' => $product->id,
                    'name' => $product->name,
                    'category' => $product->category,
                    'price' => (float)$product->price,
                    'stock' => (int)$totalStock,
                    'available' => (int)$product->available,
                    'image' => $product->image,
                    'description' => $product->description,
                    'variants' => $variants->toArray()
                ];
            }

            return $this->corsResponse(['success' => true, 'products' => $results]);
        } catch (\Exception $e) {
            return $this->corsResponse(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getOrders(Request $request)
    {
        $admin = $this->requireRole($request, 'admin');
        if (!$admin instanceof User) {
            return $admin;
        }

        try {
            $query = DB::table('orders');
            $customOnly = in_array(strtolower((string) $request->query('custom', '0')), ['1', 'true'], true);
            $customTables = array_values(array_filter(
                ['custom_cake_orders', 'customized_cake_orders'],
                static fn (string $table): bool => Schema::hasTable($table)
            ));

            if ($customOnly) {
                if (!$customTables) {
                    $query->whereRaw('1 = 0');
                } else {
                    $query->where(function ($customQuery) use ($customTables) {
                        foreach ($customTables as $table) {
                            $customQuery->orWhereExists(function ($subQuery) use ($table) {
                                $subQuery->selectRaw('1')
                                    ->from($table)
                                    ->whereColumn("{$table}.order_id", 'orders.id');
                            });
                        }
                    });
                }
            } else {
                foreach ($customTables as $table) {
                    $query->whereNotExists(function ($subQuery) use ($table) {
                        $subQuery->selectRaw('1')
                            ->from($table)
                            ->whereColumn("{$table}.order_id", 'orders.id');
                    });
                }
            }

            if (!$customOnly) {
                $query->where(function ($paymentQuery) {
                    $paymentQuery->whereRaw("LOWER(COALESCE(payment, '')) != 'gcash'")
                        ->orWhereRaw("LOWER(COALESCE(payment_status, 'pending')) IN ('paid', 'proof_submitted')");
                });
            }

            $orders = $query->orderByDesc('id')->get();
            $orderNumbers = DB::table('orders')
                ->orderBy('created_at')
                ->orderBy('id')
                ->pluck('id')
                ->flip()
                ->map(fn (int $index): int => $index + 1);
            $itemsByOrder = collect();
            $legacyCustomByOrder = collect();
            $customizedByOrder = collect();

            if ($orders->isNotEmpty() && Schema::hasTable('order_items')) {
                $itemsByOrder = DB::table('order_items as oi')
                    ->leftJoin('products as p', 'p.id', '=', 'oi.product_id')
                    ->whereIn('oi.order_id', $orders->pluck('id'))
                    ->select('oi.order_id', 'oi.product', 'oi.qty', 'oi.price', 'p.category')
                    ->orderBy('oi.id')
                    ->get()
                    ->groupBy('order_id');
            }

            if ($orders->isNotEmpty()) {
                $orderIds = $orders->pluck('id');
                if (Schema::hasTable('custom_cake_orders')) {
                    $legacyCustomByOrder = DB::table('custom_cake_orders')
                        ->whereIn('order_id', $orderIds)
                        ->get()
                        ->keyBy('order_id');
                }
                if (Schema::hasTable('customized_cake_orders')) {
                    $customizedByOrder = DB::table('customized_cake_orders')
                        ->whereIn('order_id', $orderIds)
                        ->get()
                        ->keyBy('order_id');
                }
            }

            $orders = $orders->map(function ($order) use ($orderNumbers, $itemsByOrder, $legacyCustomByOrder, $customizedByOrder) {
                $rawItems = json_decode((string) ($order->items ?? '[]'), true);
                $items = $itemsByOrder->get($order->id, collect())
                    ->map(fn ($item) => [
                        'name' => $item->product ?: 'Item',
                        'qty' => (int) ($item->qty ?? 1),
                        'price' => (float) ($item->price ?? 0),
                        'category' => $item->category ?? '',
                    ])
                    ->values();

                if ($items->isEmpty() && is_array($rawItems)) {
                    $items = collect($rawItems)->map(fn ($item) => [
                        'name' => $item['name'] ?? $item['product'] ?? 'Item',
                        'qty' => (int) ($item['qty'] ?? $item['quantity'] ?? 1),
                        'price' => (float) ($item['price'] ?? 0),
                        'category' => $item['category'] ?? '',
                    ])->values();
                }

                $legacyCustom = $legacyCustomByOrder->get($order->id);
                $customized = $customizedByOrder->get($order->id);
                $customDetails = json_decode((string) ($legacyCustom->notes ?? ''), true);
                if (!is_array($customDetails)) {
                    $customDetails = [];
                }
                $modernDetails = json_decode((string) ($customized->notes ?? ''), true);
                if (is_array($modernDetails)) {
                    $customDetails = array_merge($customDetails, $modernDetails);
                }
                foreach ([
                    'cake_size' => $legacyCustom->cake_size ?? null,
                    'quantity' => $legacyCustom->quantity ?? null,
                    'cake_flavor' => $legacyCustom->flavor ?? null,
                    'filling_flavor' => $legacyCustom->filling ?? null,
                    'frosting_type' => $legacyCustom->frosting ?? null,
                    'occasion' => $legacyCustom->occasion ?? null,
                    'theme' => $legacyCustom->theme_design ?? null,
                    'cake_color' => $legacyCustom->preferred_colors ?? null,
                    'tiers' => $legacyCustom->tiers ?? null,
                    'custom_message' => $legacyCustom->dedication ?? null,
                    'estimated_price' => $legacyCustom->estimated_price ?? null,
                    'cake_type' => $customized->cake_type ?? null,
                    'recipe_status' => $customized->status ?? null,
                ] as $key => $value) {
                    if ($value !== null && $value !== '' && !array_key_exists($key, $customDetails)) {
                        $customDetails[$key] = $value;
                    }
                }
                $legacyImages = json_decode((string) ($legacyCustom->inspo_images ?? ''), true);
                $customizedImages = json_decode((string) ($customized->inspo_images ?? ''), true);
                $customImages = is_array($legacyImages) && $legacyImages
                    ? $legacyImages
                    : (is_array($customizedImages) ? $customizedImages : []);

                $order->order_number = $orderNumbers[$order->id] ?? (int) $order->id;
                $order->customer = $order->customer ?: $order->email ?: 'Guest';
                $order->has_discount_id = !empty($order->discount_id_path);
                $order->has_payment_proof = !empty($order->payment_proof_path)
                    && strtolower((string) ($order->payment_status ?? '')) === 'proof_submitted';
                unset($order->discount_id_path, $order->payment_proof_path);
                $order->items = $items;
                $order->custom_details = $customDetails;
                $order->custom_inspo_images = $customImages;
                $order->customized_inspo_images = is_array($customizedImages) ? $customizedImages : [];
                $order->details = $customDetails['details'] ?? $customized->notes ?? $legacyCustom->notes ?? null;
                $order->name = $customDetails['customer_name'] ?? $order->customer;
                $order->customer_name = $customDetails['customer_name'] ?? $order->customer;

                return $order;
            })->values();

            return $this->corsResponse(['success' => true, 'orders' => $orders]);
        } catch (\Exception $e) {
            Log::error('Staff order list query failed', ['exception' => $e]);
            return $this->corsResponse(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function viewOrderDiscountId(Request $request, int $orderId)
    {
        $admin = $this->requireRole($request, 'admin');
        if (!$admin instanceof User) {
            return $admin;
        }

        $path = DB::table('orders')->where('id', $orderId)->value('discount_id_path');
        $disk = Storage::disk('local');
        if (!$path || !$disk->exists($path)) {
            return $this->corsResponse(['success' => false, 'message' => 'Discount ID image not found.'], 404);
        }

        $fileContents = $disk->get($path);
        if ($fileContents === null) {
            return $this->corsResponse(['success' => false, 'message' => 'Discount ID image not found.'], 404);
        }

        $mimeType = (new \finfo(FILEINFO_MIME_TYPE))->buffer($fileContents) ?: 'application/octet-stream';
        return response($fileContents, 200, [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function viewOrderPaymentProof(Request $request, int $orderId)
    {
        $admin = $this->requireRole($request, 'admin');
        if (!$admin instanceof User) {
            return $admin;
        }

        $order = DB::table('orders')->where('id', $orderId)->first(['payment_proof_path', 'payment_status']);
        $path = $order->payment_proof_path ?? null;
        if (!$path || strtolower((string) ($order->payment_status ?? '')) !== 'proof_submitted') {
            return $this->corsResponse(['success' => false, 'message' => 'Payment proof not found.'], 404);
        }

        $disk = Storage::disk('local');
        if (!$disk->exists($path)) {
            return $this->corsResponse(['success' => false, 'message' => 'Payment proof not found.'], 404);
        }

        $fileContents = $disk->get($path);
        if ($fileContents === null) {
            return $this->corsResponse(['success' => false, 'message' => 'Payment proof not found.'], 404);
        }

        $mimeType = (new \finfo(FILEINFO_MIME_TYPE))->buffer($fileContents) ?: 'application/octet-stream';
        return response($fileContents, 200, [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function getIngredients(Request $request)
    {
        $admin = $this->requireRole($request, 'admin');
        if (!$admin instanceof User) {
            return $admin;
        }

        try {
            $ingredients = DB::table('ingredients')->orderBy('name')->get();
            return $this->corsResponse(['success' => true, 'ingredients' => $ingredients]);
        } catch (\Exception $e) {
            return $this->corsResponse(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getDashboard(Request $request)
    {
        if ($request->isMethod('options')) {
            return $this->corsResponse(['success' => true]);
        }

        $admin = $this->requireRole($request, 'admin');
        if (!$admin instanceof User) {
            return $admin;
        }

        try {
            $today = now();
            $startOfDay = $today->copy()->startOfDay();
            $endOfDay = $today->copy()->endOfDay();
            $startOfYesterday = $today->copy()->subDay()->startOfDay();
            $endOfYesterday = $today->copy()->subDay()->endOfDay();
            $startOfTrend = $today->copy()->subDays(6)->startOfDay();
            $startOfWeek = $today->copy()->startOfWeek();
            $startOfMonth = $today->copy()->startOfMonth();

            $todayOrders = DB::table('orders')->whereBetween('created_at', [$startOfDay, $endOfDay]);
            $completedOrders = DB::table('orders')->whereRaw('LOWER(status) = ?', ['completed']);
            $salesTrendRows = (clone $completedOrders)
                ->whereBetween('created_at', [$startOfTrend, $endOfDay])
                ->selectRaw('DATE(created_at) as date, COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders')
                ->groupByRaw('DATE(created_at)')
                ->get()
                ->keyBy('date');
            $salesTrend = collect(range(6, 0))->map(function ($daysAgo) use ($today, $salesTrendRows) {
                $date = $today->copy()->subDays($daysAgo)->toDateString();
                $row = $salesTrendRows->get($date);
                return ['date' => $date, 'revenue' => (float) ($row->revenue ?? 0), 'orders' => (int) ($row->orders ?? 0)];
            })->values();

            $products = DB::table('products')
                ->select('id', 'name', 'category', 'stock', 'minimum_stock', 'price', 'available')
                ->orderBy('name')
                ->get();
            $productSizesByProduct = collect();
            if (Schema::hasTable('product_sizes') && Schema::hasColumn('product_sizes', 'stock_quantity')) {
                $sizeThreshold = Schema::hasColumn('product_sizes', 'threshold')
                    ? DB::raw('COALESCE(size.threshold, product.minimum_stock) as threshold')
                    : DB::raw('product.minimum_stock as threshold');
                $productSizesByProduct = DB::table('product_sizes as size')
                    ->join('products as product', 'product.id', '=', 'size.product_id')
                    ->select(
                        'size.id as size_id',
                        'size.product_id',
                        'size.size',
                        'size.stock_quantity as stock',
                        $sizeThreshold
                    )
                    ->orderBy('size.size')
                    ->get()
                    ->groupBy('product_id');
            }

            $lowStock = collect();
            $outOfStock = collect();
            $productInventoryItemCount = 0;
            foreach ($products as $product) {
                $sizes = $productSizesByProduct->get($product->id, collect());
                if ($sizes->isNotEmpty()) {
                    foreach ($sizes as $size) {
                        $item = [
                            'id' => 'product-' . $product->id . '-size-' . $size->size_id,
                            'name' => $product->name . ' (' . $size->size . ')',
                            'stock' => (float) $size->stock,
                            'threshold' => (float) $size->threshold,
                            'inventory_type' => 'product',
                        ];
                        $productInventoryItemCount++;
                        if ($item['stock'] <= 0) {
                            $outOfStock->push($item);
                        } elseif ($item['threshold'] > 0 && $item['stock'] <= $item['threshold']) {
                            $lowStock->push($item);
                        }
                    }
                    continue;
                }

                $item = [
                    'id' => 'product-' . $product->id,
                    'name' => $product->name,
                    'stock' => (float) $product->stock,
                    'threshold' => (float) $product->minimum_stock,
                    'inventory_type' => 'product',
                ];
                $productInventoryItemCount++;
                if ($item['stock'] <= 0) {
                    $outOfStock->push($item);
                } elseif ($item['threshold'] > 0 && $item['stock'] <= $item['threshold']) {
                    $lowStock->push($item);
                }
            }

            $ingredients = DB::table('ingredients')
                ->select('id', 'name', 'unit', 'stock', 'threshold', 'expiry')
                ->orderBy('name')
                ->get();
            $inventory = app(InventoryService::class);
            $ingredients->each(function ($ingredient) use ($inventory) {
                $ingredient->stock = $inventory->getUsableStock((int) $ingredient->id);
            });
            $lowStockIngredients = $ingredients->filter(fn ($ingredient) => (float) $ingredient->threshold > 0 && (float) $ingredient->stock > 0 && (float) $ingredient->stock <= (float) $ingredient->threshold)->values();
            $outOfStockIngredients = $ingredients->filter(fn ($ingredient) => (float) $ingredient->stock <= 0)->values();

            $liveOrders = DB::table('orders')
                ->whereNotIn(DB::raw('LOWER(status)'), ['completed', 'cancelled'])
                ->where(function ($query) {
                    $query->whereRaw("LOWER(COALESCE(payment, '')) NOT IN ('gcash', 'qrph')")
                        ->orWhereRaw("LOWER(COALESCE(payment_status, 'pending')) = 'paid'");
                })
                ->orderByDesc('created_at');

            $liveOrders = $liveOrders->get();
            $orderItems = DB::table('order_items as oi')
                ->leftJoin('products as p', 'p.id', '=', 'oi.product_id')
                ->whereIn('oi.order_id', $liveOrders->pluck('id'))
                ->select('oi.order_id', 'oi.product_id', 'oi.product as name', 'oi.qty as quantity', 'oi.price', 'p.category')
                ->orderBy('oi.id')
                ->get()
                ->groupBy('order_id');
            $liveOrders = $liveOrders->map(function ($order) use ($orderItems) {
                $order->customer = $order->customer ?: $order->email ?: 'Guest';
                $order->items = $orderItems->get($order->id, collect())->values();
                return $order;
            })->values();

            $pendingOrdersTotal = DB::table('orders')->whereRaw('LOWER(status) = ?', ['pending'])->count();
            $orderStatusCounts = DB::table('orders')
                ->selectRaw('LOWER(TRIM(status)) as normalized_status, COUNT(*) as total')
                ->groupByRaw('LOWER(TRIM(status))')
                ->get();
            $orderStatusBreakdown = [];
            foreach ($orderStatusCounts as $statusRow) {
                $normalizedStatus = (string) $statusRow->normalized_status;
                $label = match ($normalizedStatus) {
                    'ready', 'ready for pickup' => 'Ready for Pickup',
                    'cancelled', 'canceled', 'rejected' => 'Cancelled',
                    '' => 'Unknown',
                    default => ucwords($normalizedStatus),
                };
                $orderStatusBreakdown[$label] = ($orderStatusBreakdown[$label] ?? 0) + (int) $statusRow->total;
            }

            $production = DB::table('production_transactions as pt')
                ->join('products as p', 'p.id', '=', 'pt.product_id')
                ->whereBetween('pt.created_at', [$startOfDay, $endOfDay])
                ->select('pt.product_id', 'p.name as product', DB::raw('SUM(pt.quantity) as produced'))
                ->groupBy('pt.product_id', 'p.name')
                ->orderBy('p.name')
                ->get()
                ->map(fn ($row) => ['product_id' => (int) $row->product_id, 'product' => $row->product, 'planned' => null, 'produced' => (int) $row->produced, 'remaining' => null]);
            $productionToday = (int) $production->sum('produced');

            $waste = DB::table('waste_log')
                ->whereBetween('datetime', [$startOfDay, $endOfDay]);
            $wasteByReason = (clone $waste)
                ->select('reason', DB::raw('SUM(qty) as quantity'), DB::raw('SUM(qty * unit_cost) as value'))
                ->groupBy('reason')
                ->orderByDesc('quantity')
                ->get();

            $nearExpiry = $ingredients->filter(function ($ingredient) use ($today) {
                    return $ingredient->expiry !== null && $ingredient->expiry >= $today->toDateString() && $ingredient->expiry <= $today->copy()->addDays(7)->toDateString();
                })
                ->values();
            $totalInventoryItems = $productInventoryItemCount + $ingredients->count();
            $lowStockCount = $lowStock->count() + $lowStockIngredients->count();
            $outOfStockCount = $outOfStock->count() + $outOfStockIngredients->count();

            return $this->corsResponse([
                'success' => true,
                'summary' => [
                    'orders_today' => (clone $todayOrders)->count(),
                    'pending_orders' => (clone $todayOrders)->whereRaw('LOWER(status) = ?', ['pending'])->count(),
                    'preparing_orders' => (clone $todayOrders)->whereRaw('LOWER(status) = ?', ['preparing'])->count(),
                    'pending_orders_total' => $pendingOrdersTotal,
                    'preparing_orders_total' => DB::table('orders')->whereRaw('LOWER(status) = ?', ['preparing'])->count(),
                    'completed_orders_total' => (clone $completedOrders)->count(),
                    'sales_today' => (float) (clone $completedOrders)->whereBetween('created_at', [$startOfDay, $endOfDay])->sum('total'),
                    'sales_yesterday' => (float) (clone $completedOrders)->whereBetween('created_at', [$startOfYesterday, $endOfYesterday])->sum('total'),
                    'sales_week' => (float) (clone $completedOrders)->whereBetween('created_at', [$startOfWeek, $endOfDay])->sum('total'),
                    'sales_month' => (float) (clone $completedOrders)->whereBetween('created_at', [$startOfMonth, $endOfDay])->sum('total'),
                    'total_inventory_items' => $totalInventoryItems,
                    'low_stock' => $lowStockCount,
                    'out_of_stock' => $outOfStockCount,
                    'production_today' => $productionToday,
                    'production_planned' => null,
                    'production_completed' => (int) DB::table('production_transactions')->whereBetween('created_at', [$startOfDay, $endOfDay])->sum('quantity'),
                    'waste_today' => (float) (clone $waste)->sum('qty'),
                    'waste_value_today' => (float) (clone $waste)->selectRaw('COALESCE(SUM(qty * unit_cost), 0) as value')->value('value'),
                ],
                'inventory' => [
                    'products' => $products->values(),
                    'low_stock' => $lowStock,
                    'out_of_stock' => $outOfStock,
                    'ingredients' => $ingredients->values(),
                    'low_stock_ingredients' => $lowStockIngredients,
                    'out_of_stock_ingredients' => $outOfStockIngredients,
                    'near_expiry' => $nearExpiry,
                ],
                'needs_attention' => [
                    'out_of_stock' => $outOfStockCount,
                    'low_stock' => $lowStockCount,
                    'near_expiry' => $nearExpiry->count(),
                    'orders_waiting' => $pendingOrdersTotal,
                ],
                'inventory_health' => [
                    'in_stock' => max(0, $totalInventoryItems - $lowStockCount - $outOfStockCount),
                    'low_stock' => $lowStockCount,
                    'out_of_stock' => $outOfStockCount,
                    'near_expiry' => $nearExpiry->count(),
                    'total' => $totalInventoryItems,
                ],
                'live_orders' => $liveOrders,
                'order_status_breakdown' => collect($orderStatusBreakdown)
                    ->map(fn ($value, $name) => ['name' => $name, 'value' => $value])
                    ->values(),
                'production' => $production,
                'production_summary' => [
                    'planned' => null,
                    'produced' => $productionToday,
                    'remaining' => null,
                    'planning_available' => false,
                ],
                'sales_overview' => ['trend' => $salesTrend],
                'waste' => ['by_reason' => $wasteByReason],
            ]);
        } catch (\Exception $e) {
            Log::error('Staff dashboard query failed', ['exception' => $e]);
            return $this->corsResponse(['success' => false, 'message' => 'Unable to load dashboard data.'], 500);
        }
    }
}
