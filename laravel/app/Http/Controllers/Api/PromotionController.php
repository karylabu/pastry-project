<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\PromotionEmail;
use App\Models\Promotion;
use App\Models\PromotionEmailLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class PromotionController extends Controller
{
    protected function resolveAdminUser(Request $request): ?User
    {
        $userId = $request->input('user_id') ?? $request->query('user_id');

        if (! $userId) {
            return null;
        }

        $user = User::find((int) $userId);

        if (! $user || ! in_array($user->role, ['admin', 'staff'], true)) {
            return null;
        }

        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $user = $this->resolveAdminUser($request);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized promotion request.',
            ], 403);
        }

        $promotions = Promotion::orderByDesc('created_at')->get();

        return response()->json([
            'success' => true,
            'data' => $promotions,
        ]);
    }

    public function send(Request $request): JsonResponse
    {
        $user = $this->resolveAdminUser($request);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized promotion request.',
            ], 403);
        }

        $payload = $request->all();

        if (empty($payload) && $request->getContent()) {
            $decoded = json_decode($request->getContent(), true);
            if (is_array($decoded)) {
                $payload = $decoded;
            }
        }

        $validator = Validator::make($payload, [
            'title' => ['required', 'string', 'max:150'],
            'message' => ['required', 'string'],
            'coupon_code' => ['nullable', 'string', 'max:50'],
            'image_url' => ['nullable', 'string', 'max:255'],
            'image' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,gif,webp', 'max:5120'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after_or_equal:starts_at'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();
        $imageUrl = $validated['image_url'] ?? null;

        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $directory = public_path('uploads/promotions');

            if (! is_dir($directory)) {
                mkdir($directory, 0775, true);
            }

            $filename = Str::uuid() . '.' . $image->extension();
            $image->move($directory, $filename);
            $imageUrl = url('uploads/promotions/' . $filename);
        }

        $promotion = Promotion::create([
            'title' => $validated['title'],
            'description' => $validated['message'],
            'coupon_code' => $validated['coupon_code'] ?? null,
            'image_url' => $imageUrl,
            'starts_at' => $validated['starts_at'],
            'ends_at' => $validated['ends_at'],
            'status' => 'draft',
        ]);

        $subscribers = User::where('role', 'customer')
            ->where('subscribed_promo', true)
            ->get();

        $sentCount = 0;
        $failedCount = 0;

        foreach ($subscribers as $subscriber) {
            $status = 'sent';
            $errorMessage = null;

            try {
                Mail::to($subscriber->email)->send(new PromotionEmail($promotion));
                $sentCount++;
            } catch (\Throwable $ex) {
                $status = 'failed';
                $errorMessage = $ex->getMessage();
                $failedCount++;
            }

            PromotionEmailLog::create([
                'promotion_id' => $promotion->id,
                'email' => $subscriber->email,
                'status' => $status,
                'error_message' => $errorMessage,
            ]);
        }

        $promotion->sent_count = $sentCount;
        $promotion->failed_count = $failedCount;
        $promotion->status = $failedCount === 0
            ? 'sent'
            : ($sentCount > 0 ? 'sent_with_failures' : 'failed');
        $promotion->save();

        return response()->json([
            'success' => true,
            'message' => 'Promotion sent to subscribed customers.',
            'data' => [
                'promotion' => $promotion,
                'recipient_count' => $subscribers->count(),
                'sent_count' => $sentCount,
                'failed_count' => $failedCount,
            ],
        ]);
    }
}
