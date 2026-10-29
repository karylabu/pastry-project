<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AdminRecycleBinService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class AdminRecycleBinController extends Controller
{
    public function index(Request $request, AdminRecycleBinService $recycleBin): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        return response()->json(['success' => true, 'items' => $recycleBin->entries()]);
    }

    public function restore(Request $request, int $entryId, AdminRecycleBinService $recycleBin): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        try {
            $recycleBin->restore($entryId);
            return response()->json(['success' => true, 'message' => 'Item restored.']);
        } catch (RuntimeException $exception) {
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 409);
        }
    }

    public function destroy(Request $request, int $entryId, AdminRecycleBinService $recycleBin): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        try {
            $recycleBin->permanentlyDelete($entryId);
            return response()->json(['success' => true, 'message' => 'Item permanently deleted.']);
        } catch (RuntimeException $exception) {
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 409);
        }
    }

    private function authorizeAdmin(Request $request): ?JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Authentication required.'], 401);
        }
        if (strtolower((string) $user->role) !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Admin authorization required.'], 403);
        }
        return null;
    }
}
