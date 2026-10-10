<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\ProductionService;

class ProductController extends Controller
{
    public function staffIndex(Request $request, ProductionService $production): JsonResponse
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
            ->map(function (Product $product) use ($production) {
                $sizes = $product->sizes->map(function ($size) use ($product, $production) {
                    return array_merge(
                        $size->toArray(),
                        $production->checkAvailability($product, (int) $size->id)
                    );
                });
                $defaultSize = $sizes->first(fn ($size) => strtolower(trim((string) $size['size'])) === 'big' && $size['available'])
                    ?? $sizes->first(fn ($size) => $size['available']);
                $availability = $defaultSize
                    ? [
                        'is_producible' => $defaultSize['is_producible'],
                        'availability_reason' => $defaultSize['availability_reason'],
                    ]
                    : ['is_producible' => false, 'availability_reason' => 'No available cake size is configured.'];

                return array_merge($product->toArray(), $availability, [
                    'sizes' => $sizes->values(),
                    'production_size_id' => $defaultSize ? (int) $defaultSize['id'] : null,
                ]);
            })
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
