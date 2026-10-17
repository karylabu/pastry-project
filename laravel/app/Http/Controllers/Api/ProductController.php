<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use App\Services\ProductionService;
use Throwable;

class ProductController extends Controller
{
    private function removeFailedProductImage(?string $imageName, int $productId): void
    {
        if ($imageName === null) {
            return;
        }

        $path = base_path('../uploads/' . $imageName);
        if (is_file($path) && !unlink($path)) {
            Log::warning('Unable to remove an uncommitted product image.', ['product_id' => $productId, 'image' => $imageName]);
        }
    }

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

    public function updateStaff(Request $request, Product $product): JsonResponse
    {
        $admin = $this->requireRole($request, 'admin');
        if (!$admin instanceof \App\Models\User) {
            return $admin;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'price_size' => ['nullable', 'in:small,big'],
            'price' => ['required', 'numeric', 'gt:0'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,gif', 'max:5120'],
        ]);

        $image = $request->file('image');
        $imageName = null;
        if ($image) {
            $uploadDirectory = base_path('../uploads');
            if (!is_dir($uploadDirectory) && !mkdir($uploadDirectory, 0755, true) && !is_dir($uploadDirectory)) {
                return response()->json(['success' => false, 'message' => 'Unable to create the product image directory.'], 500);
            }

            $imageName = 'p' . Str::uuid() . '.' . $image->extension();
            try {
                $image->move($uploadDirectory, $imageName);
            } catch (Throwable $exception) {
                Log::error('Product image upload failed.', ['product_id' => $product->id, 'exception' => $exception]);
                return response()->json(['success' => false, 'message' => 'Unable to save the product image.'], 500);
            }
        }

        try {
            DB::transaction(function () use ($data, $product, $imageName) {
                $priceSize = strtolower((string) ($data['price_size'] ?? ''));
                if ($priceSize !== '') {
                    $size = DB::table('product_sizes')
                        ->where('product_id', $product->id)
                        ->whereRaw('LOWER(TRIM(size)) = ?', [$priceSize])
                        ->first();

                    if (!$size) {
                        throw new \InvalidArgumentException('This cake size has no saved price row.');
                    }

                    DB::table('product_sizes')->where('id', $size->id)->update([
                        'price' => $data['price'],
                        'updated_at' => now(),
                    ]);
                }

                $product->name = $data['name'];
                $product->category = $data['category'];
                $product->description = $data['description'] ?? null;
                if ($priceSize === 'big' || $priceSize === '') {
                    $product->price = $data['price'];
                }
                if ($imageName !== null) {
                    $product->image = $imageName;
                }
                $product->save();
            });
        } catch (\InvalidArgumentException $exception) {
            $this->removeFailedProductImage($imageName, (int) $product->id);
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 422);
        } catch (Throwable $exception) {
            $this->removeFailedProductImage($imageName, (int) $product->id);
            Log::error('Product update failed.', ['product_id' => $product->id, 'exception' => $exception]);
            return response()->json(['success' => false, 'message' => 'Unable to update the product.'], 500);
        }

        return response()->json(['success' => true, 'product_id' => (int) $product->id]);
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
