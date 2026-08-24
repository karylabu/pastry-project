<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\CustomCakeOrder;
use App\Models\Product;
use App\Models\User;
use App\Http\Requests\StoreOrderRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class OrderController extends Controller
{
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

                    // Deduct stock if product ID is provided
                    if (isset($item['id'])) {
                        Product::where('id', $item['id'])->decrement('stock', $item['qty'] ?? 1);
                    }
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

        $order = Order::where('id', $id)
            ->where('user_id', $user->id)
            ->first();

        if (!$order) {
            return response()->json(['success' => false, 'message' => 'Order not found.'], 404);
        }

        if ($order->status !== 'Pending') {
            return response()->json(['success' => false, 'message' => 'Only pending orders can be cancelled.'], 400);
        }

        $order->update(['status' => 'Cancelled']);

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
        if (!$user || !in_array($user->role, ['admin', 'staff'])) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $order = Order::find($id);
        if (!$order) {
            return response()->json(['success' => false, 'message' => 'Order not found.'], 404);
        }

        $order->update(['status' => $request->status]);

        // Notify customer about status change
        $type = 'order';
        if (strtolower($request->status) == 'completed') $type = 'order_completed';
        if (strtolower($request->status) == 'cancelled') $type = 'order_cancelled';
        if (strtolower($request->status) == 'to receive') {
            $type = 'order_received';
            $this->sendSmsNotification($order);
        }

        DB::table('notifications')->insert([
            'user_id' => $order->user_id,
            'title' => '📦 Order Update',
            'message' => "Your order #{$order->id} status has been updated to {$request->status}.",
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

    /**
     * Send SMS notification via iProgSMS.
     */
    private function sendSmsNotification($order)
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

            $message = "Good day from Pastry Project! Your order #{$order->id} is now ready for pickup/delivery. Thank you!";

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
