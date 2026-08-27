<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class StaffApiController extends Controller
{
    public function __construct()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    protected function corsResponse($payload, int $status = 200)
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

        $role = $user->role ?? null;
        if (!$role || ($role !== 'staff' && $role !== 'admin')) {
            return $this->corsResponse(['success' => false, 'message' => 'Access denied. Staff only.'], 403);
        }

        $passwordValid = ($password === $user->password || Hash::check($password, $user->password));

        if (!$passwordValid) {
            return $this->corsResponse(['success' => false, 'message' => 'Incorrect password.'], 401);
        }

        $token = 'staff_token_' . bin2hex(random_bytes(16));

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
        try {
            $query = DB::table('orders');
            if ($request->query('custom') == '1') $query->where('is_customized', 1);

            $orders = $query->orderBy('created_at', 'desc')->get()->map(function ($order) {
                return [
                    'id' => $order->id,
                    'customer' => $order->customer ?: $order->email ?: 'Guest',
                    'total' => (float)$order->total,
                    'status' => $order->status,
                    'created_at' => $order->created_at,
                ];
            });

            return $this->corsResponse(['success' => true, 'orders' => $orders]);
        } catch (\Exception $e) {
            return $this->corsResponse(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getIngredients(Request $request)
    {
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

        $user = session('user');
        if (!$user && $request->bearerToken()) {
            $user = DB::table('user_sessions')
                ->join('users', 'users.id', '=', 'user_sessions.user_id')
                ->where('user_sessions.token', $request->bearerToken())
                ->where('user_sessions.expires_at', '>', now())
                ->first(['users.id', 'users.name', 'users.email', 'users.role']);
        }
        $role = is_array($user) ? ($user['role'] ?? null) : ($user->role ?? null);
        if (!$user || !in_array($role, ['admin', 'manager', 'staff'], true)) {
            return $this->corsResponse(['success' => false, 'message' => 'Staff authorization required.'], 403);
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
            $lowStock = $products->filter(fn ($product) => (float) $product->stock > 0 && (float) $product->stock <= (float) $product->minimum_stock)->values();
            $outOfStock = $products->filter(fn ($product) => (float) $product->stock <= 0)->values();

            $ingredients = DB::table('ingredients')
                ->select('id', 'name', 'unit', 'stock', 'threshold', 'expiry')
                ->orderBy('name')
                ->get();
            $lowStockIngredients = $ingredients->filter(fn ($ingredient) => (float) $ingredient->stock > 0 && (float) $ingredient->stock <= (float) $ingredient->threshold)->values();
            $outOfStockIngredients = $ingredients->filter(fn ($ingredient) => (float) $ingredient->stock <= 0)->values();

            $liveOrders = DB::table('orders')
                ->whereNotIn(DB::raw('LOWER(status)'), ['completed', 'cancelled'])
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
            $totalInventoryItems = $products->count() + $ingredients->count();
            $lowStockCount = $lowStock->count() + $lowStockIngredients->count();
            $outOfStockCount = $outOfStock->count() + $outOfStockIngredients->count();

            return $this->corsResponse([
                'success' => true,
                'summary' => [
                    'orders_today' => (clone $todayOrders)->count(),
                    'pending_orders' => (clone $todayOrders)->whereRaw('LOWER(status) = ?', ['pending'])->count(),
                    'preparing_orders' => (clone $todayOrders)->whereRaw('LOWER(status) = ?', ['preparing'])->count(),
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
