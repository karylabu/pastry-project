<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class OrderFeedbackController extends Controller
{
    public function publicIndex(Request $request): JsonResponse
    {
        if (!Schema::hasTable('order_feedback')) {
            return response()->json([
                'success' => true,
                'reviews' => [],
                'average_rating' => 0,
                'total_reviews' => 0,
            ]);
        }

        $query = DB::table('order_feedback as feedback')
            ->leftJoin('users', 'users.id', '=', 'feedback.user_id')
            ->whereBetween('feedback.rating', [1, 5]);
        $totalReviews = (clone $query)->count();
        $averageRating = (float) ((clone $query)->avg('feedback.rating') ?? 0);
        $limit = min(max($request->integer('limit', 12), 1), 12);
        $reviews = $query
            ->select('feedback.id', 'feedback.rating', 'feedback.comment', 'feedback.created_at', 'users.name as customer_name')
            ->orderByDesc('feedback.created_at')
            ->limit($limit)
            ->get()
            ->map(static function ($review) {
                $nameParts = preg_split('/\s+/', trim((string) $review->customer_name), -1, PREG_SPLIT_NO_EMPTY);
                $review->customer_name = $nameParts
                    ? $nameParts[0] . (count($nameParts) > 1 ? ' ' . mb_substr(end($nameParts), 0, 1) . '.' : '')
                    : 'Customer';

                return $review;
            });

        return response()->json([
            'success' => true,
            'reviews' => $reviews,
            'average_rating' => round($averageRating, 1),
            'total_reviews' => $totalReviews,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Admin authorization required.'], 401);
        }
        if (strtolower((string) $user->role) !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Admin authorization required.'], 403);
        }

        if (!Schema::hasTable('order_feedback')) {
            return response()->json([
                'success' => true,
                'reviews' => [],
                'current_page' => 1,
                'last_page' => 1,
                'total' => 0,
            ]);
        }

        $reviews = DB::table('order_feedback as feedback')
            ->leftJoin('users', 'users.id', '=', 'feedback.user_id')
            ->select(
                'feedback.id',
                'feedback.order_id',
                'feedback.user_id',
                'feedback.rating',
                'feedback.comment',
                'feedback.created_at',
                'feedback.updated_at',
                'users.name as customer_name',
                'users.email as customer_email'
            )
            ->orderByDesc('feedback.created_at')
            ->paginate(20);

        return response()->json([
            'success' => true,
            'reviews' => $reviews->items(),
            'current_page' => $reviews->currentPage(),
            'last_page' => $reviews->lastPage(),
            'total' => $reviews->total(),
        ]);
    }
}