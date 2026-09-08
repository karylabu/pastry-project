<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CakeSalesAnalytics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class CakeSalesAnalyticsController extends Controller
{
    public function index(Request $request, CakeSalesAnalytics $analytics): JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Admin authorization required.'], 401);
        }
        if ($user->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Admin authorization required.'], 403);
        }

        try {
            $report = $analytics->report([
                'start_date' => $request->query('start_date'),
                'end_date' => $request->query('end_date'),
                'preset' => $request->query('preset'),
            ]);

            return response()->json(['success' => true] + $report);
        } catch (Throwable $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage() ?: 'Unable to load cake sales analytics.',
            ], 422);
        }
    }
}
