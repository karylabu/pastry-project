<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\CustomCakeOrder;
use App\Models\Product;
use App\Http\Requests\StoreOrderRequest;
use App\Services\CustomizedCakeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

        $orders = Order::with(['orderItems', 'customCakeDetails'])
            ->where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'orders' => $orders
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

                $deliveryFee = 0.0;
                $rushFee = ($request->order_type ?? 'Standard') === 'Urgent' ? 100.0 : 0.0;
                $discountType = $request->input('discount_type', 'none');
                $discountAmount = in_array($discountType, ['senior_citizen', 'pwd'], true)
                    ? round($subtotal * 0.20, 2)
                    : 0.0;
                if ($discountAmount > 0) {
                    $discountIdPath = $request->file('discount_id_image')->store('discount-ids', 'local');
                    if (!$discountIdPath) {
                        throw new RuntimeException('Unable to securely save the discount ID image.');
                    }
                }
                $total = $subtotal - $discountAmount + $rushFee;
                $requiresQrPayment = in_array(strtolower((string) $request->payment), ['gcash', 'qrph'], true);
                $initialStatus = $requiresQrPayment ? 'Awaiting Payment' : 'Pending';

                $order = Order::create([
                    'user_id' => $user->id,
                    'customer' => $user->name,
                    'email' => $user->email,
                    'items' => $canonicalItems,
                    'subtotal' => $subtotal,
                    'delivery_fee' => $deliveryFee,
                    'discount_type' => $discountType,
                    'discount' => $discountAmount,
                    'discount_id_path' => $discountIdPath,
                    'total' => $total,
                    'method' => $request->method,
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

                if (!$requiresQrPayment) {
                    DB::table('notifications')->insert([
                        'user_id' => $user->id,
                        'title' => '🧾 Order Placed',
                        'message' => "Your order #{$order->id} has been placed successfully and is now pending.",
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
                    'discount_type' => $discountType,
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

        if (!in_array(strtolower((string) $order->payment), ['gcash', 'qrph'], true)
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

        try {
            $updated = DB::transaction(function () use ($orderId, $user) {
                $order = Order::query()->whereKey($orderId)->lockForUpdate()->first();
                if (!$order || (int) $order->user_id !== (int) $user->id) {
                    return response()->json(['success' => false, 'message' => 'Order not found.'], 404);
                }
                if (!in_array(strtolower((string) $order->payment), ['gcash', 'qrph'], true) || $order->status !== 'Awaiting Payment') {
                    return response()->json(['success' => false, 'message' => 'Order is no longer awaiting payment setup.'], 409);
                }
                if (in_array(strtolower((string) $order->payment_status), ['paid', 'proof_submitted'], true)) {
                    return response()->json(['success' => false, 'message' => 'Payment has already been submitted.'], 409);
                }

                $order->update([
                    'status' => 'Cancelled',
                    'payment_status' => 'failed',
                ]);

                return true;
            });

            if ($updated instanceof \Illuminate\Http\JsonResponse) {
                return $updated;
            }
        } catch (\Throwable $exception) {
            Log::error('Payment setup failure update failed: ' . $exception->getMessage());
            return response()->json(['success' => false, 'message' => 'Unable to update payment status.'], 500);
        }

        return response()->json(['success' => true, 'payment_status' => 'failed']);
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

        try {
            return DB::transaction(function () use ($request, $user) {
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
                $order->update(['status' => 'Cancelled']);
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

        try {
            $order = DB::transaction(function () use ($id, $request, $user) {
                $order = Order::query()->whereKey($id)->lockForUpdate()->first();
                if (!$order) {
                    throw new RuntimeException('Order not found.');
                }

                $oldStatus = $order->status;
                $newStatus = $request->status;
                if ($oldStatus !== 'Confirmed' && $newStatus === 'Confirmed') {
                    $this->deductOrderProductStock($order, (int) $user->id);
                } elseif ($oldStatus === 'Confirmed' && $newStatus === 'Cancelled') {
                    $this->restoreOrderProductStock($order, (int) $user->id);
                }

                $order->update(['status' => $newStatus]);

                $type = 'order';
                if (strtolower($newStatus) === 'completed') $type = 'order_completed';
                if (strtolower($newStatus) === 'cancelled') $type = 'order_cancelled';
                if (strtolower($newStatus) === 'ready for pickup') $type = 'order_received';

                DB::table('notifications')->insert([
                    'user_id' => $order->user_id,
                    'title' => '📦 Order Update',
                    'message' => "Your order #{$order->id} status has been updated to {$newStatus}.",
                    'type' => $type,
                    'is_read' => 0,
                    'action_url' => '/customer/orders',
                    'created_at' => now(),
                ]);

                return $order->fresh();
            });
        } catch (\Throwable $exception) {
            $status = $exception->getMessage() === 'Order not found.' ? 404 : 409;
            return response()->json(['success' => false, 'message' => $exception->getMessage()], $status);
        }

        $order = $order->fresh();
        $oldStatus = (string) $order->status;
        $newStatus = (string) $request->status;

        if (in_array(strtolower($newStatus), ['confirmed', 'approved', 'preparing'], true)) {
            $customizedCakeOrder = DB::table('customized_cake_orders')
                ->where('order_id', $order->id)
                ->first();

            if ($customizedCakeOrder) {
                try {
                    $this->customizedCakeService->consumeOrderInventory(
                        (int) $customizedCakeOrder->id,
                        (int) $order->id,
                        (int) $user->id
                    );
                } catch (\RuntimeException $exception) {
                    return response()->json([
                        'success' => false,
                        'message' => $exception->getMessage(),
                    ], 409);
                }
            }
        }

        if ($oldStatus !== $newStatus) {
            $this->sendSmsNotification($order, $newStatus);
        }

        if (strtolower($newStatus) === 'ready for pickup') {
            $this->sendSmsNotification($order, $newStatus);
        }

        $type = 'order';
        if (strtolower($newStatus) == 'completed') $type = 'order_completed';
        if (strtolower($newStatus) == 'cancelled') $type = 'order_cancelled';
        if (strtolower($newStatus) == 'ready for pickup') {
            $type = 'order_received';
        }

        DB::table('notifications')->insert([
            'user_id' => $order->user_id,
            'title' => '📦 Order Update',
            'message' => "Your order #{$order->id} status has been updated to {$newStatus}.",
            'type' => $type,
            'is_read' => 0,
            'action_url' => '/customer/orders',
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Order status updated successfully.'
        ]);
    }

    private function orderProductLines(Order $order): array
    {
        $lines = [];
        foreach ($order->items ?? [] as $item) {
            $productId = (int) ($item['id'] ?? 0);
            $quantity = (float) ($item['qty'] ?? $item['quantity'] ?? 0);
            if ($productId <= 0 || $quantity <= 0) continue;
            $lines[$productId] = ($lines[$productId] ?? 0) + $quantity;
        }

        return $lines;
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

            $payload = [
                "api_token"    => "3e0c021fc064ea07bb524064e62125caf19f511e",
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
