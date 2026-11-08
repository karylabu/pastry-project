<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use App\Services\ProductionService;
use App\Services\AdminRecycleBinService;
use Throwable;

class ProductController extends Controller
{
    private function removeFailedProductImage(?string $imageName, int $productId): void
    {
        if ($imageName === null) {
            return;
        }

        foreach ([base_path('../uploads/' . $imageName), public_path('uploads/' . $imageName)] as $path) {
            if (is_file($path) && !unlink($path)) {
                Log::warning('Unable to remove an uncommitted product image.', ['product_id' => $productId, 'image' => $imageName]);
            }
        }
    }

    private function copyProductImageToCustomerUploads(string $imageName): bool
    {
        $customerUploadDirectory = public_path('uploads');
        if (!is_dir($customerUploadDirectory)
            && !mkdir($customerUploadDirectory, 0755, true)
            && !is_dir($customerUploadDirectory)) {
            return false;
        }

        return copy(base_path('../uploads/' . $imageName), $customerUploadDirectory . DIRECTORY_SEPARATOR . $imageName);
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
            ->where(function ($query) {
                $query->where('available', true)->orWhere('is_archived', true);
            })
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

    public function storeStaff(Request $request): JsonResponse
    {
        $admin = $this->requireRole($request, 'admin');
        if (!$admin instanceof \App\Models\User) {
            return $admin;
        }

        if (!Schema::hasTable('product_sizes')) {
            return response()->json([
                'success' => false,
                'message' => 'Product size storage is unavailable. Please contact support.',
            ], 500);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:100'],
            'size' => ['required_without:sizes', 'in:Small,Big'],
            'sizes' => ['required_without:size', 'array', 'min:1'],
            'sizes.*' => ['required', 'distinct', 'in:Small,Big'],
            'description' => ['nullable', 'string'],
            'price' => ['required_without:prices', 'numeric', 'gt:0'],
            'prices' => ['required_without:price', 'array'],
            'prices.*' => ['required', 'numeric', 'gt:0'],
            'stock' => ['required_without:stocks', 'integer', 'min:0'],
            'stocks' => ['required_without:stock', 'array'],
            'stocks.*' => ['required', 'integer', 'min:0'],
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,gif', 'max:5120'],
            'ingredient_id' => ['sometimes', 'array'],
            'ingredient_id.*' => ['required', 'integer', 'exists:ingredients,id'],
            'ingredient_qty' => ['sometimes', 'array'],
            'ingredient_qty.*' => ['required', 'numeric', 'gt:0'],
        ]);

        if (count($data['ingredient_id'] ?? []) !== count($data['ingredient_qty'] ?? [])) {
            return response()->json([
                'success' => false,
                'message' => 'Check that every recipe ingredient has a quantity.',
            ], 422);
        }

        $sizeVariants = [];
        foreach ($data['sizes'] ?? [$data['size']] as $size) {
            $price = $data['prices'][$size] ?? $data['price'] ?? null;
            $stock = $data['stocks'][$size] ?? $data['stock'] ?? null;
            if (!is_numeric($price) || (float) $price <= 0 || filter_var($stock, FILTER_VALIDATE_INT) === false || (int) $stock < 0) {
                return response()->json([
                    'success' => false,
                    'message' => "Enter a valid price and starting stock for the {$size} Cake size.",
                ], 422);
            }

            $sizeVariants[] = ['size' => $size, 'price' => $price, 'stock' => (int) $stock];
        }

        $uploadDirectory = base_path('../uploads');
        if (!is_dir($uploadDirectory) && !mkdir($uploadDirectory, 0755, true) && !is_dir($uploadDirectory)) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to prepare image storage. Please try again later.',
            ], 500);
        }

        $image = $request->file('image');
        $imageName = 'p' . Str::uuid() . '.' . $image->extension();
        try {
            $image->move($uploadDirectory, $imageName);
        } catch (Throwable $exception) {
            Log::error('Product image upload failed.', ['exception' => $exception]);
            return response()->json([
                'success' => false,
                'message' => 'Unable to save the product image. Please choose another image and try again.',
            ], 500);
        }
        if (!$this->copyProductImageToCustomerUploads($imageName)) {
            $this->removeFailedProductImage($imageName, 0);
            Log::error('Product image could not be copied to customer-facing storage.', ['image' => $imageName]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to make the product image available to customers. Please try again.',
            ], 500);
        }

        try {
            $productId = DB::transaction(function () use ($data, $imageName, $sizeVariants) {
                $now = now();
                $baseVariant = collect($sizeVariants)->firstWhere('size', 'Big') ?? $sizeVariants[0];
                $productAttributes = [
                    'name' => trim($data['name']),
                    'category' => trim($data['category']),
                    'price' => $baseVariant['price'],
                    'big_price' => $baseVariant['price'],
                    'stock' => array_sum(array_column($sizeVariants, 'stock')),
                    'image' => $imageName,
                    'description' => trim((string) ($data['description'] ?? '')) ?: null,
                    'available' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                $productAttributes = array_filter(
                    $productAttributes,
                    fn ($value, $column) => Schema::hasColumn('products', $column),
                    ARRAY_FILTER_USE_BOTH
                );
                $productId = (int) DB::table('products')->insertGetId($productAttributes);

                foreach ($sizeVariants as $variant) {
                    $sizeAttributes = [
                        'product_id' => $productId,
                        'size' => $variant['size'],
                        'price' => $variant['price'],
                        'stock_quantity' => $variant['stock'],
                        'available' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                    $sizeAttributes = array_filter(
                        $sizeAttributes,
                        fn ($value, $column) => Schema::hasColumn('product_sizes', $column),
                        ARRAY_FILTER_USE_BOTH
                    );
                    $sizeId = (int) DB::table('product_sizes')->insertGetId($sizeAttributes);

                    if (Schema::hasTable('product_recipes')) {
                        foreach ($data['ingredient_id'] ?? [] as $index => $ingredientId) {
                            $recipeAttributes = [
                                'product_id' => $productId,
                                'product_size_id' => $sizeId,
                                'ingredient_id' => (int) $ingredientId,
                                'qty' => $data['ingredient_qty'][$index],
                                'active' => true,
                                'created_at' => $now,
                                'updated_at' => $now,
                            ];
                            $recipeAttributes = array_filter(
                                $recipeAttributes,
                                fn ($value, $column) => Schema::hasColumn('product_recipes', $column),
                                ARRAY_FILTER_USE_BOTH
                            );
                            DB::table('product_recipes')->insert($recipeAttributes);
                        }
                    }
                }

                return $productId;
            });
        } catch (Throwable $exception) {
            $this->removeFailedProductImage($imageName, 0);
            Log::error('Product creation failed.', ['exception' => $exception]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to add the product. Please review the details and try again.',
            ], 500);
        }

        app(\App\Services\RealtimeEventPublisher::class)->inventoryUpdated();

        return response()->json([
            'success' => true,
            'product_id' => $productId,
            'message' => 'Product added to the customer menu.',
        ], 201);
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
            if (!$this->copyProductImageToCustomerUploads($imageName)) {
                $this->removeFailedProductImage($imageName, (int) $product->id);
                Log::error('Updated product image could not be copied to customer-facing storage.', [
                    'product_id' => $product->id,
                    'image' => $imageName,
                ]);

                return response()->json(['success' => false, 'message' => 'Unable to make the product image available to customers.'], 500);
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

    public function storeSizeStaff(Request $request, Product $product): JsonResponse
    {
        $admin = $this->requireRole($request, 'admin');
        if (!$admin instanceof \App\Models\User) {
            return $admin;
        }

        $data = $request->validate([
            'size' => ['required', 'string', 'max:100'],
            'price' => ['nullable', 'numeric', 'gt:0'],
            'stock' => ['required', 'integer', 'min:0'],
        ]);
        $sizeName = trim($data['size']);
        if ($sizeName === '') {
            return response()->json(['success' => false, 'message' => 'Enter a cake size.'], 422);
        }

        try {
            DB::transaction(function () use ($data, $product, $sizeName) {
                $existingSize = DB::table('product_sizes')
                    ->where('product_id', $product->id)
                    ->whereRaw('LOWER(TRIM(size)) = ?', [strtolower($sizeName)])
                    ->exists();
                if ($existingSize) {
                    throw new \InvalidArgumentException("The {$sizeName} size already exists for this cake.");
                }

                $price = $data['price'] ?? null;
                if ($price === null) {
                    $recordedPrices = DB::table('product_sizes')
                        ->join('products', 'products.id', '=', 'product_sizes.product_id')
                        ->whereRaw('LOWER(TRIM(products.category)) IN (?, ?)', ['cake', 'cakes'])
                        ->whereRaw('LOWER(TRIM(product_sizes.size)) = ?', [strtolower($sizeName)])
                        ->distinct()
                        ->pluck('product_sizes.price')
                        ->map(fn ($recordedPrice) => number_format((float) $recordedPrice, 2, '.', ''))
                        ->unique()
                        ->values();

                    if ($recordedPrices->count() !== 1) {
                        throw new \InvalidArgumentException(
                            $recordedPrices->isEmpty()
                                ? 'Enter a price for this size; no recorded price was found.'
                                : 'Enter a price for this size; recorded prices are not consistent.'
                        );
                    }
                    $price = $recordedPrices->first();
                }

                $sizeAttributes = [
                    'product_id' => $product->id,
                    'size' => $sizeName,
                    'price' => $price,
                    'stock_quantity' => (int) $data['stock'],
                    'available' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
                $sizeAttributes = array_filter(
                    $sizeAttributes,
                    fn ($value, $column) => Schema::hasColumn('product_sizes', $column),
                    ARRAY_FILTER_USE_BOTH
                );
                DB::table('product_sizes')->insert($sizeAttributes);

                if (strtolower($sizeName) === 'big') {
                    $product->price = $price;
                }
                if (Schema::hasColumn('products', 'stock')) {
                    $product->stock = (int) DB::table('product_sizes')
                        ->where('product_id', $product->id)
                        ->whereRaw('LOWER(TRIM(size)) <> ?', ['slice'])
                        ->sum('stock_quantity');
                }
                $product->save();
            });
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 422);
        } catch (Throwable $exception) {
            Log::error('Cake size could not be added.', ['product_id' => $product->id, 'exception' => $exception]);
            return response()->json(['success' => false, 'message' => 'Unable to add the cake size.'], 500);
        }

        app(\App\Services\RealtimeEventPublisher::class)->inventoryUpdated();

        return response()->json([
            'success' => true,
            'product_id' => (int) $product->id,
            'size' => $sizeName,
        ], 201);
    }

    public function destroySizeStaff(Request $request, Product $product, int $size): JsonResponse
    {
        $admin = $this->requireRole($request, 'admin');
        if (!$admin instanceof \App\Models\User) {
            return $admin;
        }

        $productSize = DB::table('product_sizes')
            ->where('product_id', $product->id)
            ->where('id', $size)
            ->first();
        if (!$productSize) {
            return response()->json(['success' => false, 'message' => 'This size was not found for the selected cake.'], 404);
        }
        if ((int) ($productSize->stock_quantity ?? 0) > 0) {
            return response()->json([
                'success' => false,
                'message' => 'This size still has stock. Adjust its stock to zero before removing it.',
            ], 409);
        }

        try {
            DB::transaction(function () use ($product, $productSize) {
                $references = [
                    ['product_recipes', 'product_size_id', 'a saved recipe'],
                    ['order_items', 'product_size_id', 'an order'],
                    ['product_inventory_movements', 'product_size_id', 'stock history'],
                    ['production_transactions', 'product_size_id', 'production history'],
                ];
                foreach ($references as [$table, $column, $description]) {
                    if (Schema::hasTable($table)
                        && Schema::hasColumn($table, $column)
                        && DB::table($table)->where($column, $productSize->id)->exists()) {
                        throw new \InvalidArgumentException("This size is used by {$description} and cannot be removed.");
                    }
                }

                $remainingSizes = DB::table('product_sizes')
                    ->where('product_id', $product->id)
                    ->where('id', '<>', $productSize->id)
                    ->orderBy('id')
                    ->get();
                if ($remainingSizes->isEmpty()) {
                    throw new \InvalidArgumentException('A cake must keep at least one size.');
                }

                DB::table('product_sizes')->where('id', $productSize->id)->delete();

                if (strtolower(trim((string) $productSize->size)) === 'big') {
                    $replacementBigSize = $remainingSizes->first(
                        fn ($remainingSize) => strtolower(trim((string) $remainingSize->size)) === 'big'
                    ) ?? $remainingSizes->first();
                    $product->price = $replacementBigSize->price;
                }
                if (Schema::hasColumn('products', 'stock')) {
                    $product->stock = (int) DB::table('product_sizes')
                        ->where('product_id', $product->id)
                        ->whereRaw('LOWER(TRIM(size)) <> ?', ['slice'])
                        ->sum('stock_quantity');
                }
                $product->save();
            });
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 409);
        } catch (Throwable $exception) {
            Log::error('Cake size could not be removed.', [
                'product_id' => $product->id,
                'product_size_id' => $productSize->id,
                'exception' => $exception,
            ]);
            return response()->json(['success' => false, 'message' => 'Unable to remove the cake size.'], 500);
        }

        app(\App\Services\RealtimeEventPublisher::class)->inventoryUpdated();

        return response()->json([
            'success' => true,
            'product_id' => (int) $product->id,
            'product_size_id' => (int) $productSize->id,
        ]);
    }

    public function updateSizeArchiveStaff(Request $request, Product $product, int $size): JsonResponse
    {
        $admin = $this->requireRole($request, 'admin');
        if (!$admin instanceof \App\Models\User) {
            return $admin;
        }

        $data = $request->validate([
            'is_archived' => ['required', 'boolean'],
        ]);
        $productSize = DB::table('product_sizes')
            ->where('product_id', $product->id)
            ->where('id', $size)
            ->first();

        if (!$productSize) {
            return response()->json(['success' => false, 'message' => 'This size was not found for the selected cake.'], 404);
        }

        DB::table('product_sizes')
            ->where('product_id', $product->id)
            ->where('id', $size)
            ->update([
                'is_archived' => (bool) $data['is_archived'],
                'updated_at' => now(),
            ]);

        app(\App\Services\RealtimeEventPublisher::class)->inventoryUpdated();

        return response()->json([
            'success' => true,
            'product_id' => (int) $product->id,
            'product_size_id' => (int) $productSize->id,
            'is_archived' => (bool) $data['is_archived'],
        ]);
    }

    public function updateArchiveStaff(Request $request, Product $product): JsonResponse
    {
        $admin = $this->requireRole($request, 'admin');
        if (!$admin instanceof \App\Models\User) {
            return $admin;
        }

        $data = $request->validate([
            'is_archived' => ['required', 'boolean'],
        ]);

        $product->is_archived = (bool) $data['is_archived'];
        $product->save();

        return response()->json([
            'success' => true,
            'product_id' => (int) $product->id,
            'is_archived' => $product->is_archived,
        ]);
    }

    public function destroyStaff(Request $request, Product $product, AdminRecycleBinService $recycleBin): JsonResponse
    {
        $admin = $this->requireRole($request, 'admin');
        if (!$admin instanceof \App\Models\User) {
            return $admin;
        }

        try {
            $entryId = $recycleBin->trashProduct((int) $product->id);
            return response()->json([
                'success' => true,
                'message' => 'Product moved to the Recycle Bin for 30 days.',
                'recycle_bin_entry_id' => $entryId,
            ]);
        } catch (Throwable $exception) {
            Log::error('Product could not be moved to the Recycle Bin.', [
                'product_id' => $product->id,
                'exception' => $exception,
            ]);
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 409);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $filterCategory = strtolower(trim((string) $request->query('category', 'cakes')));

        $query = Product::query()
            ->where('available', true)
            ->where('is_archived', false)
            ->whereRaw('LOWER(category) IN (?, ?)', ['cake', 'cakes']);

        if ($filterCategory !== 'all' && !in_array($filterCategory, ['cake', 'cakes'], true)) {
            return response()->json(['success' => true, 'data' => []]);
        }

        $products = $query->with(['sizes' => function ($sizes) {
            if (Schema::hasColumn('product_sizes', 'is_archived')) {
                $sizes->where('is_archived', false);
            }
        }])->get()->map(function (Product $product) {
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
        })->filter(fn (array $product) => $product['sizes']->isNotEmpty());

        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }
}
