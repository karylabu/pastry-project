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
        return response()->json($payload, $status)
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
}
