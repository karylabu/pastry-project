<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateWasteRequest;
use App\Models\Ingredient;
use App\Models\WasteLog;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class WasteLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizeOperationalStaff($request)) return $response;

        $wastes = WasteLog::query()->with(['ingredient:id,name,unit', 'batch:id,batch_number'])
            ->orderByDesc('datetime')->get();
        $orderWasteIds = $wastes
            ->where('reference_type', 'order_waste')
            ->pluck('reference_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
        $orderItemNames = $this->orderWasteItemNames($orderWasteIds);

        $entries = $wastes->map(fn (WasteLog $waste) => [
                'id' => (int) $waste->id, 'datetime' => $waste->datetime,
                'item' => $waste->reference_type === 'order_waste'
                    ? ($orderItemNames[$waste->reference_id] ?? $waste->item)
                    : $waste->item,
                'qty' => (float) $waste->qty,
                'unit_cost' => (float) $waste->unit_cost,
                'cost' => round((float) $waste->qty * (float) $waste->unit_cost, 2),
                'type' => $waste->item_type, 'reason' => $waste->reason,
                'unit' => $waste->reference_type === 'order_waste'
                    ? 'order'
                    : ($waste->ingredient?->unit ?? ($waste->item_type === 'Finished Product' ? 'pcs' : 'kg')),
                'ingredient_id' => $waste->ingredient_id, 'ingredient_batch_id' => $waste->ingredient_batch_id,
                'reference_type' => $waste->reference_type, 'reference_id' => $waste->reference_id,
            ]);

        return response()->json(['success' => true, 'entries' => $entries]);
    }

    public function catalogue(Request $request, InventoryService $inventory): JsonResponse
    {
        if ($response = $this->authorizeOperationalStaff($request)) return $response;
        $items = Ingredient::query()->with('batches.discardRequests')->orderBy('name')->get()->map(function (Ingredient $ingredient) use ($inventory) {
            return $ingredient->batches->map(fn ($batch) => [
                'id' => (int) $ingredient->id,
                'batch_id' => (int) $batch->id,
                'name' => $ingredient->name,
                'unit' => $ingredient->unit,
                'unit_cost' => (float) $batch->unit_cost,
                'type' => 'Raw Material',
                'batch_number' => $batch->batch_number,
                'quantity_remaining' => (float) $batch->quantity_remaining,
                'expiry_date' => $batch->expiry_date?->toDateString(),
                'status' => $inventory->batchStatus($batch),
            ]);
        })->flatten(1)->values();

        return response()->json(['success' => true, 'items' => $items]);
    }

    public function store(CreateWasteRequest $request, InventoryService $inventory): JsonResponse
    {
        if ($response = $this->authorizeOperationalStaff($request)) return $response;
        try {
            $user = $this->getAuthenticatedUser($request);
            $waste = $inventory->recordWaste($request->validated(), (int) $user->id);
            return response()->json(['success' => true, 'entry' => [
                'id' => $waste->id, 'datetime' => $waste->datetime, 'item' => $waste->item,
                'qty' => (float) $waste->qty, 'unit_cost' => (float) $waste->unit_cost,
                'cost' => round((float) $waste->qty * (float) $waste->unit_cost, 2),
                'type' => $waste->item_type, 'reason' => $waste->reason,
            ]]);
        } catch (Throwable $exception) {
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 409);
        }
    }

    public function storeOrderWaste(Request $request, int $orderId): JsonResponse
    {
        $user = $this->requireRole($request, 'admin');
        if ($user instanceof JsonResponse) {
            return $user;
        }
        if (!Schema::hasTable('waste_log')) {
            return response()->json(['success' => false, 'message' => 'Waste tracking is unavailable.'], 503);
        }

        try {
            $waste = DB::transaction(function () use ($orderId, $user) {
                $order = DB::table('orders')->where('id', $orderId)->lockForUpdate()->first(['id', 'total']);
                if (!$order) {
                    abort(404, 'Order not found.');
                }

                $existing = DB::table('waste_log')
                    ->where('reference_type', 'order_waste')
                    ->where('reference_id', $orderId)
                    ->first();
                if ($existing) {
                    return ['record' => $existing, 'already_recorded' => true];
                }

                $total = round((float) $order->total, 2);
                if ($total <= 0) {
                    abort(422, 'An order with a zero total cannot be recorded as financial loss.');
                }

                $itemName = $this->orderWasteItemNames([$orderId])[$orderId] ?? "Order #{$orderId}";
                $now = now();
                $wasteId = DB::table('waste_log')->insertGetId([
                    'datetime' => $now,
                    'item' => $itemName,
                    'qty' => 1,
                    'unit_cost' => $total,
                    'item_type' => 'Finished Product',
                    'reason' => 'unsold',
                    'user_id' => $user->id,
                    'reference_type' => 'order_waste',
                    'reference_id' => $orderId,
                    'unit' => 'order',
                    'idempotency_key' => "order-waste:{$orderId}",
                    'created_at' => $now,
                ]);

                return [
                    'record' => DB::table('waste_log')->where('id', $wasteId)->first(),
                    'already_recorded' => false,
                ];
            });

            $record = $waste['record'];
            return response()->json([
                'success' => true,
                'already_recorded' => $waste['already_recorded'],
                'entry' => [
                    'id' => (int) $record->id,
                    'item' => $record->item,
                    'qty' => (float) $record->qty,
                    'unit_cost' => (float) $record->unit_cost,
                    'cost' => round((float) $record->qty * (float) $record->unit_cost, 2),
                    'type' => $record->item_type,
                    'reason' => $record->reason,
                    'unit' => 'order',
                    'reference_type' => $record->reference_type,
                    'reference_id' => (int) $record->reference_id,
                ],
            ]);
        } catch (Throwable $exception) {
            if ($exception instanceof HttpExceptionInterface) {
                return response()->json([
                    'success' => false,
                    'message' => $exception->getMessage(),
                ], $exception->getStatusCode());
            }

            report($exception);
            return response()->json(['success' => false, 'message' => 'Unable to record order waste.'], 500);
        }
    }

    private function orderWasteItemNames(array $orderIds): array
    {
        if ($orderIds === []) {
            return [];
        }

        $itemNames = [];
        if (Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'product')) {
            $columns = ['order_id', 'product'];
            if (Schema::hasColumn('order_items', 'qty')) {
                $columns[] = 'qty';
            }

            foreach (DB::table('order_items')->whereIn('order_id', $orderIds)->get($columns) as $item) {
                $name = trim((string) ($item->product ?? ''));
                if ($name === '') {
                    continue;
                }
                $quantity = max(1, (int) ($item->qty ?? 1));
                $itemNames[$item->order_id][] = $quantity > 1 ? "{$name} x{$quantity}" : $name;
            }
        }

        $missingIds = array_values(array_diff($orderIds, array_map('intval', array_keys($itemNames))));
        if ($missingIds !== [] && Schema::hasTable('orders') && Schema::hasColumn('orders', 'items')) {
            foreach (DB::table('orders')->whereIn('id', $missingIds)->get(['id', 'items']) as $order) {
                $items = json_decode((string) $order->items, true);
                if (!is_array($items)) {
                    continue;
                }

                foreach ($items as $item) {
                    if (!is_array($item)) {
                        continue;
                    }
                    $name = trim((string) ($item['name'] ?? $item['product'] ?? ''));
                    if ($name === '') {
                        continue;
                    }
                    $quantity = max(1, (int) ($item['qty'] ?? $item['quantity'] ?? 1));
                    $itemNames[$order->id][] = $quantity > 1 ? "{$name} x{$quantity}" : $name;
                }
            }
        }

        return array_map(
            static fn (array $names): string => implode(', ', $names),
            $itemNames
        );
    }
}
