<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductSize;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockController extends Controller
{
    public function history(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        try {
            $validated = $request->validate([
                'product_id' => 'required|integer|exists:products,id',
                'product_size_id' => 'nullable|integer|exists:product_sizes,id',
                'user_id' => 'nullable|integer|exists:users,id',
                'movement_type' => 'nullable|string|max:40',
                'from' => 'nullable|date_format:Y-m-d',
                'to' => 'nullable|date_format:Y-m-d|after_or_equal:from',
                'page' => 'nullable|integer|min:1',
                'per_page' => 'nullable|integer|min:1|max:100',
            ]);
        } catch (ValidationException $exception) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid stock history filters.',
                'errors' => $exception->errors(),
            ], 422);
        }

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 25);
        $query = DB::table('product_inventory_movements as m')
            ->join('products as p', 'p.id', '=', 'm.product_id')
            ->leftJoin('users as u', 'u.id', '=', 'm.user_id')
            ->where('m.product_id', $validated['product_id']);

        if (!empty($validated['product_size_id'])) {
            $query->where('m.product_size_id', $validated['product_size_id']);
        }
        if (!empty($validated['user_id'])) {
            $query->where('m.user_id', $validated['user_id']);
        }
        if (!empty($validated['movement_type'])) {
            $query->where('m.movement_type', $validated['movement_type']);
        }
        if (!empty($validated['from'])) {
            $query->where('m.created_at', '>=', $validated['from'] . ' 00:00:00');
        }
        if (!empty($validated['to'])) {
            $query->where('m.created_at', '<=', $validated['to'] . ' 23:59:59');
        }

        $total = (clone $query)->count('m.id');
        $history = $query
            ->select([
                'm.id as movement_id',
                'm.product_id',
                'm.product_size_id',
                'p.name as product_name',
                'm.movement_type',
                'm.quantity',
                'm.previous_stock',
                'm.new_stock',
                'm.reason',
                'm.reference_type',
                'm.reference_id',
                'm.created_at',
                'u.name as staff_name',
            ])
            ->orderByDesc('m.created_at')
            ->orderByDesc('m.id')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get()
            ->map(static fn ($row) => [
                'movement_id' => (int) $row->movement_id,
                'product_id' => (int) $row->product_id,
                'product_size_id' => $row->product_size_id === null ? null : (int) $row->product_size_id,
                'product_name' => $row->product_name,
                'movement_type' => $row->movement_type,
                'quantity' => (float) $row->quantity,
                'previous_stock' => (float) $row->previous_stock,
                'new_stock' => (float) $row->new_stock,
                'reason' => $row->reason,
                'reference_type' => $row->reference_type,
                'reference_id' => $row->reference_id === null ? null : (int) $row->reference_id,
                'staff' => $row->staff_name ?: 'System',
                'created_at' => $row->created_at,
            ]);

        return response()->json([
            'success' => true,
            'history' => $history,
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => (int) ceil($total / $perPage),
            ],
        ]);
    }

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
