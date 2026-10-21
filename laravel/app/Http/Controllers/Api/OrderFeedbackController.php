<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class OrderFeedbackController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Authentication required.'], 401);
        }
        if (strtolower((string) $user->role) !== 'customer') {
            return response()->json(['success' => false, 'message' => 'Customer authorization required.'], 403);
        }
        if (!Schema::hasTable('order_feedback')) {
            return response()->json(['success' => false, 'message' => 'Feedback storage is unavailable.'], 503);
        }

        $validated = $request->validate([
            'order_id' => ['required', 'integer', 'min:1'],
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        $order = DB::table('orders')
            ->where('id', $validated['order_id'])
            ->first(['id', 'user_id', 'status']);

        if (!$order) {
            return response()->json(['success' => false, 'message' => 'Order not found.'], 404);
        }
        if ((int) $order->user_id !== (int) $user->id) {
            return response()->json(['success' => false, 'message' => 'You can only review your own order.'], 403);
        }
        if (strtolower((string) $order->status) !== 'completed') {
            return response()->json(['success' => false, 'message' => 'Feedback is available after the order is completed.'], 422);
        }

        $now = now();
        DB::table('order_feedback')->upsert(
            [[
                'order_id' => $order->id,
                'user_id' => $user->id,
                'rating' => $validated['rating'],
                'comment' => $validated['comment'] ?? '',
                'created_at' => $now,
                'updated_at' => $now,
            ]],
            ['order_id', 'user_id'],
            ['rating', 'comment', 'updated_at']
        );

        return response()->json(['success' => true, 'message' => 'Feedback saved.']);
    }

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
                $review->id = (int) $review->id;
                $review->rating = (int) $review->rating;
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
        $reviews->getCollection()->transform(static function ($review) {
            $review->id = (int) $review->id;
            $review->order_id = (int) $review->order_id;
            $review->user_id = (int) $review->user_id;
            $review->rating = (int) $review->rating;

            return $review;
        });

        return response()->json([
            'success' => true,
            'reviews' => $reviews->items(),
            'current_page' => $reviews->currentPage(),
            'last_page' => $reviews->lastPage(),
            'total' => $reviews->total(),
        ]);
    }
}