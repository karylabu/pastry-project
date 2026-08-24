<?php

namespace App\Http\Controllers;

use App\Models\Favorite;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FavoriteController extends Controller
{
    /**
     * Get user favorites.
     */
    public function index(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            \Log::warning('Favorite index access unauthorized');
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $favorites = Favorite::where('customer_id', $user->id)
            ->pluck('product_id');

        \Log::info('Fetched favorites for user', ['user_id' => $user->id, 'count' => count($favorites)]);

        return response()->json($favorites);
    }

    /**
     * Toggle favorite status.
     */
    public function toggle(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            \Log::warning('Favorite toggle access unauthorized');
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $productId = $request->input('product_id');
        if (!$productId) {
            return response()->json(['success' => false, 'message' => 'Product ID is required'], 400);
        }

        \Log::info('Toggling favorite', ['user_id' => $user->id, 'product_id' => $productId]);

        $favoriteRequest = $request->input('favorite');

        $existing = Favorite::where('customer_id', $user->id)
            ->where('product_id', $productId)
            ->first();

        if ($favoriteRequest !== null) {
            $shouldBeFavorite = filter_var($favoriteRequest, FILTER_VALIDATE_BOOLEAN);
            if ($shouldBeFavorite) {
                if (!$existing) {
                    Favorite::create([
                        'customer_id' => $user->id,
                        'product_id' => $productId,
                    ]);
                }
                return response()->json(['success' => true, 'message' => 'Added to favorites', 'is_favorite' => true]);
            } else {
                if ($existing) {
                    $existing->delete();
                }
                return response()->json(['success' => true, 'message' => 'Removed from favorites', 'is_favorite' => false]);
            }
        }

        // Traditional toggle if 'favorite' param not provided
        if ($existing) {
            $existing->delete();
            \Log::info('Removed favorite', ['user_id' => $user->id, 'product_id' => $productId]);
            return response()->json(['success' => true, 'message' => 'Removed from favorites', 'is_favorite' => false]);
        } else {
            Favorite::create([
                'customer_id' => $user->id,
                'product_id' => $productId,
            ]);
            \Log::info('Added favorite', ['user_id' => $user->id, 'product_id' => $productId]);
            return response()->json(['success' => true, 'message' => 'Added to favorites', 'is_favorite' => true]);
        }
    }
}
