<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CustomerLoyaltyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $this->requireRole($request, 'customer');
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $this->ensureLoyaltyTable();
        $this->backfillCompletedOrders($user->id, (string) $user->email);

        $summary = DB::table('loyalty_transactions')
            ->where('user_id', $user->id)
            ->selectRaw('COALESCE(SUM(points), 0) AS balance')
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END), 0) AS earned")
            ->first();

        $history = DB::table('loyalty_transactions')
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->limit(20)
            ->get(['type', 'points', 'order_id', 'reward_code', 'created_at'])
            ->map(fn ($entry) => [
                'type' => $entry->type,
                'points' => (int) $entry->points,
                'order_id' => (int) ($entry->order_id ?? 0),
                'reward_code' => $entry->reward_code ?? '',
                'label' => $entry->type === 'earn'
                    ? ($entry->order_id ? "Order #{$entry->order_id}" : 'Order bonus')
                    : '5% OFF reward',
                'created_at' => $entry->created_at,
            ]);

        $rewards = DB::table('loyalty_transactions')
            ->where('user_id', $user->id)
            ->where('type', 'redeem')
            ->orderByDesc('id')
            ->limit(10)
            ->get(['reward_code', 'points', 'discount_amount', 'discount_percent', 'max_discount_amount', 'created_at']);

        return response()->json([
            'success' => true,
            'balance' => max(0, (int) ($summary->balance ?? 0)),
            'earned' => (int) ($summary->earned ?? 0),
            'points_per_hundred' => 10,
            'discount_percent' => 5,
            'max_discount_amount' => 100,
            'minimum_redeem_points' => 1000,
            'rewards' => $rewards,
            'history' => $history,
        ]);
    }

    public function redeem(Request $request): JsonResponse
    {
        $user = $this->requireRole($request, 'customer');
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $points = (int) $request->input('points', 0);
        if ($points !== 1000) {
            return response()->json([
                'success' => false,
                'message' => 'You need exactly 1,000 points to redeem a 5% discount.',
            ], 422);
        }

        $this->ensureLoyaltyTable();
        $this->backfillCompletedOrders($user->id, (string) $user->email);

        $rewardCode = DB::transaction(function () use ($user, $points) {
            DB::table('users')->where('id', $user->id)->lockForUpdate()->first();

            $balance = (int) DB::table('loyalty_transactions')
                ->where('user_id', $user->id)
                ->sum('points');

            if ($balance < $points) {
                return null;
            }

            $code = 'PPR-' . strtoupper(bin2hex(random_bytes(4)));
            DB::table('loyalty_transactions')->insert([
                'user_id' => $user->id,
                'type' => 'redeem',
                'points' => -$points,
                'discount_percent' => 5,
                'max_discount_amount' => 100,
                'reward_code' => $code,
                'created_at' => now(),
            ]);

            return $code;
        });

        if (!$rewardCode) {
            return response()->json(['success' => false, 'message' => 'Not enough points.'], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Reward created',
            'reward_code' => $rewardCode,
            'points' => $points,
            'discount_percent' => 5,
        ]);
    }

    private function ensureLoyaltyTable(): void
    {
        if (Schema::hasTable('loyalty_transactions')) {
            return;
        }

        Schema::create('loyalty_transactions', function ($table) {
            $table->increments('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('order_id')->nullable()->unique();
            $table->string('type', 16);
            $table->integer('points');
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('discount_percent', 5, 2)->default(0);
            $table->decimal('max_discount_amount', 10, 2)->default(100);
            $table->string('reward_code', 32)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['user_id', 'created_at']);
        });
    }

    private function backfillCompletedOrders(int $userId, string $email): void
    {
        $orders = DB::table('orders')
            ->select(['id', 'total'])
            ->where(function ($query) use ($userId, $email) {
                $query->where('user_id', $userId);
                if ($email !== '') {
                    $query->orWhere(function ($emailQuery) use ($email) {
                        $emailQuery->where(function ($userQuery) {
                            $userQuery->whereNull('user_id')->orWhere('user_id', 0);
                        })->where('email', $email);
                    });
                }
            })
            ->whereRaw('LOWER(status) = ?', ['completed'])
            ->whereRaw("(LOWER(COALESCE(payment, '')) NOT IN ('gcash', 'qrph') OR LOWER(COALESCE(payment_status, 'pending')) = 'paid')")
            ->get();

        foreach ($orders as $order) {
            $earnedPoints = (int) floor(max(0, (float) $order->total) / 100) * 10;
            if ($earnedPoints <= 0) {
                continue;
            }

            DB::table('loyalty_transactions')->insertOrIgnore([
                'user_id' => $userId,
                'order_id' => $order->id,
                'type' => 'earn',
                'points' => $earnedPoints,
                'created_at' => now(),
            ]);
        }
    }
}
