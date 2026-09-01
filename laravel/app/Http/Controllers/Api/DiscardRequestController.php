<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ApproveDiscardRequest;
use App\Http\Requests\CreateDiscardRequest;
use App\Http\Requests\RejectDiscardRequest;
use App\Models\DiscardRequest;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class DiscardRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($response = $this->authorizeStaff($request)) return $response;
        $status = $request->query('status', 'Pending');
        if (!in_array($status, ['Pending', 'Approved', 'Rejected'], true)) {
            return response()->json(['success' => false, 'message' => 'Invalid status.'], 422);
        }

        $requests = DiscardRequest::query()
            ->with(['ingredient:id,name,unit', 'ingredientBatch:id,batch_number,expiry_date,quantity_remaining', 'requestedBy:id,name', 'approvedBy:id,name', 'rejectedBy:id,name'])
            ->where('status', $status)
            ->orderByDesc('requested_at')
            ->get()
            ->map(fn (DiscardRequest $discard) => [
                'id' => (int) $discard->id,
                'ingredient_id' => (int) $discard->ingredient_id,
                'ingredient_batch_id' => (int) $discard->ingredient_batch_id,
                'ingredient_name' => $discard->ingredient?->name,
                'unit' => $discard->ingredient?->unit,
                'batch_number' => $discard->ingredientBatch?->batch_number,
                'expiry_date' => $discard->ingredientBatch?->expiry_date?->toDateString(),
                'quantity_remaining' => (float) ($discard->ingredientBatch?->quantity_remaining ?? 0),
                'quantity' => (float) $discard->quantity,
                'reason' => $discard->reason,
                'notes' => $discard->notes,
                'status' => $discard->status,
                'requested_by_name' => $discard->requestedBy?->name,
                'approved_by_name' => $discard->approvedBy?->name,
                'rejected_by_name' => $discard->rejectedBy?->name,
                'requested_at' => $discard->requested_at,
                'approved_at' => $discard->approved_at,
                'rejected_at' => $discard->rejected_at,
            ]);

        return response()->json(['success' => true, 'requests' => $requests]);
    }

    public function store(CreateDiscardRequest $request, InventoryService $inventory): JsonResponse
    {
        if ($response = $this->authorizeStaff($request)) return $response;
        try {
            $user = $this->getAuthenticatedUser($request);
            $discard = $inventory->createDiscardRequest($request->validated(), (int) $user->id);
            return response()->json(['success' => true, 'message' => 'Discard request submitted.', 'request_id' => $discard->id, 'request' => $discard], 201);
        } catch (Throwable $exception) {
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 409);
        }
    }

    public function approve(ApproveDiscardRequest $request, DiscardRequest $discard, InventoryService $inventory): JsonResponse
    {
        if ($response = $this->authorizeManager($request)) return $response;
        try {
            $user = $this->getAuthenticatedUser($request);
            $updated = $inventory->approveDiscard((int) $discard->id, (int) $user->id);
            return response()->json(['success' => true, 'message' => 'Discard approved and recorded.', 'request' => $updated]);
        } catch (Throwable $exception) {
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 409);
        }
    }

    public function reject(RejectDiscardRequest $request, DiscardRequest $discard, InventoryService $inventory): JsonResponse
    {
        if ($response = $this->authorizeManager($request)) return $response;
        try {
            $user = $this->getAuthenticatedUser($request);
            $updated = $inventory->rejectDiscard((int) $discard->id, (int) $user->id, $request->validated()['rejection_note'] ?? null);
            return response()->json(['success' => true, 'message' => 'Discard request rejected.', 'request' => $updated]);
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

    private function authorizeManager(Request $request): ?JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) return response()->json(['success' => false, 'message' => 'Authentication required.'], 401);
        if (!in_array(strtolower((string) $user->role), ['manager', 'admin'], true)) return response()->json(['success' => false, 'message' => 'Manager authorization required.'], 403);
        return null;
    }
}
