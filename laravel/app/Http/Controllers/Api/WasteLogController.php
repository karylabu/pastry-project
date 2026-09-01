<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateWasteRequest;
use App\Models\Ingredient;
use App\Models\WasteLog;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class WasteLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizeStaff($request)) return $response;

        $entries = WasteLog::query()->with(['ingredient:id,name,unit', 'batch:id,batch_number'])
            ->where('item_type', 'Raw Material')->orderByDesc('datetime')->get()
            ->map(fn (WasteLog $waste) => [
                'id' => (int) $waste->id, 'datetime' => $waste->datetime,
                'item' => $waste->item, 'qty' => (float) $waste->qty,
                'unit_cost' => (float) $waste->unit_cost,
                'cost' => round((float) $waste->qty * (float) $waste->unit_cost, 2),
                'type' => $waste->item_type, 'reason' => $waste->reason,
                'ingredient_id' => $waste->ingredient_id, 'ingredient_batch_id' => $waste->ingredient_batch_id,
            ]);

        return response()->json(['success' => true, 'entries' => $entries]);
    }

    public function catalogue(Request $request, InventoryService $inventory): JsonResponse
    {
        if ($response = $this->authorizeStaff($request)) return $response;
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
        if ($response = $this->authorizeStaff($request)) return $response;
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

    private function authorizeStaff(Request $request): ?JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) return response()->json(['success' => false, 'message' => 'Staff authorization required.'], 401);
        if (!in_array(strtolower((string) $user->role), ['staff', 'manager', 'admin'], true)) return response()->json(['success' => false, 'message' => 'Staff authorization required.'], 403);
        return null;
    }
}
