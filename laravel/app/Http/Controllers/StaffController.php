<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class StaffController extends Controller
{
    protected function requireLogin()
    {
        if (!session()->has('user')) {
            return redirect('/staff_login.php');
        }

        return null;
    }

    public function login(Request $request)
    {
        if ($request->isMethod('post')) {
            $email = trim($request->input('email', ''));
            $password = trim($request->input('password', ''));
            $error = '';

            if (!$email || !$password) {
                $error = 'Please enter both email and password.';
            } else {
                $user = DB::table('users')->where('email', $email)->first();

                if ($user && (Hash::check($password, $user->password) || $user->password === $password)) {
                    $role = property_exists($user, 'role') && $user->role ? $user->role : 'staff';
                    session(['user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'role' => $role,
                    ]]);

                    return redirect('/staff/dashboard.php');
                }

                $error = 'Invalid email or password.';
            }

            return view('staff.login', compact('error'));
        }

        if (session()->has('user')) {
            return redirect('/staff/dashboard.php');
        }

        return view('staff.login');
    }

    public function logout()
    {
        session()->forget('user');
        session()->flush();

        return redirect('/staff_login.php');
    }

    public function dashboard(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        $products = DB::table('products')->where('available', 1)->get()->map(function ($item) {
            return (array) $item;
        })->toArray();

        $categories = array_values(array_unique(array_column($products, 'category')));

        $totalOrders = DB::table('orders')->count();
        $lowStocks = DB::table('products')->where('stock', '<=', 5)->count();
        $pendingOrders = DB::table('orders')->where('status', 'Pending')->count();
        $dailySales = DB::table('orders')->whereDate('created_at', now())->sum('total');

        return view('staff.dashboard', compact('products', 'categories', 'totalOrders', 'lowStocks', 'pendingOrders', 'dailySales'));
    }

    public function inventory(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        $products = DB::table('products')->orderBy('name')->get()->map(function ($item) {
            return (array) $item;
        })->toArray();

        $lowStock = DB::table('products')->where('stock', '<=', 5)->orderBy('stock')->get()->map(function ($item) {
            return (array) $item;
        })->toArray();

        $search = $request->query('search', '');
        if (!empty($search)) {
            $products = array_filter($products, function ($p) use ($search) {
                return isset($p['name']) && stripos($p['name'], $search) !== false;
            });
        }

        return view('staff.inventory', compact('products', 'lowStock', 'search'));
    }

    public function inventoryUpdate(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        $id = $request->input('id');
        $type = $request->input('type');
        $qty = (int)$request->input('quantity', 0);

        if (!$id || $qty <= 0) {
            return redirect('/staff/inventory.php');
        }

        if ($type === 'IN') {
            DB::table('products')->where('id', $id)->increment('stock', $qty);
        } else {
            DB::table('products')->where('id', $id)->decrement('stock', $qty);
        }

        return redirect('/staff/inventory.php');
    }

    public function products(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        $products = DB::table('products')->orderBy('name')->get()->map(function ($item) {
            return (array) $item;
        })->toArray();

        $categories = array_values(array_unique(array_column($products, 'category')));
        $filterCat = $request->query('cat', 'all');

        if ($filterCat !== 'all') {
            $products = array_filter($products, function ($product) use ($filterCat) {
                return isset($product['category']) && $product['category'] === $filterCat;
            });
        }

        return view('staff.products', compact('products', 'categories', 'filterCat'));
    }

    public function orders(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        $filter = $request->query('filter', 'all');
        $ordersQuery = DB::table('orders');

        if ($filter !== 'all') {
            $ordersQuery->whereRaw('LOWER(status) = ?', [strtolower($filter)]);
        }

        $orders = $ordersQuery->orderByDesc('created_at')->get()->map(function ($item) {
            return (array) $item;
        })->toArray();

        return view('staff.orders', compact('orders', 'filter'));
    }

    public function updateOrderStatus(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        $oid = (int) $request->input('order_id');
        $newStatus = $request->input('new_status');

        if ($oid && $newStatus) {
            DB::table('orders')->where('id', $oid)->update(['status' => $newStatus]);
        }

        return redirect('/staff/orders.php')->with('message', "Order #{$oid} updated to {$newStatus}.");
    }

    public function analytics(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        if (session('user.role') !== 'admin') {
            return redirect('/staff/dashboard.php');
        }

        $orders = Schema::hasTable('orders')
            ? DB::table('orders')->get()->map(fn($item) => (array) $item)->toArray()
            : [];

        $totalRevenue = array_sum(array_column($orders, 'total'));
        $avgOrder = count($orders) ? $totalRevenue / count($orders) : 0;

        $dailySales = [];
        if (Schema::hasTable('orders')) {
            $dailyRows = DB::table('orders')
                ->selectRaw("DATE(created_at) as date, SUM(total) as total")
                ->groupBy('date')
                ->orderBy('date')
                ->get()
                ->map(fn($item) => (array) $item)
                ->toArray();

            foreach ($dailyRows as $row) {
                $dailySales[$row['date']] = (float) $row['total'];
            }
        }

        if (empty($dailySales)) {
            $dailySales = ['No Data' => 0];
        }

        $monthSales = [];
        if (Schema::hasTable('orders')) {
            $monthRows = DB::table('orders')
                ->selectRaw("strftime('%m', created_at) as month_num, strftime('%b', created_at) as month_label, SUM(total) as total")
                ->groupBy('month_num')
                ->orderBy('month_num')
                ->get()
                ->map(fn($item) => (array) $item)
                ->toArray();

            foreach ($monthRows as $row) {
                $monthSales[] = [
                    'label' => $row['month_label'],
                    'value' => (float) $row['total'],
                ];
            }
        }

        if (empty($monthSales)) {
            $monthSales = [
                ['label' => 'Jan', 'value' => 12500],
                ['label' => 'Feb', 'value' => 18200],
                ['label' => 'Mar', 'value' => 15800],
                ['label' => 'Apr', 'value' => 22400],
                ['label' => 'May', 'value' => 16300],
            ];
        }

        $topProds = [];
        if (Schema::hasTable('order_items')) {
            $topRows = DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->select('order_items.product as name', DB::raw('SUM(order_items.qty) as sold'), DB::raw('SUM(order_items.price * order_items.qty) as revenue'))
                ->groupBy('order_items.product')
                ->orderByDesc('sold')
                ->limit(5)
                ->get()
                ->map(fn($item) => (array) $item)
                ->toArray();

            foreach ($topRows as $row) {
                $topProds[$row['name']] = [
                    'sold' => (int) $row['sold'],
                    'revenue' => (float) $row['revenue'],
                ];
            }
        }

        if (empty($topProds)) {
            $topProds = [
                'Ube Pandesal' => ['sold' => 120, 'revenue' => 42000],
                'Croissant' => ['sold' => 96, 'revenue' => 31200],
                'Chocolate Cake' => ['sold' => 78, 'revenue' => 39000],
            ];
        }

        $ingredients = Schema::hasTable('ingredients')
            ? DB::table('ingredients')->orderBy('name')->get()->map(fn($item) => (array) $item)->toArray()
            : [];

        $maxMonth = max(array_column($monthSales, 'value'));
        $maxDay = max(array_values($dailySales));
        $unitsSold = array_sum(array_column($topProds, 'sold'));

        return view('staff.analytics', compact('topProds', 'dailySales', 'totalRevenue', 'avgOrder', 'monthSales', 'maxMonth', 'maxDay', 'unitsSold', 'ingredients'));
    }

    public function reports(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        if (session('user.role') !== 'admin') {
            return redirect('/staff/dashboard.php');
        }

        $orders = Schema::hasTable('orders')
            ? DB::table('orders')->orderByDesc('created_at')->get()->map(fn($item) => (array) $item)->toArray()
            : [];

        $totalRevenue = array_sum(array_column($orders, 'total'));
        $completedRevenue = array_sum(array_column(array_filter($orders, fn($o) => ($o['status'] ?? '') === 'Completed'), 'total'));
        $avgOrder = count($orders) ? $totalRevenue / count($orders) : 0;

        $dailySales = [];
        if (Schema::hasTable('orders')) {
            $dailyRows = DB::table('orders')
                ->selectRaw("DATE(created_at) as date, SUM(total) as total")
                ->groupBy('date')
                ->orderBy('date')
                ->get()
                ->map(fn($item) => (array) $item)
                ->toArray();

            foreach ($dailyRows as $row) {
                $dailySales[$row['date']] = (float) $row['total'];
            }
        }

        if (empty($dailySales)) {
            $dailySales = ['No Data' => 0];
        }

        $ingredients = Schema::hasTable('ingredients')
            ? DB::table('ingredients')->orderBy('name')->get()->map(fn($item) => (array) $item)->toArray()
            : [];

        return view('staff.reports', compact('orders', 'totalRevenue', 'completedRevenue', 'avgOrder', 'dailySales', 'ingredients'));
    }

    public function recipes(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        if (session('user.role') !== 'admin') {
            return redirect('/staff/dashboard.php');
        }

        $products = DB::table('products')->orderBy('name')->get()->map(fn($item) => (array) $item)->toArray();
        $ingredients = DB::table('ingredients')->orderBy('name')->get()->map(fn($item) => (array) $item)->toArray();

        $recipeRows = DB::table('product_recipes')
            ->join('products', 'product_recipes.product_id', '=', 'products.id')
            ->join('ingredients', 'product_recipes.ingredient_id', '=', 'ingredients.id')
            ->select(
                'product_recipes.product_id',
                'product_recipes.ingredient_id',
                'product_recipes.qty',
                'products.name as product_name',
                'ingredients.name as ingredient_name',
                'ingredients.unit as ingredient_unit'
            )
            ->orderBy('products.name')
            ->orderBy('ingredients.name')
            ->get()
            ->map(fn($item) => (array) $item)
            ->toArray();

        $recipeMap = [];
        foreach ($recipeRows as $row) {
            $recipeMap[$row['product_name']][] = $row;
        }

        return view('staff.recipes', compact('products', 'ingredients', 'recipeMap'));
    }

    public function saveRecipe(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        if (session('user.role') !== 'admin') {
            return redirect('/staff/dashboard.php');
        }

        $validated = $request->validate([
            'product_id' => 'required|integer|exists:products,id',
            'ingredient_id' => 'array',
            'ingredient_id.*' => 'nullable|integer|exists:ingredients,id',
            'qty' => 'array',
            'qty.*' => 'nullable|numeric|min:0',
        ]);

        $productId = (int) $validated['product_id'];
        $ingredientIds = $request->input('ingredient_id', []);
        $qtys = $request->input('qty', []);

        DB::transaction(function () use ($productId, $ingredientIds, $qtys) {
            DB::table('product_recipes')->where('product_id', $productId)->delete();

            foreach ($ingredientIds as $index => $ingredientId) {
                $ingredientId = (int) $ingredientId;
                $qty = isset($qtys[$index]) ? (float) $qtys[$index] : 0;

                if ($ingredientId <= 0 || $qty <= 0) {
                    continue;
                }

                DB::table('product_recipes')->insert([
                    'product_id' => $productId,
                    'ingredient_id' => $ingredientId,
                    'qty' => $qty,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        return redirect('/recipes.php')->with('message', 'Recipe saved successfully.');
    }

    public function variance(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        if (!in_array(session('user.role'), ['admin', 'staff'])) {
            return redirect('/staff/dashboard.php');
        }

        $startDate = $request->query('start', now()->subDays(30)->format('Y-m-d'));
        $endDate = $request->query('end', now()->format('Y-m-d'));

        $ingredients = DB::table('ingredients')->orderBy('name')->get()->map(fn($item) => (array) $item)->toArray();
        $products = DB::table('products')->orderBy('name')->get()->map(fn($item) => (array) $item)->toArray();

        $varianceRows = DB::table('variance')
            ->leftJoin('ingredients', 'variance.ingredient_id', '=', 'ingredients.id')
            ->leftJoin('products', 'variance.product_id', '=', 'products.id')
            ->leftJoin('users', 'variance.recorded_by', '=', 'users.id')
            ->select(
                'variance.*',
                'ingredients.name as ingredient_name',
                'products.name as product_name',
                'users.name as recorded_by_name'
            )
            ->whereBetween('variance.recorded_date', [$startDate, $endDate])
            ->orderByDesc('variance.recorded_date')
            ->get()
            ->map(fn($item) => (array) $item)
            ->toArray();

        $varianceSummaryRows = DB::table('variance')
            ->select('variance_type', DB::raw('SUM(qty_lost) as total'))
            ->whereBetween('recorded_date', [$startDate, $endDate])
            ->groupBy('variance_type')
            ->get()
            ->mapWithKeys(fn($item) => [$item->variance_type => (float) $item->total])
            ->toArray();

        return view('staff.variance', compact('ingredients', 'products', 'varianceRows', 'varianceSummaryRows', 'startDate', 'endDate'));
    }

    public function logVariance(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        if (!in_array(session('user.role'), ['admin', 'staff'])) {
            return redirect('/staff/dashboard.php');
        }

        $validated = $request->validate([
            'variance_type' => 'required|string|in:Waste,Spoilage,Damage,Unaccounted',
            'item_type' => 'required|string|in:ingredient,product',
            'ingredient_id' => 'nullable|integer|exists:ingredients,id',
            'product_id' => 'nullable|integer|exists:products,id',
            'qty_lost' => 'required|numeric|min:0.001',
            'reason' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1024',
        ]);

        $ingredientId = $validated['item_type'] === 'ingredient' ? (int) $validated['ingredient_id'] : null;
        $productId = $validated['item_type'] === 'product' ? (int) $validated['product_id'] : null;

        if (!$ingredientId && !$productId) {
            return redirect('/variance.php')->with('error', 'Please select an ingredient or product to log.');
        }

        $userId = session('user.id');
        $userName = session('user.name', 'Staff');

        DB::transaction(function () use ($ingredientId, $productId, $validated, $userId, $userName) {
            if ($ingredientId) {
                DB::table('ingredients')->where('id', $ingredientId)->decrement('stock', $validated['qty_lost']);
            }

            DB::table('variance')->insert([
                'ingredient_id' => $ingredientId,
                'product_id' => $productId,
                'variance_type' => $validated['variance_type'],
                'qty_lost' => $validated['qty_lost'],
                'reason' => $validated['reason'] ?? '',
                'notes' => $validated['notes'] ?? '',
                'recorded_by' => $userId,
                'recorded_date' => now()->format('Y-m-d'),
                'created_at' => now(),
            ]);

            if (session('user.role') !== 'admin') {
                $itemName = 'Inventory item';
                if ($ingredientId) {
                    $item = DB::table('ingredients')->where('id', $ingredientId)->first();
                    $itemName = $item?->name ?? $itemName;
                } elseif ($productId) {
                    $item = DB::table('products')->where('id', $productId)->first();
                    $itemName = $item?->name ?? $itemName;
                }

                $adminIds = DB::table('users')->where('role', 'admin')->pluck('id')->toArray();
                foreach ($adminIds as $adminId) {
                    if ($adminId === $userId) {
                        continue;
                    }
                    DB::table('notifications')->insert([
                        'user_id' => $adminId,
                        'type' => 'Info',
                        'title' => '📋 Variance Logged',
                        'message' => "{$userName} logged {$validated['qty_lost']} units of {$itemName} as {$validated['variance_type']}.",
                        'action_url' => 'variance.php',
                        'is_read' => 0,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        });

        return redirect('/variance.php')->with('message', 'Variance logged successfully.');
    }

    public function updateCategoriesForm(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        if (session('user.role') !== 'admin') {
            return redirect('/staff/dashboard.php');
        }

        return view('staff.update_categories');
    }

    public function updateCategories(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        if (session('user.role') !== 'admin') {
            return redirect('/staff/dashboard.php');
        }

        DB::table('products')->whereRaw('LOWER(TRIM(category)) = ?', ['meals'])->update(['category' => 'Meals']);
        DB::table('products')->whereRaw('LOWER(TRIM(category)) = ?', ['cakes'])->update(['category' => 'Cakes']);

        $categories = DB::table('products')->distinct()->orderBy('category')->pluck('category')->toArray();

        return redirect('/update_categories.php')->with(['message' => 'Categories updated successfully.', 'categories' => $categories]);
    }
}
