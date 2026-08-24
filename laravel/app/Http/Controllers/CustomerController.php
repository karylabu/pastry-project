<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function __construct()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        // Sync Laravel session user into legacy native PHP session.
        if (!isset($_SESSION['user']) && session()->has('user')) {
            $_SESSION['user'] = session('user');
        }

        if (isset($_SESSION['user']) && !session()->has('user')) {
            session(['user' => $_SESSION['user']]);
        }

        // Provide PDO-based compatibility helpers for legacy includes
        // so functions like db(), db_all(), db_run() are defined.
        if (file_exists(base_path('legacy_compat.php'))) {
            require_once base_path('legacy_compat.php');
        }

        // Load legacy helpers (they will use the above compatibility layer)
        require_once base_path('../includes/data.php');
    }

    protected function requireLogin()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        if (!isset($_SESSION['user']) && !session()->has('user')) {
            return redirect('/login.php');
        }

        if (!isset($_SESSION['user']) && session()->has('user')) {
            $_SESSION['user'] = session('user');
        }

        return null;
    }

    public function dashboard(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        $user = $_SESSION['user'];
        $products = getDB()['products'] ?? [];
        $cartCount = get_cart_count();

        return view('customer.dashboard', compact('user', 'products', 'cartCount'));
    }

    public function cart(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        if ($request->isMethod('post')) {
            if ($request->has('add_to_cart')) {
                add_to_cart(
                    (int)$request->input('product_id', 0),
                    $request->input('size', 'slice'),
                    (int)$request->input('quantity', 1)
                );

                return redirect()->back();
            }

            if ($request->has('update_qty')) {
                $keys = explode(',', $request->input('cart_keys', ''));
                foreach ($keys as $key) {
                    $qty = (int)$request->input('qty_' . trim($key), 1);
                    update_cart_item(trim($key), max(1, $qty));
                }

                return redirect()->back();
            }

            if ($request->has('remove_item')) {
                $removeKeys = explode(',', $request->input('remove_item'));
                foreach ($removeKeys as $key) {
                    remove_from_cart(trim($key));
                }

                return redirect()->back();
            }

            if ($request->has('clear_cart')) {
                clear_cart();
                return redirect()->back();
            }
        }

        $items = get_cart_items();
        $cartCount = get_cart_count();
        $total = get_cart_total();

        return view('customer.cart', compact('items', 'cartCount', 'total'));
    }

    public function checkout(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        // Accept selected item keys via POST or from session
        $selected = $request->input('selected_items', null);

        if ($request->isMethod('post') && is_array($selected)) {
            // store selection in session for placeOrder
            $_SESSION['checkout_selected_keys'] = $selected;
        } else {
            $selected = $_SESSION['checkout_selected_keys'] ?? null;
        }

        $allItems = get_cart_items();

        if (empty($allItems)) {
            return redirect('/cart.php');
        }

        if (empty($selected) || !is_array($selected)) {
            // nothing selected — redirect back to cart
            return redirect('/cart.php');
        }

        $items = array_values(array_filter($allItems, fn($i) => in_array($i['key'] ?? '', $selected)));

        if (empty($items)) {
            return redirect('/cart.php');
        }

        $user = $_SESSION['user'];
        $cartTotal = array_sum(array_map(fn($it) => $it['price'] * $it['quantity'], $items));
        $deliveryFee = 50;
        $grandTotal = $cartTotal + $deliveryFee;

        return view('customer.checkout', compact('items', 'user', 'cartTotal', 'deliveryFee', 'grandTotal'));
    }

    public function placeOrder(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        // Prefer selected items from POST; fall back to session
        $selectedFromRequest = $request->input('selected_items', null);

        if (is_array($selectedFromRequest) && !empty($selectedFromRequest)) {
            $selected = array_values(array_map('strval', $selectedFromRequest));
            // persist selection for subsequent requests
            $_SESSION['checkout_selected_keys'] = $selected;
        } else {
            $selected = $_SESSION['checkout_selected_keys'] ?? [];
        }

        if (!is_array($selected) || empty($selected)) {
            return redirect('/cart.php')->with('error', 'No items selected for ordering.');
        }

        $allItems = get_cart_items();
        if (empty($allItems)) {
            return redirect('/cart.php')->with('error', 'Your cart is empty.');
        }

        // Validate that selected keys exist in the cart
        $orderItems = [];
        $removedKeys = [];
        $selectedSet = array_flip($selected);

        foreach ($allItems as $item) {
            $key = isset($item['key']) ? strval($item['key']) : '';
            if ($key === '' || !isset($selectedSet[$key])) {
                continue;
            }

            $orderItems[] = [
                'product' => $item['product']['id'] ?? 0,
                'qty' => (int)($item['quantity'] ?? 0),
                'price' => (float)($item['price'] ?? 0),
            ];

            $removedKeys[] = $key;
        }

        if (empty($orderItems)) {
            return redirect('/cart.php')->with('error', 'Selected items not found in cart.');
        }

        // Validate and sanitize order inputs
        $validated = $request->validate([
            'address' => 'nullable|string|max:1024',
            'payment' => 'nullable|string|max:64',
            'order_type' => 'nullable|string|max:64',
        ]);

        $user = $_SESSION['user'] ?? [];

        $data = [
            'customer' => $user['name'] ?? 'Guest',
            'email' => $user['email'] ?? '',
            'type' => $validated['order_type'] ?? $request->input('order_type', 'Delivery'),
            'payment' => $validated['payment'] ?? $request->input('payment', 'COD'),
            'address' => $validated['address'] ?? $request->input('address', ''),
            'items' => $orderItems,
        ];

        $orderId = db_place_order($data);

        if ($orderId) {
            // Remove ordered items from cart
            foreach ($removedKeys as $k) {
                remove_from_cart($k);
            }
            // clear session selection
            unset($_SESSION['checkout_selected_keys']);

            return redirect('/orders.php')->with('message', 'Your order has been placed successfully. Order #' . $orderId);
        }

        return redirect('/checkout.php')->with('error', 'Unable to place order. Please try again.');
    }

    public function orders(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        $filter = $request->query('filter', 'all');
        $userEmail = $_SESSION['user']['email'] ?? '';

        $orders = array_filter(
            getDB()['orders'] ?? [],
            fn($order) => ($order['email'] ?? '') === $userEmail
        );

        if ($filter !== 'all') {
            $orders = array_filter(
                $orders,
                fn($order) => strtolower($order['status'] ?? '') === strtolower($filter)
            );
        }

        $orders = array_reverse($orders);
        $cartCount = get_cart_count();

        return view('customer.orders', compact('orders', 'filter', 'cartCount'));
    }

    public function notifications(Request $request)
    {
        if ($redirect = $this->requireLogin()) {
            return $redirect;
        }

        $userId = $_SESSION['user']['id'] ?? null;
        $notifications = [];
        if ($userId) {
            $notifications = db_get_notifications($userId);
        }

        $cartCount = get_cart_count();
        return view('customer.notifications', compact('notifications', 'cartCount'));
    }

    public function logout()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        session_destroy();
        return redirect('/login.php');
    }

    public function findConfig()
    {
        $dir = realpath(base_path('../')) ?: base_path('../');
        $files = [];

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir)
        );

        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getFilename() === 'config.php') {
                $files[] = str_replace('\\', '/', $file->getPathname());
            }
        }

        return view('customer.find_config', compact('files'));
    }
}
