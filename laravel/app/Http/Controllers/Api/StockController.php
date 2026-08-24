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
        $validated = $request->validate([
            'product_size_id' => 'required|integer|exists:product_sizes,id',
            'action_type' => 'required|string|in:stock_in,stock_out',
            'quantity' => 'required|integer|min:1',
        ]);

        $productSize = ProductSize::findOrFail($validated['product_size_id']);
        $quantity = $validated['quantity'];

        if ($validated['action_type'] === 'stock_out' && $quantity > $productSize->stock_quantity) {
            return response()->json([
                'success' => false,
                'message' => 'Not enough stock for the selected size.',
                'data' => [
                    'stock_quantity' => $productSize->stock_quantity,
                    'requested' => $quantity,
                ],
            ], 422);
        }

        try {
            DB::transaction(function () use ($productSize, $validated, $quantity) {
                if ($validated['action_type'] === 'stock_out') {
                    $productSize->stock_quantity = max(0, $productSize->stock_quantity - $quantity);
                } else {
                    $productSize->stock_quantity += $quantity;
                }

                $productSize->save();

                Product::where('id', $productSize->product_id)
                    ->update(['stock' => ProductSize::where('product_id', $productSize->product_id)->sum('stock_quantity')]);
            });
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
}
