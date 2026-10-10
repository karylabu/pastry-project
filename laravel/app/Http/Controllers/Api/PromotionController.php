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
        $user = $this->getAuthenticatedUser($request);

        if (! $user || $user->role !== 'admin') {
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
            'coupon_code' => ['nullable', 'required_with:discount_percent', 'string', 'max:50'],
            'discount_percent' => ['nullable', 'required_with:coupon_code', 'integer', 'min:1', 'max:100'],
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
            'discount_percent' => $validated['discount_percent'] ?? null,
            'image_url' => $imageUrl,
            'starts_at' => $validated['starts_at'],
            'ends_at' => $validated['ends_at'],
            'status' => 'draft',
        ]);

        $delivery = $this->sendToSubscribers($promotion);

        return response()->json([
            'success' => true,
            'message' => 'Promotion sent to subscribed customers.',
            'data' => array_merge(['promotion' => $promotion], $delivery),
        ]);
    }

    public function sendDraft(Request $request, Promotion $promotion): JsonResponse
    {
        $user = $this->resolveAdminUser($request);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized promotion request.',
            ], 403);
        }

        if ($promotion->status !== 'draft') {
            return response()->json([
                'success' => false,
                'message' => 'Only draft promotions can be sent.',
            ], 409);
        }

        $delivery = $this->sendToSubscribers($promotion);

        return response()->json([
            'success' => true,
            'message' => 'Draft promotion sent to subscribed customers.',
            'data' => array_merge(['promotion' => $promotion], $delivery),
        ]);
    }

    private function sendToSubscribers(Promotion $promotion): array
    {
        $subscribers = User::where('role', 'customer')
            ->where('subscribed_promo', true)
            ->get();
        $sentCount = 0;
        $failedCount = 0;

        foreach ($subscribers as $subscriber) {
            $status = 'sent';
            $errorMessage = null;

            try {
                Mail::to($subscriber->email)->send(new PromotionEmail($promotion, $subscriber));
                $sentCount++;
            } catch (\Throwable $exception) {
                $status = 'failed';
                $errorMessage = $exception->getMessage();
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

        return [
            'recipient_count' => $subscribers->count(),
            'sent_count' => $sentCount,
            'failed_count' => $failedCount,
        ];
    }

    public function validateCoupon(Request $request): JsonResponse
    {
        $user = $this->getAuthenticatedUser($request);

        if (! $user || $user->role !== 'customer') {
            return response()->json([
                'success' => false,
                'message' => 'Authentication required.',
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'coupon_code' => ['required', 'string', 'max:50'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $code = strtoupper(trim($validator->validated()['coupon_code']));
        $promotions = Promotion::acceptingCoupons()
            ->whereRaw('UPPER(coupon_code) = ?', [$code])
            ->limit(2)
            ->get();

        if ($promotions->count() !== 1) {
            return response()->json([
                'success' => false,
                'message' => 'This coupon is invalid, expired, or unavailable.',
            ], 422);
        }

        $promotion = $promotions->first();

        return response()->json([
            'success' => true,
            'data' => [
                'coupon_code' => $promotion->coupon_code,
                'discount_percent' => (float) $promotion->discount_percent,
                'promotion_title' => $promotion->title,
            ],
        ]);
    }

    public function update(Request $request, Promotion $promotion): JsonResponse
    {
        $user = $this->resolveAdminUser($request);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized promotion request.',
            ], 403);
        }

        if ($promotion->status !== 'draft') {
            return response()->json([
                'success' => false,
                'message' => 'Only draft promotions can be edited.',
            ], 409);
        }

        $validator = Validator::make($request->all(), [
            'title' => ['required', 'string', 'max:150'],
            'message' => ['required', 'string'],
            'coupon_code' => ['nullable', 'required_with:discount_percent', 'string', 'max:50'],
            'discount_percent' => ['nullable', 'required_with:coupon_code', 'integer', 'min:1', 'max:100'],
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
        $imageUrl = $validated['image_url'] ?? $promotion->image_url;

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

        $promotion->update([
            'title' => $validated['title'],
            'description' => $validated['message'],
            'coupon_code' => $validated['coupon_code'] ?: null,
            'discount_percent' => $validated['discount_percent'] ?? null,
            'image_url' => $imageUrl,
            'starts_at' => $validated['starts_at'],
            'ends_at' => $validated['ends_at'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Draft promotion updated successfully.',
            'data' => $promotion->fresh(),
        ]);
    }
}
