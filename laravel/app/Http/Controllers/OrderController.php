<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\CustomCakeOrder;
use App\Models\AdminNotification;
use App\Models\Promotion;
use App\Models\Product;
use App\Http\Requests\StoreOrderRequest;
use App\Services\CustomizedCakeService;
use App\Services\CustomCakeRequestSetting;
use App\Services\ShopSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class OrderController extends Controller
{
    public function __construct(private CustomizedCakeService $customizedCakeService)
    {
    }

    /**
     * Display a listing of orders for the authenticated user.
     */
    public function index(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $relations = [];
        if (Schema::hasTable('order_items')) {
            $relations[] = 'orderItems';
        }
        if (Schema::hasTable('custom_cake_orders')) {
            $relations[] = 'customCakeDetails';
        }

        $hasUserId = Schema::hasColumn('orders', 'user_id');
        $hasEmail = Schema::hasColumn('orders', 'email');
        $hasCustomizedFlag = Schema::hasColumn('orders', 'is_customized');
        $hasOrderType = Schema::hasColumn('orders', 'order_type');
        $hasLegacyCustomOrders = Schema::hasTable('custom_cake_orders');
        $hasRecipeCustomOrders = Schema::hasTable('customized_cake_orders');
        $orders = Order::with($relations)
            ->where(function ($query) use ($user, $hasUserId, $hasEmail) {
                if ($hasUserId) {
                    $query->where('user_id', $user->id);
                }
                if ($hasEmail) {
                    $method = $hasUserId ? 'orWhereRaw' : 'whereRaw';
                    $query->{$method}('LOWER(email) = LOWER(?)', [$user->email]);
                }
                if (!$hasUserId && !$hasEmail) {
                    $query->whereRaw('1 = 0');
                }
            })
            ->where(function ($query) {
                $query->whereNull('payment_status')
                    ->orWhereRaw("LOWER(payment_status) <> 'failed'");
            })
            ->where(function ($query) use ($hasCustomizedFlag, $hasOrderType, $hasLegacyCustomOrders, $hasRecipeCustomOrders) {
                $query->whereRaw("LOWER(COALESCE(status, '')) <> 'awaiting payment'");

                if ($hasCustomizedFlag) {
                    $query->orWhere('is_customized', true);
                }
                if ($hasOrderType) {
                    $query->orWhereRaw("LOWER(COALESCE(order_type, '')) = 'customized'");
                }
                if ($hasLegacyCustomOrders) {
                    $query->orWhereExists(function ($customQuery) {
                        $customQuery->selectRaw('1')
                            ->from('custom_cake_orders')
                            ->whereColumn('custom_cake_orders.order_id', 'orders.id');
                    });
                }
                if ($hasRecipeCustomOrders) {
                    $query->orWhereExists(function ($customQuery) {
                        $customQuery->selectRaw('1')
                            ->from('customized_cake_orders')
                            ->whereColumn('customized_cake_orders.order_id', 'orders.id');
                    });
                }
            })
            ->orderBy('created_at', 'desc')
            ->get();

        if (Schema::hasTable('customized_cake_orders') && $orders->isNotEmpty()) {
            $customCakeOrders = DB::table('customized_cake_orders')
                ->whereIn('order_id', $orders->pluck('id'))
                ->get(['order_id', 'notes', 'inspo_images'])
                ->keyBy('order_id');

            foreach ($orders as $order) {
                $customCakeOrder = $customCakeOrders->get($order->id);
                if (!$customCakeOrder) {
                    continue;
                }

                $details = json_decode((string) $customCakeOrder->notes, true);
                $details = is_array($details) ? $details : [];
                $images = json_decode((string) $customCakeOrder->inspo_images, true);
                $details['inspo_images'] = is_array($images) ? $images : [];
                if (empty($details['reference_image']) && !empty($details['inspo_images'])) {
                    $details['reference_image'] = $details['inspo_images'][0];
                }

                $order->setAttribute('custom_details', $details);
                $order->setAttribute('is_customized', true);
            }
        }

        if (Schema::hasTable('order_return_refund_requests') && $orders->isNotEmpty()) {
            $requestsByOrder = DB::table('order_return_refund_requests')
                ->whereIn('order_id', $orders->pluck('id'))
                ->get(['order_id', 'reason', 'admin_reason', 'status', 'created_at'])
                ->keyBy('order_id');

            foreach ($orders as $order) {
                $returnRefundRequest = $requestsByOrder->get($order->id);
                $order->setAttribute('return_refund_request', $returnRefundRequest ? [
                    'reason' => $returnRefundRequest->reason,
                    'admin_reason' => $returnRefundRequest->admin_reason,
                    'status' => $returnRefundRequest->status,
                    'created_at' => $returnRefundRequest->created_at,
                ] : null);
            }
        }

        return response()->json([
            'success' => true,
            'orders' => $orders
        ]);
    }

    public function firstOrderDiscountEligibility(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        if (strtolower((string) $user->role) !== 'customer') {
            return response()->json(['success' => false, 'message' => 'Forbidden'], 403);
        }

        return response()->json([
            'success' => true,
            'eligible' => !$this->hasNonFailedOrder((int) $user->id),
        ]);
    }

    /**
     * Store a newly created order in storage.
     */
    public function store(StoreOrderRequest $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $discountIdPath = null;
        try {
            return DB::transaction(function () use ($request, $user, &$discountIdPath) {
                $canonicalItems = [];
                $subtotal = 0.0;
                $hasExistingOrder = $this->hasNonFailedOrder((int) $user->id);

                $productQuantities = [];
                foreach ($request->items as $item) {
                    $productId = (int) $item['product_id'];
                    $productQuantities[$productId] = ($productQuantities[$productId] ?? 0) + (int) $item['qty'];
                }

                if (max($productQuantities) > 20) {
                    return response()->json([
                        'success' => false,
                        'message' => 'A maximum of 20 units of each product can be ordered per checkout.',
                        'errors' => ['items' => ['A maximum of 20 units of each product can be ordered per checkout.']],
                    ], 422);
                }

                $inventoryQuantities = [];
                foreach ($request->items as $item) {
                    $productId = (int) $item['product_id'];
                    $productSizeId = (int) ($item['product_size_id'] ?? 0);
                    $inventoryKey = $productId . ':' . ($productSizeId > 0 ? $productSizeId : 'product');
                    $inventoryQuantities[$inventoryKey] = [
                        'product_id' => $productId,
                        'product_size_id' => $productSizeId,
                        'quantity' => ($inventoryQuantities[$inventoryKey]['quantity'] ?? 0) + (int) $item['qty'],
                    ];
                }
                ksort($inventoryQuantities);

                foreach ($inventoryQuantities as $inventory) {
                    $product = Product::query()
                        ->whereKey($inventory['product_id'])
                        ->where('available', true)
                        ->lockForUpdate()
                        ->first();

                    if (!$product) {
                        continue;
                    }

                    $productSizeId = $inventory['product_size_id'];
                    if ($productSizeId > 0) {
                        $productSize = $product->sizes()
                            ->whereKey($productSizeId)
                            ->lockForUpdate()
                            ->first();

                        if (
                            $productSize &&
                            $productSize->available &&
                            Schema::hasColumn('product_sizes', 'stock_quantity') &&
                            $inventory['quantity'] > (int) $productSize->stock_quantity
                        ) {
                            $message = 'You ordered more than the stock available.';
                            return response()->json([
                                'success' => false,
                                'message' => $message,
                                'errors' => ['items' => [$message]],
                            ], 422);
                        }
                    } elseif (
                        Schema::hasColumn('products', 'stock') &&
                        $inventory['quantity'] > (int) $product->stock
                    ) {
                        $message = 'You ordered more than the stock available.';
                        return response()->json([
                            'success' => false,
                            'message' => $message,
                            'errors' => ['items' => [$message]],
                        ], 422);
                    }
                }

                foreach ($request->items as $item) {
                    $product = Product::query()
                        ->whereKey((int) $item['product_id'])
                        ->where('available', true)
                        ->first();

                    if (!$product) {
                        return response()->json([
                            'success' => false,
                            'message' => 'Each item must reference an available product.',
                            'errors' => ['items' => ['Invalid or unavailable product.']],
                        ], 422);
                    }

                    $productSizeId = (int) ($item['product_size_id'] ?? 0);
                    $productSizes = $product->sizes();
                    $hasConfiguredSizes = $productSizes->exists();
                    $productSize = $productSizeId > 0
                        ? $productSizes->whereKey($productSizeId)->where('available', true)->first()
                        : null;

                    if (($productSizeId > 0 && !$productSize) || ($hasConfiguredSizes && !$productSize)) {
                        return response()->json([
                            'success' => false,
                            'message' => 'Each selected product size must belong to the product and be available.',
                            'errors' => ['items' => ['Invalid, mismatched, or unavailable product size.']],
                        ], 422);
                    }

                    $quantity = (int) $item['qty'];
                    $variant = $productSize?->size ?? (string) ($item['variant'] ?? '');
                    $unitPrice = $productSize
                        ? (float) $productSize->price
                        : $this->resolveLegacyProductPrice($product, $variant);
                    if ($unitPrice === null || $unitPrice <= 0) {
                        return response()->json([
                            'success' => false,
                            'message' => 'The selected product variant is unavailable.',
                            'errors' => ['items' => ['Invalid or unavailable product variant.']],
                        ], 422);
                    }

                    $selectionDetails = $item['selectionDetails'] ?? [];
                    $addOns = $this->resolveOrderAddOns(
                        $product,
                        is_array($selectionDetails) ? ($selectionDetails['extras'] ?? []) : []
                    );
                    if ($addOns === null) {
                        return response()->json([
                            'success' => false,
                            'message' => 'One or more selected add-ons are unavailable.',
                            'errors' => ['items' => ['Invalid product add-on.']],
                        ], 422);
                    }
                    if ($addOns) {
                        $selectionDetails['extras'] = $addOns;
                        $unitPrice += array_sum(array_column($addOns, 'price'));
                    }

                    $itemSubtotal = $unitPrice * $quantity;
                    $subtotal += $itemSubtotal;

                    $canonicalItems[] = [
                        'product_id' => (int) $product->id,
                        'product_size_id' => $productSize ? (int) $productSize->id : null,
                        'name' => $product->name,
                        'product' => $product->name,
                        'variant' => $variant,
                        'qty' => $quantity,
                        'price' => $unitPrice,
                        'selectionDetails' => $selectionDetails,
                        'image' => $item['image'] ?? $product->image,
                    ];
                }

                $minimumOrder = (float) ShopSettings::all()['minimumOrder'];
                if ($subtotal < $minimumOrder) {
                    $message = sprintf(
                        'The minimum order subtotal is ₱%s.',
                        number_format($minimumOrder, 2)
                    );

                    return response()->json([
                        'success' => false,
                        'message' => $message,
                        'errors' => ['items' => [$message]],
                    ], 422);
                }

                $deliveryFee = 0.0;
                $rushFee = ($request->order_type ?? 'Standard') === 'Urgent' ? 100.0 : 0.0;
                $discountType = $request->input('discount_type', 'none');
                $rewardCode = strtoupper(trim((string) $request->input('reward_code', '')));
                $promotionCouponCode = strtoupper(trim((string) $request->input('promotion_coupon_code', '')));
                $orderDiscountType = $discountType;
                $discountAmount = 0.0;
                $rewardTransactionId = null;
                $promotionCoupon = null;

                if ($promotionCouponCode !== '') {
                    if ($rewardCode !== '' || $discountType !== 'none') {
                        return response()->json([
                            'success' => false,
                            'message' => 'A promotion coupon cannot be combined with a reward code or Senior Citizen / PWD discount.',
                        ], 422);
                    }

                    $matchingPromotions = Promotion::acceptingCoupons()
                        ->whereRaw('UPPER(coupon_code) = ?', [$promotionCouponCode])
                        ->limit(2)
                        ->lockForUpdate()
                        ->get();

                    if ($matchingPromotions->count() !== 1) {
                        return response()->json([
                            'success' => false,
                            'message' => 'This coupon is invalid, expired, or unavailable.',
                        ], 422);
                    }

                    $promotionCoupon = $matchingPromotions->first();
                }

                if ($rewardCode !== '') {
                    if ($discountType !== 'none') {
                        return response()->json([
                            'success' => false,
                            'message' => 'A reward code cannot be combined with a Senior Citizen or PWD discount.',
                        ], 422);
                    }

                    if (!Schema::hasTable('loyalty_transactions')) {
                        return response()->json([
                            'success' => false,
                            'message' => 'This reward code is invalid or has already been used.',
                        ], 422);
                    }

                    $rewardTransaction = DB::table('loyalty_transactions')
                        ->where('user_id', $user->id)
                        ->where('type', 'redeem')
                        ->where('points', -1000)
                        ->where('discount_percent', 5)
                        ->where('reward_code', $rewardCode)
                        ->whereNull('order_id')
                        ->lockForUpdate()
                        ->first();

                    if (!$rewardTransaction) {
                        return response()->json([
                            'success' => false,
                            'message' => 'This reward code is invalid or has already been used.',
                        ], 422);
                    }

                    $rewardTransactionId = (int) $rewardTransaction->id;
                    $discountAmount = round(min($subtotal * 0.05, (float) $rewardTransaction->max_discount_amount), 2);
                    $orderDiscountType = 'reward_5_percent';
                } elseif ($promotionCoupon) {
                    $discountAmount = round($subtotal * ((float) $promotionCoupon->discount_percent / 100), 2);
                    $orderDiscountType = 'promotion_coupon';
                } elseif ($discountType !== 'none') {
                    if (!in_array($discountType, ['senior_citizen', 'pwd'], true)) {
                        return response()->json([
                            'success' => false,
                            'message' => 'Unsupported discount type.',
                        ], 422);
                    }

                    $discountAmount = round($subtotal * 0.05, 2);
                    $orderDiscountType = $discountType;
                } elseif (!$hasExistingOrder) {
                    $discountAmount = round($subtotal * 0.05, 2);
                    $orderDiscountType = 'first_order_5_percent';
                }

                if ($discountAmount > 0) {
                    if (in_array($discountType, ['senior_citizen', 'pwd'], true)) {
                        $discountIdPath = $request->file('discount_id_image')->store('discount-ids', 'local');
                        if (!$discountIdPath) {
                            throw new RuntimeException('Unable to securely save the discount ID image.');
                        }
                    }
                }
                $total = $subtotal - $discountAmount + $rushFee;
                $requiresQrPayment = in_array(strtolower((string) $request->payment), ['gcash', 'qrph'], true);
                $initialStatus = $requiresQrPayment ? 'Awaiting Payment' : 'Pending';
                $deliveryTime = trim((string) $request->input('delivery_time', ''));

                $order = Order::create([
                    'user_id' => $user->id,
                    'customer' => $user->name,
                    'email' => $user->email,
                    'items' => $canonicalItems,
                    'subtotal' => $subtotal,
                    'delivery_fee' => $deliveryFee,
                    'discount_type' => $orderDiscountType,
                    'coupon_code' => $promotionCoupon?->coupon_code,
                    'discount' => $discountAmount,
                    'discount_id_path' => $discountIdPath,
                    'total' => $total,
                    'method' => $request->method,
                    'delivery_service' => in_array($request->method, ['Delivery', 'Deliver'], true)
                        ? $request->input('delivery_service')
                        : null,
                    'delivery_time' => $deliveryTime !== '' ? $deliveryTime : null,
                    'payment' => $request->payment,
                    'address' => $request->address ?? '',
                    'phone' => $request->phone,
                    'lat' => $request->lat,
                    'lng' => $request->lng,
                    'status' => $initialStatus,
                    'payment_status' => 'pending',
                    'order_type' => $request->order_type ?? 'Standard',
                    'is_customized' => $request->is_customized ?? false,
                    'created_at' => now(),
                ]);

                if ($rewardTransactionId !== null) {
                    $claimedReward = DB::table('loyalty_transactions')
                        ->where('id', $rewardTransactionId)
                        ->whereNull('order_id')
                        ->update(['order_id' => $order->id]);

                    if ($claimedReward !== 1) {
                        throw new RuntimeException('The reward code is no longer available.');
                    }
                }

                // Automatically save phone number to user profile if not already set
                if (empty($user->phone)) {
                    Log::info('Updating user phone from order', ['user_id' => $user->id, 'phone' => $request->phone]);
                    $user->phone = $request->phone;
                    $user->save();
                }

                foreach ($canonicalItems as $item) {
                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $item['product_id'],
                        'product_size_id' => $item['product_size_id'],
                        'product' => $item['product'],
                        'variant' => $item['variant'],
                        'qty' => $item['qty'],
                        'price' => $item['price'],
                        'details' => isset($item['selectionDetails']) ? $item['selectionDetails'] : null,
                        'image' => $item['image'] ?? null,
                    ]);

                }

                app(\App\Services\RealtimeEventPublisher::class)->orderUpdated((int) $user->id, (int) $order->id);

                AdminNotification::notifyRoles(['admin'], [
                    'type' => 'order_received',
                    'title' => "New cake order #{$order->id}",
                    'message' => "{$user->name} placed a customer order.",
                    'data' => ['order_id' => (int) $order->id, 'status' => $initialStatus],
                    'action_url' => '/admin/orders',
                    'is_read' => false,
                    'created_at' => now(),
                ]);

                if (Schema::hasTable('notifications')) {
                    DB::table('notifications')->insert([
                        'user_id' => $user->id,
                        'title' => 'Order Placed',
                        'message' => $requiresQrPayment
                            ? "Your order #{$order->id} has been placed and is awaiting payment."
                            : "Your order #{$order->id} has been placed successfully and is now pending.",
                        'type' => 'Success',
                        'is_read' => 0,
                        'action_url' => '/customer/orders',
                        'created_at' => now(),
                    ]);
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Order created successfully.',
                    'order_id' => $order->id,
                    'status' => $initialStatus,
                    'subtotal' => $subtotal,
                    'delivery_fee' => $deliveryFee,
                    'discount_type' => $orderDiscountType,
                    'coupon_code' => $promotionCoupon?->coupon_code,
                    'discount' => $discountAmount,
                    'total' => $total,
                    'order' => $order->load('orderItems'),
                    'user' => [
                        'id' => (string)$user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'role' => $user->role,
                        'phone' => $user->phone ?? '',
                        'profile_image' => $user->profile_picture ?? '',
                    ]
                ], 201);
            });
        } catch (\Exception $e) {
            if ($discountIdPath) {
                Storage::disk('local')->delete($discountIdPath);
            }
            Log::error('Order creation failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to create order. ' . $e->getMessage()
            ], 500);
        }
    }

    public function submitPaymentProof(Request $request, int $orderId)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'payment_proof' => 'required|image|mimes:jpeg,jpg,png,webp|max:5120',
        ]);

        $order = Order::query()->whereKey($orderId)->where('user_id', $user->id)->first();
        if (!$order) {
            return response()->json(['success' => false, 'message' => 'Order not found.'], 404);
        }

        $isCustomCake = (bool) ($order->is_customized ?? false)
            || strcasecmp((string) ($order->order_type ?? ''), 'Customized') === 0;
        if (!$isCustomCake && Schema::hasTable('custom_cake_orders')) {
            $isCustomCake = CustomCakeOrder::query()->where('order_id', $orderId)->exists();
        }
        $paymentMethodKey = strtolower((string) preg_replace('/[^a-z0-9]/i', '', (string) $order->payment));
        $supportedPaymentMethod = $isCustomCake
            ? in_array($paymentMethodKey, ['gcash', 'maya', 'qrph', 'maribank', 'visamastercard', 'onlinebanking'], true)
            : in_array($paymentMethodKey, ['gcash', 'qrph'], true);

        if (!$supportedPaymentMethod
            || !in_array($order->status, ['Awaiting Payment', 'Awaiting Balance Payment'], true)
            || in_array(strtolower((string) $order->payment_status), ['failed', 'paid', 'proof_submitted'], true)) {
            return response()->json(['success' => false, 'message' => 'This order is not awaiting a QR payment.'], 409);
        }

        $newPath = $request->file('payment_proof')->store('payment-proofs', 'local');
        if (!$newPath) {
            return response()->json(['success' => false, 'message' => 'Unable to save payment proof.'], 500);
        }

        $oldPath = $order->payment_proof_path;
        try {
            $order->update([
                'payment_proof_path' => $newPath,
                'payment_status' => 'proof_submitted',
            ]);
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($newPath);
            Log::error('Payment proof save failed: ' . $exception->getMessage());
            return response()->json(['success' => false, 'message' => 'Unable to save payment proof.'], 500);
        }

        if ($oldPath && $oldPath !== $newPath) {
            Storage::disk('local')->delete($oldPath);
        }

        app(\App\Services\RealtimeEventPublisher::class)->orderUpdated((int) $user->id, $orderId);

        return response()->json([
            'success' => true,
            'message' => 'Payment proof submitted for review.',
            'payment_status' => 'proof_submitted',
        ]);
    }

    public function markPaymentFailed(Request $request, int $orderId)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $order = Order::query()->whereKey($orderId)->where('user_id', $user->id)->first();
        if (!$order) {
            return response()->json(['success' => false, 'message' => 'Order not found.'], 404);
        }
        if (!in_array(strtolower((string) $order->payment), ['gcash', 'qrph'], true) || $order->status !== 'Awaiting Payment') {
            return response()->json(['success' => false, 'message' => 'Order is no longer awaiting payment setup.'], 409);
        }
        if (in_array(strtolower((string) $order->payment_status), ['paid', 'proof_submitted'], true)) {
            return response()->json(['success' => false, 'message' => 'Payment has already been submitted.'], 409);
        }

        $paymentReference = trim((string) $order->payment_reference);
        $paymentState = 'unpaid';
        if ($paymentReference !== '') {
            $secretKey = config('services.paymongo.secret');
            if (!$secretKey) {
                return response()->json(['success' => false, 'message' => 'Payment status cannot be verified right now.'], 503);
            }

            try {
                $paymentState = $this->getPayMongoPaymentState($secretKey, $paymentReference);
                if ($paymentState === 'unpaid') {
                    $archiveResponse = Http::withBasicAuth($secretKey, '')
                        ->acceptJson()
                        ->timeout(15)
                        ->patch('https://api.paymongo.com/v1/payment_links/' . rawurlencode($paymentReference), [
                            'archive' => true,
                        ]);

                    if (!$archiveResponse->successful()) {
                        Log::warning('PayMongo payment link could not be archived.', [
                            'order_id' => $orderId,
                            'http_status' => $archiveResponse->status(),
                        ]);

                        return response()->json(['success' => false, 'message' => 'Payment status cannot be verified right now.'], 502);
                    }

                    $paymentState = $this->getPayMongoPaymentState($secretKey, $paymentReference);
                }
            } catch (\Throwable $exception) {
                Log::error('PayMongo payment status lookup failed.', [
                    'order_id' => $orderId,
                    'exception' => get_class($exception),
                ]);

                return response()->json(['success' => false, 'message' => 'Payment status cannot be verified right now.'], 502);
            }

            if ($paymentState === 'unverified') {
                return response()->json(['success' => false, 'message' => 'Payment status cannot be verified right now.'], 502);
            }
            if ($paymentState === 'processing') {
                return response()->json([
                    'success' => false,
                    'payment_status' => 'processing',
                    'message' => 'Payment is still processing. Please check your orders again shortly.',
                ], 409);
            }
        }

        try {
            $updated = DB::transaction(function () use ($orderId, $user, $paymentState) {
                $lockedOrder = Order::query()->whereKey($orderId)->lockForUpdate()->first();
                if (!$lockedOrder || (int) $lockedOrder->user_id !== (int) $user->id) {
                    return response()->json(['success' => false, 'message' => 'Order not found.'], 404);
                }
                if (!in_array(strtolower((string) $lockedOrder->payment), ['gcash', 'qrph'], true)
                    || $lockedOrder->status !== 'Awaiting Payment'
                    || in_array(strtolower((string) $lockedOrder->payment_status), ['paid', 'proof_submitted'], true)) {
                    return response()->json(['success' => false, 'message' => 'Order payment status has changed.'], 409);
                }

                if ($paymentState === 'paid') {
                    $lockedOrder->update([
                        'status' => 'Pending',
                        'payment_status' => 'paid',
                    ]);

                    if (Schema::hasTable('notifications')) {
                        $notification = DB::table('notifications')
                            ->where('user_id', $user->id)
                            ->where('action_url', '/customer/orders')
                            ->where('message', 'like', "Your order #{$lockedOrder->id} has been placed%")
                            ->first();

                        if ($notification) {
                            DB::table('notifications')
                                ->where('id', $notification->id)
                                ->update([
                                    'message' => "Your order #{$lockedOrder->id} has been placed successfully and is now pending.",
                                    'type' => 'Success',
                                ]);
                        } else {
                            DB::table('notifications')->insert([
                                'user_id' => $user->id,
                                'title' => 'Order Placed',
                                'message' => "Your order #{$lockedOrder->id} has been placed successfully and is now pending.",
                                'type' => 'Success',
                                'is_read' => 0,
                                'action_url' => '/customer/orders',
                                'created_at' => now(),
                            ]);
                        }
                    }

                    return response()->json(['success' => true, 'payment_status' => 'paid']);
                }

                $lockedOrder->update([
                    'status' => 'Cancelled',
                    'payment_status' => 'failed',
                ]);
                $this->restoreOrderSizeStock($lockedOrder, (int) $user->id);

                if (Schema::hasTable('notifications')) {
                    DB::table('notifications')
                        ->where('user_id', $user->id)
                        ->where('action_url', '/customer/orders')
                        ->where('message', 'like', "Your order #{$lockedOrder->id} has been placed%")
                        ->delete();

                    $failureTitle = 'Payment Failed';
                    $failureMessage = "Payment for order #{$lockedOrder->id} failed or was not completed. You can place a new order or contact support.";
                    $hasFailureNotice = DB::table('notifications')
                        ->where('user_id', $user->id)
                        ->where('title', $failureTitle)
                        ->where('message', $failureMessage)
                        ->exists();

                    if (!$hasFailureNotice) {
                        DB::table('notifications')->insert([
                            'user_id' => $user->id,
                            'title' => $failureTitle,
                            'message' => $failureMessage,
                            'type' => 'Warning',
                            'is_read' => 0,
                            'action_url' => '/customer/orders',
                            'created_at' => now(),
                        ]);
                    }
                }

                return response()->json(['success' => true, 'payment_status' => 'failed']);
            });
        } catch (\Throwable $exception) {
            Log::error('Payment failure status update failed.', [
                'order_id' => $orderId,
                'exception' => get_class($exception),
            ]);

            return response()->json(['success' => false, 'message' => 'Unable to update payment status.'], 500);
        }

        return $updated;
    }

    private function getPayMongoPaymentState(string $secretKey, string $paymentReference): string
    {
        $response = Http::withBasicAuth($secretKey, '')
            ->acceptJson()
            ->timeout(15)
            ->get('https://api.paymongo.com/v1/payment_links/' . rawurlencode($paymentReference) . '/payments');

        if (!$response->successful() || !is_array($response->json('data'))) {
            Log::warning('PayMongo payment status could not be verified.', [
                'http_status' => $response->status(),
            ]);

            return 'unverified';
        }

        $payments = $response->json('data');
        $hasSuccessfulPayment = collect($payments)->contains(function ($payment) {
            $status = strtolower((string) ($payment['status'] ?? $payment['attributes']['status'] ?? ''));
            return in_array($status, ['paid', 'succeeded'], true);
        });
        if ($hasSuccessfulPayment) {
            return 'paid';
        }

        $hasUnresolvedPayment = collect($payments)->contains(function ($payment) {
            $status = strtolower((string) ($payment['status'] ?? $payment['attributes']['status'] ?? ''));
            return !in_array($status, ['failed', 'cancelled', 'canceled', 'expired'], true);
        });

        return $hasUnresolvedPayment ? 'processing' : 'unpaid';
    }

    private function hasNonFailedOrder(int $userId): bool
    {
        return Order::query()
            ->where('user_id', $userId)
            ->where(function ($query) {
                $query->whereNull('payment_status')
                    ->orWhereRaw("LOWER(payment_status) <> 'failed'");
            })
            ->exists();
    }

    private function resolveLegacyProductPrice(Product $product, string $variant): ?float
    {
        $category = strtolower(trim((string) $product->category));
        $priceFields = match ($category) {
            'cake', 'cakes' => [
                'small' => 'small_price',
                'big' => 'big_price',
            ],
            'meal', 'meals', 'pasta', 'pizza' => [
                'regular' => 'price',
                'meal' => 'meal_price',
                'combo' => 'combo_price',
            ],
            'starter', 'starters' => [
                'solo' => 'solo_price',
                'sharing' => 'sharing_price',
            ],
            default => ['regular' => 'price'],
        };

        $variant = strtolower(trim($variant));
        if ($variant === '') {
            $variant = array_key_first($priceFields);
        }

        $priceField = $priceFields[$variant] ?? null;
        if (!$priceField) {
            return null;
        }

        $price = (float) ($product->{$priceField} ?? 0);
        return $price > 0 ? $price : null;
    }

    private function resolveOrderAddOns(Product $product, array $extras): ?array
    {
        $category = strtolower(trim((string) $product->category));
        $allowedAddOns = [];

        if (str_contains($category, 'pasta')) {
            $allowedAddOns['Garlic Bread'] = 15.0;
        }
        if (str_contains($category, 'meal')) {
            $allowedAddOns['Extra Rice'] = 35.0;
            $allowedAddOns['Extra Sauce'] = 10.0;
        }

        $resolved = [];
        $seen = [];
        foreach ($extras as $extra) {
            $name = trim((string) ($extra['name'] ?? ''));
            if (!array_key_exists($name, $allowedAddOns) || isset($seen[$name])) {
                return null;
            }

            $seen[$name] = true;
            $resolved[] = ['name' => $name, 'price' => $allowedAddOns[$name]];
        }

        return $resolved;
    }

    /**
     * Handle custom cake order requests.
     */
    public function customize(Request $request)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }
        if (!app(CustomCakeRequestSetting::class)->enabled()) {
            return response()->json([
                'success' => false,
                'message' => 'Custom cake requests are temporarily closed.',
            ], 423);
        }

        try {
            return DB::transaction(function () use ($request, $user) {
                if (!app(CustomCakeRequestSetting::class)->enabled(true)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Custom cake requests are temporarily closed.',
                    ], 423);
                }

                $uploadedImages = [];
                if ($request->hasFile('inspo_images')) {
                    foreach ($request->file('inspo_images') as $index => $file) {
                        if ($file->isValid()) {
                            $name = 'inspo_' . time() . '_' . $index . '.' . $file->extension();
                            $destination = public_path('uploads/inspo');
                            if (!is_dir($destination)) {
                                mkdir($destination, 0777, true);
                            }
                            $file->move($destination, $name);
                            $uploadedImages[] = $name;
                        }
                    }
                }

                $order = Order::create([
                    'user_id' => $user->id,
                    'customer' => $user->name,
                    'email' => $user->email,
                    'phone' => $request->input('phone', ''),
                    'items' => json_encode([]), // Ensure items is never NULL
                    'subtotal' => floatval($request->input('total', $request->input('estimated_price', 0))),
                    'delivery_fee' => 0,
                    'status' => 'Pending',
                    'total' => floatval($request->input('total', $request->input('estimated_price', 0))),
                    'payment' => 'QRPh',
                    'address' => $request->input('address', ''),
                    'method' => $request->input('method', 'Pickup'),
                    'delivery_date' => $request->input('date'),
                    'delivery_time' => $request->input('time'),
                    'order_type' => 'Customized',
                    'is_customized' => 1,
                    'created_at' => now(),
                ]);

                // Automatically save phone number to user profile if not already set
                if (empty($user->phone) && !empty($request->input('phone'))) {
                    Log::info('Updating user phone from custom order', ['user_id' => $user->id, 'phone' => $request->input('phone')]);
                    $user->phone = $request->input('phone');
                    $user->save();
                }

                $fullNotes = "Occasion: " . ($request->input('occasion', 'N/A')) . "\n"
                           . "Theme: " . ($request->input('theme', 'N/A')) . "\n"
                           . "Colors: " . ($request->input('colors', 'N/A')) . "\n"
                           . "Filling: " . ($request->input('filling', 'N/A')) . "\n"
                           . "Frosting: " . ($request->input('frosting', 'N/A')) . "\n"
                           . "Servings: " . ($request->input('servings', '1')) . "\n"
                           . "Addons: " . ($request->input('addons', 'None')) . "\n"
                           . "Instructions: " . ($request->input('notes', ''));

                CustomCakeOrder::create([
                    'order_id' => $order->id,
                    'flavor' => $request->input('flavor', $request->input('cake_flavor', '')),
                    'filling' => $request->input('filling', $request->input('filling_flavor', '')),
                    'frosting' => $request->input('frosting', $request->input('frosting_type', '')),
                    'occasion' => $request->input('occasion', 'N/A'),
                    'theme_design' => $request->input('theme', 'N/A'),
                    'preferred_colors' => $request->input('colors', 'N/A'),
                    'cake_size' => $request->input('cake_size', $request->input('tiers', '')),
                    'quantity' => intval($request->input('servings', 1)),
                    'dedication' => $request->input('dedication', $request->input('custom_message', '')),
                    'notes' => $fullNotes,
                    'estimated_price' => floatval($request->input('estimated_price', 0)),
                    'inspo_images' => $uploadedImages,
                    'created_at' => now(),
                ]);

                app(\App\Services\RealtimeEventPublisher::class)->orderUpdated((int) $user->id, (int) $order->id);

                // Notify User
                DB::table('notifications')->insert([
                    'user_id' => $user->id,
                    'title' => '🎂 Custom Cake Request',
                    'message' => "We've received your request for order #{$order->id}. We will review it and provide a quote soon.",
                    'type' => 'Success',
                    'is_read' => 0,
                    'action_url' => '/customer/orders',
                    'created_at' => now(),
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Custom cake request submitted successfully!',
                    'order_id' => $order->id,
                ]);
            });
        } catch (\Exception $e) {
            Log::error('Customization error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified order.
     */
    public function show(Request $request, int $id)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $order = Order::with(['orderItems', 'customCakeDetails'])
            ->where('id', $id)
            ->where('user_id', $user->id)
            ->first();

        if (!$order) {
            return response()->json(['success' => false, 'message' => 'Order not found.'], 404);
        }

        return response()->json([
            'success' => true,
            'order' => $order
        ]);
    }

    /**
     * Cancel an order.
     */
    public function cancel(Request $request, int $id)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        try {
            DB::transaction(function () use ($id, $user) {
                $order = Order::query()->whereKey($id)->lockForUpdate()->first();
                if (!$order || (int) $order->user_id !== (int) $user->id) {
                    throw new RuntimeException('Order not found.');
                }
                if ($order->status !== 'Pending') {
                    throw new RuntimeException('Only pending orders can be cancelled.');
                }
                $this->restoreOrderSizeStock($order, (int) $user->id);
                $order->update(['status' => 'Cancelled']);

                if (Schema::hasTable('notifications')) {
                    DB::table('notifications')->insert([
                        'user_id' => $user->id,
                        'title' => 'Order Cancelled',
                        'message' => "Your order #{$order->id} has been cancelled.",
                        'type' => 'Warning',
                        'is_read' => 0,
                        'action_url' => '/customer/orders',
                        'created_at' => now(),
                    ]);
                }
            });
        } catch (\Throwable $exception) {
            $status = $exception->getMessage() === 'Order not found.' ? 404 : 400;
            return response()->json(['success' => false, 'message' => $exception->getMessage()], $status);
        }

        return response()->json([
            'success' => true,
            'message' => 'Order cancelled successfully.'
        ]);
    }

    public function confirmReceived(Request $request, int $id)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        try {
            DB::transaction(function () use ($id, $user) {
                $order = Order::query()->whereKey($id)->lockForUpdate()->first();
                if (!$order || (int) $order->user_id !== (int) $user->id) {
                    throw new RuntimeException('Order not found.');
                }
                if ($order->status !== 'Ready for Pickup') {
                    throw new RuntimeException('Order is not ready to be confirmed.');
                }
                $order->update(['status' => 'Completed']);

                if (Schema::hasTable('notifications')) {
                    DB::table('notifications')->insert([
                        'user_id' => $user->id,
                        'title' => 'Order Completed',
                        'message' => "Your order #{$order->id} has been marked as completed.",
                        'type' => 'Success',
                        'is_read' => 0,
                        'action_url' => '/customer/orders',
                        'created_at' => now(),
                    ]);
                }
            });
        } catch (\Throwable $exception) {
            $status = $exception->getMessage() === 'Order not found.' ? 404 : 409;
            return response()->json(['success' => false, 'message' => $exception->getMessage()], $status);
        }

        return response()->json(['success' => true]);
    }

    public function requestReturnRefund(Request $request, int $id)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        try {
            $returnRefundRequest = DB::transaction(function () use ($id, $user, $validated) {
                $order = Order::query()->whereKey($id)->lockForUpdate()->first();
                $belongsToUser = $order && (
                    (int) $order->user_id === (int) $user->id
                    || (!$order->user_id && strcasecmp((string) $order->email, (string) $user->email) === 0)
                );
                if (!$belongsToUser) {
                    throw new RuntimeException('Order not found.');
                }
                if ($order->status !== 'Ready for Pickup') {
                    throw new RuntimeException('Return or refund requests are only available for orders ready for pickup.');
                }

                $existingRequest = DB::table('order_return_refund_requests')
                    ->where('order_id', $order->id)
                    ->first();
                if ($existingRequest) {
                    throw new RuntimeException('A return or refund request has already been submitted for this order.');
                }

                $requestId = DB::table('order_return_refund_requests')->insertGetId([
                    'order_id' => $order->id,
                    'customer_id' => $user->id,
                    'reason' => trim($validated['reason']),
                    'status' => 'Pending Review',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $statusUpdated = DB::table('orders')
                    ->where('id', $order->id)
                    ->update(['status' => 'Return/Refund']);
                if ($statusUpdated !== 1) {
                    throw new RuntimeException('Unable to update the order status for this request.');
                }

                AdminNotification::notifyRoles(['admin'], [
                    'type' => 'return_refund_request',
                    'title' => "Return/refund request for order #{$order->id}",
                    'message' => "{$user->name} requested a return/refund for order #{$order->id}: " . trim($validated['reason']),
                    'action_url' => '/admin/orders',
                    'created_at' => now(),
                ]);

                return DB::table('order_return_refund_requests')->where('id', $requestId)->first();
            });
        } catch (RuntimeException $exception) {
            $status = $exception->getMessage() === 'Order not found.' ? 404 : 409;
            return response()->json(['success' => false, 'message' => $exception->getMessage()], $status);
        }

        app(\App\Services\RealtimeEventPublisher::class)->orderUpdated((int) $user->id, $id);

        return response()->json([
            'success' => true,
            'message' => 'Your return/refund request was sent to the admin for review.',
            'return_refund_request' => [
                'reason' => $returnRefundRequest->reason,
                'status' => $returnRefundRequest->status,
                'created_at' => $returnRefundRequest->created_at,
            ],
        ], 201);
    }

    public function rejectReturnRefundRequest(Request $request, int $orderId)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user || strtolower((string) $user->role) !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], $user ? 403 : 401);
        }

        $validated = $request->validate([
            'admin_reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        try {
            $customerId = DB::transaction(function () use ($orderId, $validated) {
                $order = Order::query()->whereKey($orderId)->lockForUpdate()->first();
                if (!$order) {
                    throw new RuntimeException('Order not found.');
                }

                $returnRefundRequest = DB::table('order_return_refund_requests')
                    ->where('order_id', $orderId)
                    ->lockForUpdate()
                    ->first();
                if (!$returnRefundRequest || $returnRefundRequest->status !== 'Pending Review') {
                    throw new RuntimeException('There is no pending return/refund request to reject.');
                }

                $adminReason = trim($validated['admin_reason']);
                DB::table('order_return_refund_requests')
                    ->where('id', $returnRefundRequest->id)
                    ->update([
                        'status' => 'Rejected',
                        'admin_reason' => $adminReason,
                        'updated_at' => now(),
                    ]);
                $order->update(['status' => 'Completed']);

                DB::table('notifications')->insert([
                    'user_id' => $returnRefundRequest->customer_id,
                    'title' => "Return/refund request rejected for order #{$orderId}",
                    'message' => "Your return/refund request for order #{$orderId} was rejected. Admin reason: {$adminReason}",
                    'type' => 'Warning',
                    'is_read' => false,
                    'action_url' => '/customer/orders',
                    'created_at' => now(),
                ]);

                return (int) $returnRefundRequest->customer_id;
            });
        } catch (RuntimeException $exception) {
            $status = $exception->getMessage() === 'Order not found.' ? 404 : 409;
            return response()->json(['success' => false, 'message' => $exception->getMessage()], $status);
        }

        app(\App\Services\RealtimeEventPublisher::class)->orderUpdated($customerId, $orderId);

        return response()->json([
            'success' => true,
            'message' => 'The return/refund request was rejected and the customer was notified.',
        ]);
    }

    /**
     * Update order status (Admin/Staff only).
     */
    public function updateStatus(Request $request, int $id)
    {
        $user = $this->getAuthenticatedUser($request);
        if (!$user || $user->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $previousStatus = null;
        try {
            $order = DB::transaction(function () use ($id, $request, $user, &$previousStatus) {
                $order = Order::query()->whereKey($id)->lockForUpdate()->first();
                if (!$order) {
                    throw new RuntimeException('Order not found.');
                }

                $oldStatus = $order->status;
                $newStatus = $request->status;
                $previousStatus = $oldStatus;
                $approvedStatuses = ['confirmed', 'approved', 'preparing'];
                $stockDeductedStatuses = array_merge($approvedStatuses, ['return/refund']);
                $wasApproved = in_array(strtolower(trim($oldStatus)), $stockDeductedStatuses, true);
                $isApproved = in_array(strtolower(trim($newStatus)), $approvedStatuses, true);

                if (!$wasApproved && $isApproved) {
                    $this->deductOrderSizeStock($order->items ?? [], (int) $order->id, (int) $user->id);
                    $this->deductOrderProductStock($order, (int) $user->id);
                } elseif ($wasApproved && strtolower(trim($newStatus)) === 'cancelled') {
                    $this->restoreOrderSizeStock($order, (int) $user->id);
                    $this->restoreOrderProductStock($order, (int) $user->id);
                }

                if (in_array(strtolower($newStatus), ['confirmed', 'approved', 'preparing'], true)) {
                    $customizedCakeOrder = DB::table('customized_cake_orders')
                        ->where('order_id', $order->id)
                        ->first();

                    if ($customizedCakeOrder) {
                        $this->customizedCakeService->consumeOrderInventory(
                            (int) $customizedCakeOrder->id,
                            (int) $order->id,
                            (int) $user->id
                        );
                    }
                }

                $order->update(['status' => $newStatus]);

                if (Schema::hasTable('order_return_refund_requests')
                    && in_array(strtolower(trim($newStatus)), ['completed', 'cancelled'], true)) {
                    DB::table('order_return_refund_requests')
                        ->where('order_id', $order->id)
                        ->where('status', 'Pending Review')
                        ->update([
                            'status' => strtolower(trim($newStatus)) === 'completed' ? 'Resolved' : 'Cancelled',
                            'updated_at' => now(),
                        ]);
                }

                if ($oldStatus !== $newStatus && Schema::hasTable('notifications')) {
                    $type = strtolower($newStatus) === 'cancelled' ? 'Warning' : 'Success';
                    DB::table('notifications')->insert([
                        'user_id' => $order->user_id,
                        'title' => "Order {$newStatus}",
                        'message' => "Your order #{$order->id} status has been updated to {$newStatus}.",
                        'type' => $type,
                        'is_read' => 0,
                        'action_url' => '/customer/orders',
                        'created_at' => now(),
                    ]);
                }

                return $order->fresh();
            });
        } catch (\Throwable $exception) {
            if (str_starts_with($exception->getMessage(), 'Insufficient stock for ')
                || str_starts_with($exception->getMessage(), 'Insufficient ingredient stock')) {
                $this->notifyOrderStockout($id);
            }

            $status = $exception->getMessage() === 'Order not found.' ? 404 : 409;
            return response()->json(['success' => false, 'message' => $exception->getMessage()], $status);
        }

        $order = $order->fresh();
        $oldStatus = (string) ($previousStatus ?? $order->status);
        $newStatus = (string) $request->status;

        if ($oldStatus !== $newStatus) {
            $this->sendSmsNotification($order, $newStatus);
        }

        if (strtolower($newStatus) === 'ready for pickup') {
            $this->sendSmsNotification($order, $newStatus);
        }

        return response()->json([
            'success' => true,
            'message' => 'Order status updated successfully.'
        ]);
    }

    private function notifyOrderStockout(int $orderId): void
    {
        $order = Order::query()->find($orderId);
        if (!Schema::hasTable('notifications') || !$order || !$order->user_id) {
            return;
        }

        $title = 'Stockout Alert';
        $message = "We cannot confirm order #{$order->id} yet because an item is temporarily out of stock. Your order has not been cancelled; we will update you when availability is confirmed.";
        $exists = DB::table('notifications')
            ->where('user_id', $order->user_id)
            ->where('title', $title)
            ->where('message', $message)
            ->exists();

        if (!$exists) {
            DB::table('notifications')->insert([
                'user_id' => $order->user_id,
                'title' => $title,
                'message' => $message,
                'type' => 'Warning',
                'is_read' => 0,
                'action_url' => '/customer/orders',
                'created_at' => now(),
            ]);
        }
    }

    private function orderProductLines(Order $order): array
    {
        $lines = [];
        foreach ($order->items ?? [] as $item) {
            if ((int) ($item['product_size_id'] ?? 0) > 0) continue;
            $productId = (int) ($item['product_id'] ?? $item['id'] ?? 0);
            $quantity = (float) ($item['qty'] ?? $item['quantity'] ?? 0);
            if ($productId <= 0 || $quantity <= 0) continue;
            $lines[$productId] = ($lines[$productId] ?? 0) + $quantity;
        }

        return $lines;
    }

    private function deductOrderSizeStock(array $items, int $orderId, int $userId): void
    {
        $sizeQuantities = [];
        foreach ($items as $item) {
            $productSizeId = (int) ($item['product_size_id'] ?? 0);
            $productId = (int) ($item['product_id'] ?? 0);
            $quantity = (int) ($item['qty'] ?? 0);
            if ($productSizeId <= 0 || $productId <= 0 || $quantity <= 0) continue;

            $sizeQuantities[$productSizeId] = [
                'product_id' => $productId,
                'quantity' => ($sizeQuantities[$productSizeId]['quantity'] ?? 0) + $quantity,
            ];
        }

        if (!$sizeQuantities) return;
        if (
            !Schema::hasColumn('product_sizes', 'stock_quantity')
            || !Schema::hasTable('product_inventory_movements')
            || !Schema::hasColumn('product_inventory_movements', 'product_size_id')
        ) {
            throw new RuntimeException('Size inventory tracking is unavailable.');
        }

        ksort($sizeQuantities);
        foreach ($sizeQuantities as $productSizeId => $sizeInventory) {
            $size = DB::table('product_sizes')
                ->where('id', $productSizeId)
                ->where('product_id', $sizeInventory['product_id'])
                ->lockForUpdate()
                ->first();
            if (!$size) {
                throw new RuntimeException('The selected product size is no longer available.');
            }

            $previousStock = (int) $size->stock_quantity;
            $quantity = (int) $sizeInventory['quantity'];
            if ($previousStock < $quantity) {
                throw new RuntimeException('You ordered more than the stock available.');
            }

            $newStock = $previousStock - $quantity;
            $updated = DB::table('product_sizes')
                ->where('id', $productSizeId)
                ->where('stock_quantity', '>=', $quantity)
                ->update(['stock_quantity' => $newStock]);
            if ($updated !== 1) {
                throw new RuntimeException('Unable to update product size stock.');
            }

            $inserted = DB::table('product_inventory_movements')->insert([
                'product_id' => $sizeInventory['product_id'],
                'product_size_id' => $productSizeId,
                'movement_type' => 'Order',
                'quantity' => -$quantity,
                'previous_stock' => $previousStock,
                'new_stock' => $newStock,
                'reason' => "Order #{$orderId} placed",
                'reference_type' => 'order',
                'reference_id' => $orderId,
                'user_id' => $userId,
                'created_at' => now(),
            ]);
            if (!$inserted) {
                throw new RuntimeException('Failed to record product size order movement.');
            }
        }
    }

    private function restoreOrderSizeStock(Order $order, int $userId): void
    {
        if (
            !Schema::hasTable('product_inventory_movements')
            || !Schema::hasColumn('product_inventory_movements', 'product_size_id')
        ) {
            return;
        }

        $deductions = DB::table('product_inventory_movements')
            ->select('product_id', 'product_size_id', DB::raw('SUM(quantity) as net_quantity'))
            ->where('reference_type', 'order')
            ->where('reference_id', $order->id)
            ->whereIn('movement_type', ['Order', 'Cancellation', 'Reservation Release'])
            ->whereNotNull('product_size_id')
            ->groupBy('product_id', 'product_size_id')
            ->get();

        foreach ($deductions as $deduction) {
            $restoreQuantity = max(0, -(float) $deduction->net_quantity);
            if ($restoreQuantity <= 0.000001) continue;

            $size = DB::table('product_sizes')
                ->where('id', $deduction->product_size_id)
                ->where('product_id', $deduction->product_id)
                ->lockForUpdate()
                ->first();
            if (!$size) {
                throw new RuntimeException('Product size not found for order restoration.');
            }

            $previousStock = (float) $size->stock_quantity;
            $newStock = $previousStock + $restoreQuantity;
            $updated = DB::table('product_sizes')
                ->where('id', $deduction->product_size_id)
                ->update(['stock_quantity' => $newStock]);
            if ($updated !== 1) {
                throw new RuntimeException('Failed to restore product size stock.');
            }

            $inserted = DB::table('product_inventory_movements')->insert([
                'product_id' => $deduction->product_id,
                'product_size_id' => $deduction->product_size_id,
                'movement_type' => 'Cancellation',
                'quantity' => $restoreQuantity,
                'previous_stock' => $previousStock,
                'new_stock' => $newStock,
                'reason' => "Order #{$order->id} cancelled",
                'reference_type' => 'order',
                'reference_id' => $order->id,
                'user_id' => $userId,
                'created_at' => now(),
            ]);
            if (!$inserted) {
                throw new RuntimeException('Failed to record product size cancellation movement.');
            }
        }
    }

    private function deductOrderProductStock(Order $order, int $userId): void
    {
        foreach ($this->orderProductLines($order) as $productId => $quantity) {
            $product = Product::query()->whereKey($productId)->lockForUpdate()->first();
            if (!$product) throw new RuntimeException('Product not found for order.');

            $previousStock = (float) $product->stock;
            if ($previousStock < $quantity) throw new RuntimeException("Insufficient stock for {$product->name}.");
            $newStock = $previousStock - $quantity;
            if (!$product->update(['stock' => $newStock])) throw new RuntimeException('Failed to update product stock.');

            $inserted = DB::table('product_inventory_movements')->insert([
                'product_id' => $productId,
                'movement_type' => 'Order',
                'quantity' => -$quantity,
                'previous_stock' => $previousStock,
                'new_stock' => $newStock,
                'reason' => "Order #{$order->id} confirmed",
                'reference_type' => 'order',
                'reference_id' => $order->id,
                'user_id' => $userId,
                'created_at' => now(),
            ]);
            if (!$inserted) throw new RuntimeException('Failed to record product order movement.');
        }
    }

    private function restoreOrderProductStock(Order $order, int $userId): void
    {
        $deductions = DB::table('product_inventory_movements')
            ->select('product_id', DB::raw('SUM(quantity) as net_quantity'))
            ->where('reference_type', 'order')
            ->where('reference_id', $order->id)
            ->whereIn('movement_type', ['Order', 'Cancellation'])
            ->whereNull('product_size_id')
            ->groupBy('product_id')
            ->get();

        foreach ($deductions as $deduction) {
            $restoreQuantity = max(0, -(float) $deduction->net_quantity);
            if ($restoreQuantity <= 0.000001) continue;

            $product = Product::query()->whereKey($deduction->product_id)->lockForUpdate()->first();
            if (!$product) throw new RuntimeException('Product not found for order restoration.');

            $previousStock = (float) $product->stock;
            $newStock = $previousStock + $restoreQuantity;
            if (!$product->update(['stock' => $newStock])) throw new RuntimeException('Failed to restore product stock.');

            $inserted = DB::table('product_inventory_movements')->insert([
                'product_id' => $product->id,
                'movement_type' => 'Cancellation',
                'quantity' => $restoreQuantity,
                'previous_stock' => $previousStock,
                'new_stock' => $newStock,
                'reason' => "Order #{$order->id} cancelled",
                'reference_type' => 'order',
                'reference_id' => $order->id,
                'user_id' => $userId,
                'created_at' => now(),
            ]);
            if (!$inserted) throw new RuntimeException('Failed to record product cancellation movement.');
        }
    }

    /**
     * Send SMS notification via iProgSMS.
     */
    private function sendSmsNotification(Order $order, string $status)
    {
        try {
            $phone = $order->phone;
            if (empty($phone)) return;

            // Format phone number to 63XXXXXXXXXX
            $phone = preg_replace('/[^0-9]/', '', $phone);
            if (str_starts_with($phone, '0')) {
                $phone = '63' . substr($phone, 1);
            } elseif (!str_starts_with($phone, '63')) {
                $phone = '63' . $phone;
            }

            $statusMessage = match (strtolower($status)) {
                'pending' => 'has been received and is awaiting confirmation',
                'confirmed' => 'has been confirmed',
                'preparing' => 'is now being prepared',
                'ready for pickup' => 'is ready for pickup',
                'completed' => 'has been completed',
                'cancelled' => 'has been cancelled',
                default => "status is now {$status}",
            };
            $message = "Pastry Project: Your order #{$order->id} {$statusMessage}.";
            $apiToken = config('services.iprogsms.api_token');
            if (!is_string($apiToken) || trim($apiToken) === '') {
                Log::warning("iProgSMS token is not configured; order status SMS was not sent.", [
                    'order_id' => $order->id,
                ]);

                return;
            }

            $payload = [
                "api_token"    => $apiToken,
                "phone_number" => $phone,
                "message"      => $message
            ];

            $response = \Illuminate\Support\Facades\Http::timeout(15)
                ->withHeaders(["Content-Type" => "application/json"])
                ->post("https://www.iprogsms.com/api/v1/sms_messages", $payload);

            Log::info("SMS Sent for Order #{$order->id}", [
                'phone' => $phone,
                'status' => $response->status(),
                'response' => $response->body()
            ]);

        } catch (\Exception $e) {
            Log::error("SMS Sending Failed for Order #{$order->id}: " . $e->getMessage());
        }
    }
}
