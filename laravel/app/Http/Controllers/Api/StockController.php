<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductSize;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockController extends Controller
{
    public function mutate(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'product_size_id' => 'required|integer|exists:product_sizes,id',
            'action_type' => 'required|string|in:stock_in,stock_out',
            'quantity' => 'required|integer|min:1',
            'reason' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:150',
        ]);

        $quantity = $validated['quantity'];
        $isStockOut = $validated['action_type'] === 'stock_out';
        $user = $this->getAuthenticatedUser($request);

        try {
            $productSize = DB::transaction(function () use ($validated, $quantity, $isStockOut, $user) {
                $productSize = ProductSize::query()
                    ->whereKey($validated['product_size_id'])
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($isStockOut && $quantity > $productSize->stock_quantity) {
                    return null;
                }

                $previousStock = (int) $productSize->stock_quantity;
                $productSize->stock_quantity = $isStockOut
                    ? $previousStock - $quantity
                    : $previousStock + $quantity;
                $productSize->save();

                $totalStock = (int) ProductSize::query()
                    ->where('product_id', $productSize->product_id)
                    ->sum('stock_quantity');

                Product::whereKey($productSize->product_id)->update(['stock' => $totalStock]);

                $reason = trim(implode(' - ', array_filter([
                    $validated['reason'] ?? null,
                    $validated['notes'] ?? null,
                ])));
                DB::table('product_inventory_movements')->insert([
                    'product_id' => $productSize->product_id,
                    'product_size_id' => $productSize->id,
                    'movement_type' => $isStockOut ? 'Stock Out' : 'Stock In',
                    'quantity' => $isStockOut ? -$quantity : $quantity,
                    'previous_stock' => $previousStock,
                    'new_stock' => (int) $productSize->stock_quantity,
                    'reason' => $reason !== '' ? $reason : 'Manual stock adjustment',
                    'reference_type' => 'adjustment',
                    'reference_id' => null,
                    'user_id' => $user?->id,
                    'created_at' => now(),
                ]);

                return $productSize;
            });

            if (!$productSize) {
                $currentStock = (int) ProductSize::query()
                    ->whereKey($validated['product_size_id'])
                    ->value('stock_quantity');
                return response()->json([
                    'success' => false,
                    'message' => 'Not enough stock for the selected size.',
                    'data' => [
                        'stock_quantity' => $currentStock,
                        'requested' => $quantity,
                    ],
                ], 422);
            }
        } catch (QueryException $exception) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update stock. Please try again.',
                'error' => $exception->getMessage(),
            ], 500);
        }

        $productSize->refresh();

        return response()->json([
            'success' => true,
            'message' => 'Stock updated successfully.',
            'data' => [
                'product_size' => [
                    'id' => $productSize->id,
                    'product_id' => $productSize->product_id,
                    'size' => $productSize->size,
                    'price' => (float) $productSize->price,
                    'stock_quantity' => (int) $productSize->stock_quantity,
                    'threshold' => (int) $productSize->threshold,
                    'available' => $productSize->stock_quantity > 0,
                ],
                'total_product_stock' => ProductSize::where('product_id', $productSize->product_id)->sum('stock_quantity'),
            ],
        ]);
    }

    private function authorizeAdmin(Request $request): ?JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Admin authorization required.'], 401);
        }
        if ($user->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Admin authorization required.'], 403);
        }
        return null;
    }
}
