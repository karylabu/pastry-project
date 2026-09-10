<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\CustomCakeOrder;
use App\Models\Product;
use App\Models\User;
use App\Http\Requests\StoreOrderRequest;
use App\Services\CustomizedCakeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
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

        try {
            return DB::transaction(function () use ($request, $user) {
                $order = Order::create([
                    'user_id' => $user->id,
                    'customer' => $user->name,
                    'email' => $user->email,
                    'items' => $request->items,
                    'subtotal' => $request->subtotal,
                    'delivery_fee' => $request->delivery_fee,
                    'total' => $request->total,
                    'method' => $request->method,
                    'payment' => $request->payment,
                    'address' => $request->address ?? '',
                    'phone' => $request->phone,
                    'lat' => $request->lat,
                    'lng' => $request->lng,
                    'status' => 'Pending',
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

                foreach ($request->items as $item) {
                    OrderItem::create([
                        'order_id' => $order->id,
                        'product' => $item['name'] ?? 'Unknown',
                        'variant' => $item['variant'] ?? '',
                        'qty' => $item['qty'] ?? 1,
                        'price' => $item['price'] ?? 0,
                        'details' => isset($item['selectionDetails']) ? $item['selectionDetails'] : null,
                        'image' => $item['image'] ?? null,
                        'created_at' => now(),
                    ]);

                }

                // Create Notification
                DB::table('notifications')->insert([
                    'user_id' => $user->id,
                    'title' => '🧾 Order Placed',
                    'message' => "Your order #{$order->id} has been placed successfully and is now pending.",
                    'type' => 'order_placed',
                    'is_read' => 0,
                    'action_url' => '/customer/orders',
                    'created_at' => now(),
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Order created successfully.',
                    'order_id' => $order->id,
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
            Log::error('Order creation failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to create order. ' . $e->getMessage()
            ], 500);
        }
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
                    'payment' => $request->input('payment', 'COD'),
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

                // Notify User
                DB::table('notifications')->insert([
                    'user_id' => $user->id,
                    'title' => '🎂 Custom Cake Request',
                    'message' => "We've received your request for order #{$order->id}. We will review it and provide a quote soon.",
                    'type' => 'order_placed',
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
    public function show(Request $request, $id)
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
    public function cancel(Request $request, $id)
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
    public function updateStatus(Request $request, $id)
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
                if (strtolower($newStatus) === 'to receive') $type = 'order_received';

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

        if (strtolower($newStatus) === 'to receive') {
            $this->sendSmsNotification($order);
        }

        $type = 'order';
        if (strtolower($newStatus) == 'completed') $type = 'order_completed';
        if (strtolower($newStatus) == 'cancelled') $type = 'order_cancelled';
        if (strtolower($newStatus) == 'to receive') {
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
    private function sendSmsNotification($order, string $status)
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
                'to receive' => 'is ready for pickup or delivery',
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
