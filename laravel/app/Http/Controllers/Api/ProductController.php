<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function staffIndex(Request $request): JsonResponse
    {
        $admin = $this->requireRole($request, 'admin');
        if (!$admin instanceof \App\Models\User) {
            return $admin;
        }

        $products = Product::with(['sizes' => function ($query) {
            $query->whereRaw('LOWER(size) <> ?', ['slice']);
        }])
            ->where('available', true)
            ->whereRaw('LOWER(category) IN (?, ?)', ['cake', 'cakes'])
            ->orderBy('name')
            ->get()
            ->map(fn (Product $product) => $product->toArray())
            ->values();

        return response()->json($products);
    }

    public function index(Request $request): JsonResponse
    {
        $filterCategory = strtolower(trim((string) $request->query('category', 'cakes')));

        $query = Product::with(['sizes'])
            ->where('available', true)
            ->whereRaw('LOWER(category) IN (?, ?)', ['cake', 'cakes']);

        if ($filterCategory !== 'all' && !in_array($filterCategory, ['cake', 'cakes'], true)) {
            return response()->json(['success' => true, 'data' => []]);
        }

        $products = $query->get()->map(function (Product $product) {
            return [
                'id' => $product->id,
                'name' => $product->name,
                'category' => $product->category,
                'description' => $product->description,
                'image' => $product->image,
                'base_price' => (float) $product->price,
                'product_stock' => (int) $product->stock,
                'total_stock' => (int) $product->stock,
                'available' => (bool) $product->available,
                'sizes' => $product->sizes->map(function ($size) {
                    return [
                        'id' => $size->id,
                        'size' => $size->size,
                        'price' => (float) $size->price,
                        'available' => (bool) $size->available,
                    ];
                }),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }
}
