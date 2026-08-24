<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;

class ProductApiController extends Controller
{
    /**
     * Get list of all available products.
     */
    public function index(Request $request)
    {
        $action = $request->query('action', 'list');

        if ($action === 'best-sellers') {
            try {
                // 1. Get top products from order_items table
                $topProductNames = \Illuminate\Support\Facades\DB::table('order_items')
                    ->select('product', \Illuminate\Support\Facades\DB::raw('SUM(qty) as total_qty'))
                    ->groupBy('product')
                    ->orderByDesc('total_qty')
                    ->limit(10)
                    ->pluck('product')
                    ->toArray();

                // 2. If order_items is empty, try parsing from orders table JSON
                if (empty($topProductNames)) {
                    $orders = \Illuminate\Support\Facades\DB::table('orders')->select('items')->get();
                    $counts = [];
                    foreach ($orders as $order) {
                        $items = json_decode($order->items, true);
                        if (is_array($items)) {
                            foreach ($items as $item) {
                                $name = trim($item['name'] ?? '');
                                if ($name) {
                                    $qty = intval($item['qty'] ?? 1);
                                    $counts[$name] = ($counts[$name] ?? 0) + $qty;
                                }
                            }
                        }
                    }
                    arsort($counts);
                    $topProductNames = array_slice(array_keys($counts), 0, 10);
                }

                // 3. Fetch the actual product models
                if (!empty($topProductNames)) {
                    $products = Product::where('available', true)
                        ->where(function($q) use ($topProductNames) {
                            foreach ($topProductNames as $name) {
                                $q->orWhere('name', 'LIKE', trim($name));
                            }
                        })
                        ->get()
                        ->sortBy(function($product) use ($topProductNames) {
                            // Find index ignoring case and extra spaces
                            foreach ($topProductNames as $index => $tn) {
                                if (strcasecmp(trim($product->name), trim($tn)) === 0) return $index;
                            }
                            return 999;
                        })
                        ->values();
                } else {
                    $products = collect();
                }

                // 4. Fallback/Padding: if still empty or too few, add latest products
                if ($products->count() < 4) {
                    $idsToExclude = $products->pluck('id')->toArray();
                    $extra = Product::where('available', true)
                        ->whereNotIn('id', $idsToExclude)
                        ->latest()
                        ->limit(6 - $products->count())
                        ->get();
                    $products = $products->concat($extra);
                }

                $results = [];
                foreach ($products->take(10) as $product) {
                    $variants = \Illuminate\Support\Facades\DB::table('product_sizes')
                        ->where('product_id', $product->id)
                        ->get();

                    $productData = $product->toArray();
                    $productData['variants'] = $variants;
                    $results[] = $productData;
                }

                return response()->json($results);
            } catch (\Exception $e) {
                \Log::error('Best sellers error: ' . $e->getMessage());
                // Safe fallback to latest products
                $products = Product::where('available', true)->latest()->limit(6)->get();
                $results = [];
                foreach ($products as $product) {
                    $variants = \Illuminate\Support\Facades\DB::table('product_sizes')
                        ->where('product_id', $product->id)
                        ->get();

                    $productData = $product->toArray();
                    $productData['variants'] = $variants;
                    $results[] = $productData;
                }
                return response()->json($results);
            }
        }

        if ($action === 'list') {
            $products = Product::where('available', true)->get();

            $results = [];
            foreach ($products as $product) {
                $variants = \Illuminate\Support\Facades\DB::table('product_sizes')
                    ->where('product_id', $product->id)
                    ->get();

                $productData = $product->toArray();
                $productData['variants'] = $variants;
                $results[] = $productData;
            }
            return response()->json($results);
        }

        return response()->json(['success' => false, 'message' => 'Invalid action'], 400);
    }

    /**
     * Get product details.
     */
    public function show($id)
    {
        $product = Product::find($id);

        if (!$product) {
            return response()->json(['success' => false, 'message' => 'Product not found'], 404);
        }

        return response()->json($product);
    }
}
