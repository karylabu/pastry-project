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

        $singleOrderWasteIds = $wastes
            ->where('reference_type', 'order_waste')
            ->groupBy('reference_id')
            ->filter(fn ($rows) => $rows->count() === 1)
            ->keys()
            ->all();
        $legacyOrderLines = collect();
        if ($singleOrderWasteIds !== []
            && Schema::hasTable('order_items')
            && Schema::hasColumn('order_items', 'order_id')
            && Schema::hasColumn('order_items', 'product')
            && Schema::hasColumn('order_items', 'qty')
            && Schema::hasColumn('order_items', 'price')) {
            $legacyOrderLines = DB::table('order_items')
                ->whereIn('order_id', $singleOrderWasteIds)
                ->get(['order_id', 'product', 'qty', 'price'])
                ->groupBy('order_id');
        }

        $entries = $wastes->flatMap(function (WasteLog $waste) use ($legacyOrderLines) {
            $lines = $waste->reference_type === 'order_waste'
                ? $legacyOrderLines->get($waste->reference_id, collect())
                : collect();
            $canExpandLegacyOrder = $lines->count() > 1
                && $lines->every(fn ($line) => trim((string) $line->product) !== '' && $line->price !== null);
            $entry = [
                'id' => (int) $waste->id, 'datetime' => $waste->datetime,
                'item' => $waste->item,
                'qty' => (float) $waste->qty,
                'unit_cost' => (float) $waste->unit_cost,
                'cost' => round((float) $waste->qty * (float) $waste->unit_cost, 2),
                'type' => $waste->item_type, 'reason' => $waste->reason,
                'unit' => $waste->unit
                    ?? ($waste->reference_type === 'order_waste'
                        ? 'order'
                        : ($waste->ingredient?->unit ?? ($waste->item_type === 'Finished Product' ? 'pcs' : 'kg'))),
                'ingredient_id' => $waste->ingredient_id, 'ingredient_batch_id' => $waste->ingredient_batch_id,
                'reference_type' => $waste->reference_type, 'reference_id' => $waste->reference_id,
            ];

            if (!$canExpandLegacyOrder) {
                return [$entry];
            }

            return $lines->values()->map(fn ($line, $index) => array_replace($entry, [
                'id' => "legacy-{$waste->id}-{$index}",
                'item' => trim((string) $line->product),
                'qty' => (float) max(1, (int) $line->qty),
                'unit_cost' => (float) $line->price,
                'cost' => round(max(1, (int) $line->qty) * (float) $line->price, 2),
                'unit' => 'pcs',
            ]));
        })->values();

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

    public function storeOrderWaste(Request $request, int $orderId, \App\Services\OrderWasteService $orderWaste): JsonResponse
    {
        $user = $this->requireRole($request, 'admin');
        if ($user instanceof JsonResponse) {
            return $user;
        }

        try {
            $waste = $orderWaste->record($orderId, (int) $user->id, 'Unclaimed order');

            $record = $waste['record'];
            return response()->json([
                'success' => true,
                'already_recorded' => $waste['already_recorded'],
                'entry' => [
                    'id' => (int) $record->id,
                    'datetime' => $record->datetime,
                    'item' => $record->item,
                    'qty' => (float) $record->qty,
                    'unit_cost' => (float) $record->unit_cost,
                    'cost' => round((float) $record->qty * (float) $record->unit_cost, 2),
                    'type' => $record->item_type,
                    'reason' => $record->reason,
                    'unit' => $record->unit ?? 'order',
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

}
