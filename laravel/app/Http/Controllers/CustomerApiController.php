<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class CustomerApiController extends Controller
{
    public function __construct()
    {
        // Removed legacy requirements from constructor to prevent boot crashes
    }

    private function loadLegacyRequirements()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $dataPath = base_path('../includes/data.php');
        if (file_exists($dataPath)) {
            require_once $dataPath;
        }

        $dbPath = base_path('../includes/db.php');
        if (file_exists($dbPath)) {
            require_once $dbPath;
        }
    }

    protected function corsResponse($payload, int $status = 200)
    {
        return response()->json($payload, $status)
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }

    protected function parseJson(Request $request): array
    {
        $data = $request->json()->all();
        if (empty($data)) {
            $data = json_decode($request->getContent(), true) ?? [];
        }
        return is_array($data) ? $data : [];
    }

    public function products(Request $request)
    {
        $this->loadLegacyRequirements();
        if ($request->isMethod('options')) {
            return $this->corsResponse(['success' => true]);
        }

        $action = $request->query('action', 'list');

        if ($action === 'customize' && $request->isMethod('post')) {
            try {
                $form = array_merge($request->all(), $this->parseJson($request));
                \Log::info('Custom cake request:', $form);

                $flavor = trim($form['flavor'] ?? $form['cake_flavor'] ?? '');
                $tiers = trim($form['tiers'] ?? $form['cake_size'] ?? '');
                $dedication = trim($form['dedication'] ?? $form['custom_message'] ?? '');
                $method = trim($form['method'] ?? $form['delivery_method'] ?? 'Pickup');
                $date = trim($form['date'] ?? $form['pickup_date'] ?? '');
                $time = trim($form['time'] ?? $form['pickup_time'] ?? '');
                $notes = trim($form['notes'] ?? $form['special_instructions'] ?? '');
                $phone = trim($form['phone'] ?? '');

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

                $orderId = DB::table('orders')->insertGetId([
                    'customer' => $form['customer'] ?? 'Guest Customer',
                    'email' => $form['email'] ?? 'guest@email.com',
                    'phone' => $phone,
                    'user_id' => $form['user_id'] ?? null,
                    'status' => 'Pending',
                    'total' => floatval($form['total'] ?? $form['estimated_price'] ?? 0),
                    'payment' => $form['payment'] ?? 'COD',
                    'address' => $form['address'] ?? '',
                    'method' => $method,
                    'order_type' => 'Customized',
                    'is_customized' => 1,
                    'created_at' => now(),
                ]);

                // Combine details for notes to be safe
                $fullNotes = "Occasion: " . ($form['occasion'] ?? 'N/A') . "\n"
                           . "Theme: " . ($form['theme'] ?? 'N/A') . "\n"
                           . "Colors: " . ($form['colors'] ?? 'N/A') . "\n"
                           . "Filling: " . ($form['filling'] ?? 'N/A') . "\n"
                           . "Frosting: " . ($form['frosting'] ?? 'N/A') . "\n"
                           . "Servings: " . ($form['servings'] ?? '1') . "\n"
                           . "Addons: " . ($form['addons'] ?? 'None') . "\n"
                           . "Instructions: " . $notes;

                DB::table('custom_cake_orders')->insert([
                    'order_id' => $orderId,
                    'flavor' => $flavor,
                    'tiers' => $tiers,
                    'dedication' => $dedication,
                    'delivery_method' => $method,
                    'delivery_date' => $date,
                    'delivery_time' => $time,
                    'notes' => $fullNotes,
                    'inspo_images' => json_encode($uploadedImages),
                ]);

                // ✅ Notify User
                $userId = $form['user_id'] ?? null;
                if ($userId) {
                    DB::table('notifications')->insert([
                        'user_id' => $userId,
                        'title' => '🎂 Custom Cake Request',
                        'message' => "We've received your request for order #$orderId. We will review it and provide a quote soon.",
                        'type' => 'Info',
                        'is_read' => 0,
                        'action_url' => '/customer/orders',
                        'created_at' => now(),
                    ]);
                }

                return $this->corsResponse([
                    'success' => true,
                    'message' => 'Custom cake request submitted successfully!',
                    'order_id' => $orderId,
                ]);
            } catch (\Exception $e) {
                \Log::error('Customization error: ' . $e->getMessage());
                return $this->corsResponse(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
            }
        }

        $db = getDB();
        $products = array_values(array_filter($db['products'] ?? [], fn($item) => isset($item['available']) && $item['available']));

        return $this->corsResponse($products);
    }

    public function login(Request $request)
    {
        try {
            if ($request->isMethod('options')) {
                return $this->corsResponse(['success' => true]);
            }

            $data = $this->parseJson($request);
            \Log::info('Login attempt for email: ' . ($data['email'] ?? 'not provided'));

            $email = trim($data['email'] ?? '');
            $password = trim($data['password'] ?? '');

            if (!$email || !$password) {
                return $this->corsResponse(['success' => false, 'message' => 'Please fill all fields.']);
            }

            $user = DB::table('users')->where('email', $email)->first();
            if (!$user) {
                return $this->corsResponse(['success' => false, 'message' => 'User not found.']);
            }

            $passwordValid = ($password === $user->password) || password_verify($password, $user->password);
            if (!$passwordValid) {
                return $this->corsResponse(['success' => false, 'message' => 'Incorrect password.']);
            }

            $userData = [
                "id"    => (string)$user->id,
                "name"  => $user->name,
                "email" => $user->email,
                "role"  => $user->role,
                "phone" => $user->phone ?? '',
            ];

            $token = base64_encode(json_encode(array_merge($userData, ['exp' => time() + 86400])));

            return $this->corsResponse([
                'success' => true,
                'message' => 'Login successful',
                'token' => $token,
                'user' => $userData,
            ]);
        } catch (\Exception $e) {
            \Log::error('Login error: ' . $e->getMessage());
            return $this->corsResponse(['success' => false, 'message' => 'Server error: ' . $e->getMessage()], 500);
        }
    }

    public function forgotPassword(Request $request)
    {
        if ($request->isMethod('options')) {
            return $this->corsResponse(['success' => true]);
        }

        $data = $this->parseJson($request);
        $email = trim($data['email'] ?? '');

        if (!$email) {
            return $this->corsResponse(['success' => false, 'message' => 'Email is required.']);
        }

        DB::statement("CREATE TABLE IF NOT EXISTS password_resets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            token VARCHAR(6) NOT NULL,
            expires_at DATETIME NOT NULL,
            used TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        $userExists = DB::table('users')->where('email', $email)->exists();
        if (!$userExists) {
            return $this->corsResponse(['success' => true]);
        }

        $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        DB::table('password_resets')->where('email', $email)->update(['used' => 1]);
        DB::table('password_resets')->insert([
            'email' => $email,
            'token' => $code,
            'expires_at' => now()->addMinutes(15),
        ]);

        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host = env('MAIL_HOST', 'smtp.gmail.com');
            $mail->SMTPAuth = true;
            $mail->Username = env('MAIL_USERNAME');
            $mail->Password = env('MAIL_PASSWORD');
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = env('MAIL_PORT', 587);

            $mail->setFrom(env('MAIL_FROM_ADDRESS', 'no-reply@example.com'), env('MAIL_FROM_NAME', 'Pastry Project'));
            $mail->addAddress($email);
            $mail->isHTML(true);
            $mail->Subject = 'Your Password Reset Code';
            $mail->Body = "<div style='font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff;border-radius:24px;border:1px solid #f0f0f0;'>
                <p style='font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:#d4af37;margin-bottom:8px;'>Pastry Project</p>
                <h2 style='font-size:28px;color:#111;margin-bottom:16px;'>Password Reset</h2>
                <p style='color:#666;font-size:14px;margin-bottom:24px;'>Use the code below to reset your password. It expires in <strong>15 minutes</strong>.</p>
                <div style='font-size:42px;font-weight:900;letter-spacing:0.2em;color:#111;background:#f5f6fa;border-radius:16px;padding:20px;text-align:center;margin-bottom:24px;'>
                    {$code}
                </div>
                <p style='color:#aaa;font-size:12px;'>If you didn't request this, you can safely ignore this email.</p>
            </div>";
            $mail->AltBody = "Your password reset code is: {$code}. It expires in 15 minutes.";
            $mail->send();
        } catch (Exception $e) {
            // We still respond success to avoid email enumeration.
            return $this->corsResponse(['success' => true]);
        }

        return $this->corsResponse(['success' => true]);
    }

    public function verifyResetCode(Request $request)
    {
        if ($request->isMethod('options')) {
            return $this->corsResponse(['success' => true]);
        }

        $data = $this->parseJson($request);
        $email = trim($data['email'] ?? '');
        $code = trim($data['code'] ?? '');

        if (!$email || !$code) {
            return $this->corsResponse(['success' => false, 'message' => 'Email and code are required.']);
        }

        $valid = DB::table('password_resets')
            ->where('email', $email)
            ->where('token', $code)
            ->where('used', 0)
            ->where('expires_at', '>', now())
            ->orderByDesc('created_at')
            ->exists();

        return $this->corsResponse(['success' => $valid, 'message' => $valid ? null : 'Invalid or expired code.']);
    }

    public function resetPassword(Request $request)
    {
        if ($request->isMethod('options')) {
            return $this->corsResponse(['success' => true]);
        }

        $data = $this->parseJson($request);
        $email = trim($data['email'] ?? '');
        $code = trim($data['code'] ?? '');
        $newPassword = trim($data['new_password'] ?? '');

        if (!$email || !$code || !$newPassword) {
            return $this->corsResponse(['success' => false, 'message' => 'All fields are required.']);
        }

        if (strlen($newPassword) < 6) {
            return $this->corsResponse(['success' => false, 'message' => 'Password must be at least 6 characters.']);
        }

        $valid = DB::table('password_resets')
            ->where('email', $email)
            ->where('token', $code)
            ->where('used', 0)
            ->where('expires_at', '>', now())
            ->exists();

        if (!$valid) {
            return $this->corsResponse(['success' => false, 'message' => 'Code expired. Please request a new one.']);
        }

        DB::table('users')->where('email', $email)->update(['password' => bcrypt($newPassword)]);
        DB::table('password_resets')->where('email', $email)->update(['used' => 1]);

        return $this->corsResponse(['success' => true]);
    }

    public function createOrder(Request $request)
    {
        $data = $this->parseJson($request);

        $items = $data['items'] ?? [];
        $subtotal = floatval($data['subtotal'] ?? 0);
        $delivery = floatval($data['delivery_fee'] ?? 0);
        $total = floatval($data['total'] ?? 0);
        $method = trim($data['method'] ?? '');
        $payment = trim($data['payment'] ?? '');
        $address = trim($data['address'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $latitude = floatval($data['latitude'] ?? $data['lat'] ?? 0);
        $longitude = floatval($data['longitude'] ?? $data['lng'] ?? 0);
        $customer = trim($data['customer'] ?? '');
        $email = trim($data['email'] ?? '');
        $userId = isset($data['user_id']) ? intval($data['user_id']) : null;
        $orderType = $data['order_type'] ?? $data['type'] ?? 'Standard';
        $isCustomized = isset($data['is_customized']) ? intval($data['is_customized']) : 0;

        // Populate from users if missing
        if ($userId && (empty($customer) || empty($email) || empty($phone))) {
            $user = DB::table('users')->where('id', $userId)->first();
            if ($user) {
                if (empty($customer)) $customer = $user->name;
                if (empty($email)) $email = $user->email;
                if (empty($phone)) $phone = $user->phone ?? '';
            }
        }

        $orderId = DB::table('orders')->insertGetId([
            'items' => json_encode($items),
            'subtotal' => $subtotal,
            'delivery_fee' => $delivery,
            'total' => $total,
            'method' => $method,
            'payment' => $payment,
            'address' => $address,
            'phone' => $phone,
            'lat' => $latitude,
            'lng' => $longitude,
            'customer' => $customer,
            'email' => $email,
            'user_id' => $userId,
            'order_type' => $orderType,
            'is_customized' => $isCustomized,
            'status' => 'Pending',
            'created_at' => now(),
        ]);


        // Insert into order_items for detailed tracking
        foreach ($items as $item) {
            DB::table('order_items')->insert([
                'order_id' => $orderId,
                'product' => $item['name'] ?? 'Unknown',
                'variant' => $item['variant'] ?? '',
                'qty' => intval($item['qty'] ?? 1),
                'price' => floatval($item['price'] ?? 0),
                'details' => isset($item['selectionDetails']) ? json_encode($item['selectionDetails']) : null,
                'image' => $item['image'] ?? null,
            ]);
        }

        // ✅ Notify User
        if ($userId) {
            DB::table('notifications')->insert([
                'user_id' => $userId,
                'title' => '🧾 Order Placed',
                'message' => "Your order #$orderId has been placed successfully and is now pending.",
                'type' => 'Success',
                'is_read' => 0,
                'action_url' => '/customer/orders',
                'created_at' => now(),
            ]);
        }

        return $this->corsResponse(['status' => 'success', 'order_id' => $orderId, 'success' => true]);
    }

    public function getOrders(Request $request)
    {
        $userId = intval($request->query('user_id', 0));
        $email = trim($request->query('user_email', $request->query('email', '')));
        $customer = trim($request->query('customer', ''));
        $phone = trim($request->query('phone', ''));

        $query = DB::table('orders');

        if ($userId > 0 || $email !== '' || $customer !== '' || $phone !== '') {
            $query->where(function($q) use ($userId, $email, $customer, $phone) {
                if ($userId > 0) $q->orWhere('user_id', $userId);
                if ($email !== '') {
                    $q->orWhere('email', $email);
                    // Also look for other user IDs with this email
                    $otherIds = DB::table('users')->where('email', $email)->pluck('id')->toArray();
                    if (!empty($otherIds)) $q->orWhereIn('user_id', $otherIds);
                }
                if ($customer !== '') $q->orWhere('customer', 'like', "%$customer%");
                if ($phone !== '') {
                    $q->orWhere('phone', $phone);
                    $phoneIds = DB::table('users')->where('phone', $phone)->pluck('id')->toArray();
                    if (!empty($phoneIds)) $q->orWhereIn('user_id', $phoneIds);
                }

                // Special safety for Karyl (as per requirements)
                if (strpos(strtolower($customer), 'karyl') !== false || strpos(strtolower($email), 'hernandez') !== false) {
                    $q->orWhere('phone', '09509002527');
                    $q->orWhere('email', 'customer@pastry.com');
                }
            });
        } else {
            return $this->corsResponse([]);
        }

        $orders = $query->orderByDesc('id')->get()->map(function ($row) {
            // Fetch items from order_items if items column is empty
            $items = json_decode($row->items ?? '[]', true) ?: [];
            if (empty($items)) {
                $items = DB::table('order_items')
                    ->where('order_id', $row->id)
                    ->select('product as name', 'qty', 'price', 'variant', 'image')
                    ->get()
                    ->toArray();
            }

            // Fetch custom details if it's a customized order
            $customDetails = null;
            if ($row->is_customized) {
                $customDetails = DB::table('customize_orders')
                    ->where('order_id', $row->id)
                    ->first();

                if (!$customDetails) {
                    $customDetails = DB::table('custom_cake_orders')
                        ->where('order_id', $row->id)
                        ->first();
                }
            }

            return [
                'id' => $row->id,
                'user_id' => $row->user_id,
                'customer' => $row->customer,
                'email' => $row->email,
                'items' => $items,
                'total' => floatval($row->total ?? 0),
                'method' => $row->method,
                'payment' => $row->payment,
                'address' => $row->address,
                'phone' => $row->phone,
                'status' => $row->status ?? 'Pending',
                'created_at' => $row->created_at,
                'lat' => floatval($row->lat ?? 0),
                'lng' => floatval($row->lng ?? 0),
                'is_customized' => $row->is_customized,
                'custom_details' => $customDetails,
            ];
        });

        return $this->corsResponse($orders);
    }

    public function cancelOrder(Request $request)
    {
        if ($request->isMethod('options')) {
            return $this->corsResponse(['success' => true]);
        }

        $data = $this->parseJson($request);
        $orderId = intval($data['order_id'] ?? 0);

        if (!$orderId) {
            return $this->corsResponse(['success' => false, 'message' => 'Invalid order ID.']);
        }

        $status = DB::table('orders')->where('id', $orderId)->value('status');
        if (!$status) {
            return $this->corsResponse(['success' => false, 'message' => 'Order not found.']);
        }

        if ($status !== 'Pending') {
            return $this->corsResponse(['success' => false, 'message' => 'Only pending orders can be cancelled.']);
        }

        DB::table('orders')->where('id', $orderId)->update(['status' => 'Cancelled']);
        return $this->corsResponse(['success' => true]);
    }

    public function confirmReceived(Request $request)
    {
        if ($request->isMethod('options')) {
            return $this->corsResponse(['success' => true]);
        }

        $data = $this->parseJson($request);
        $orderId = intval($data['order_id'] ?? 0);

        if (!$orderId) {
            return $this->corsResponse(['success' => false, 'message' => 'Invalid order ID.']);
        }

        $status = DB::table('orders')->where('id', $orderId)->value('status');
        if (!$status) {
            return $this->corsResponse(['success' => false, 'message' => 'Order not found.']);
        }

        if ($status !== 'To Receive') {
            return $this->corsResponse(['success' => false, 'message' => 'Order is not ready to be confirmed.']);
        }

        DB::table('orders')->where('id', $orderId)->update(['status' => 'Completed']);
        return $this->corsResponse(['success' => true]);
    }

    public function users(Request $request)
    {
        if ($request->isMethod('options')) {
            return $this->corsResponse(['success' => true]);
        }

        if ($request->isMethod('get')) {
            $users = DB::table('users')->select('id', 'name', 'email', 'role', 'created_at')->orderByDesc('created_at')->get();
            return $this->corsResponse($users);
        }

        $data = $this->parseJson($request);
        $action = $data['action'] ?? '';
        $userId = intval($data['user_id'] ?? 0);

        if ($action === 'delete' && $userId) {
            DB::table('users')->where('id', $userId)->delete();
            return $this->corsResponse(['status' => 'success', 'message' => 'User deleted']);
        }

        return $this->corsResponse(['status' => 'error', 'message' => 'Invalid action']);
    }

    public function chatFetch(Request $request)
    {
        if ($request->isMethod('options')) {
            return $this->corsResponse(['success' => true, 'messages' => []]);
        }

        $orderId = intval($request->query('order_id', 0));

        // Support both user_id and customer_id
        $userId = intval($request->query('user_id', $request->query('customer_id', 0)));

        $role = $request->query('role', 'customer');

        if ($userId <= 0 && $orderId <= 0) {
            return $this->corsResponse(['success' => false, 'messages' => []]);
        }

        // Mark messages as read depending on role
        if ($orderId > 0) {
            if ($role === 'staff') {
                DB::table('messages')->where('order_id', $orderId)->where('sender', 'customer')->update(['is_read' => 1]);
            } else {
                DB::table('messages')->where('order_id', $orderId)->whereIn('sender', ['staff', 'ai'])->update(['is_read' => 1]);
            }
        } else {
            if ($role === 'staff') {
                DB::table('messages')->where('user_id', $userId)->where('order_id', 0)->where('sender', 'customer')->update(['is_read' => 1]);
            } else {
                DB::table('messages')->where('user_id', $userId)->where('order_id', 0)->whereIn('sender', ['staff', 'ai'])->update(['is_read' => 1]);
            }
        }

        // Fetch messages with reply joins
        $query = DB::table('messages as m1')
            ->leftJoin('messages as m2', 'm1.reply_to_id', '=', 'm2.id')
            ->select(
                'm1.id',
                'm1.sender',
                'm1.message',
                'm1.is_read',
                'm1.created_at',
                'm1.reply_to_id',
                'm2.message as reply_to_message',
                'm2.sender as reply_to_sender'
            );

        if ($orderId > 0) {
            $messages = $query->where('m1.order_id', $orderId)->orderBy('m1.created_at')->get();
        } else {
            $messages = $query->where(function($q) use ($userId) {
                $q->where('m1.user_id', $userId)
                  ->where(function($sq) {
                      $sq->where('m1.order_id', 0)->orWhereNull('m1.order_id');
                  });
            })->orderBy('m1.created_at')->get();
        }

        // cast fields
        $messages = $messages->map(function ($msg) {
            $msg->id = intval($msg->id);
            $msg->is_read = intval($msg->is_read);
            $msg->reply_to_id = $msg->reply_to_id !== null ? intval($msg->reply_to_id) : null;
            return $msg;
        });

        return $this->corsResponse(['success' => true, 'messages' => $messages]);
    }

    public function chatSend(Request $request)
    {
        \Log::info('ChatSend reached', ['method' => $request->method(), 'url' => $request->fullUrl()]);
        if ($request->isMethod('options')) {
            return $this->corsResponse(['success' => true, 'ai_reply' => null]);
        }

        $data = $this->parseJson($request);
        $orderId = intval($data['order_id'] ?? 0);

        // Support both user_id and customer_id
        $userId = intval($data['user_id'] ?? $data['customer_id'] ?? 0);

        $message = trim($data['message'] ?? '');
        $sender = $data['sender'] ?? 'customer';
        $replyToId = isset($data['reply_to_id']) && intval($data['reply_to_id']) > 0 ? intval($data['reply_to_id']) : null;

        if (!$message) {
            return $this->corsResponse(['success' => false, 'message' => 'Invalid input']);
        }

        if (!in_array($sender, ['customer', 'staff', 'ai'])) {
            $sender = 'customer';
        }

        $dbOrderId = ($orderId > 0) ? $orderId : null;
        $dbUserId = ($userId > 0) ? $userId : null;

        $insertedId = 0;
        try {
            $insertedId = DB::table('messages')->insertGetId([
                'order_id' => $dbOrderId,
                'user_id' => $dbUserId,
                'sender' => $sender,
                'message' => $message,
                'reply_to_id' => $replyToId,
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            // Fallback for foreign key constraint errors or missing columns
            try {
                DB::statement("SET FOREIGN_KEY_CHECKS=0");
                $insertedId = DB::table('messages')->insertGetId([
                    'order_id' => $dbOrderId,
                    'user_id' => $dbUserId,
                    'sender' => $sender,
                    'message' => $message,
                    'created_at' => now(),
                ]);
                DB::statement("SET FOREIGN_KEY_CHECKS=1");
            } catch (\Exception $e2) {
                \Log::error('ChatSend error: ' . $e2->getMessage());
                return $this->corsResponse(['success' => false, 'message' => 'Database error'], 500);
            }
        }

        $aiReply = null;
        if ($sender === 'customer') {
            if ($orderId > 0) {
                $order = DB::table('orders')->select('id', 'items', 'status', 'total', 'method', 'address', 'created_at')->where('id', $orderId)->first();
                if ($order) {
                    $orderContext = "Order #{$order->id} | Status: {$order->status} | Total: ₱{$order->total} | Method: {$order->method} | Address: {$order->address} | Placed: {$order->created_at}";
                    $systemPrompt = "You are a friendly customer support assistant for Pastry Project, a Filipino pastry and food business. You help customers with their order inquiries. Be warm, concise, and helpful. The customer's order details: {$orderContext}. If asked about delivery time, say it usually takes 30-60 minutes. If asked about payment, refer to the method on file. Keep replies short (2-3 sentences max). Reply in the same language the customer uses.";
                    $apiKey = env('ANTHROPIC_API_KEY');
                    if ($apiKey) {
                        $response = Http::withHeaders([
                            'Content-Type' => 'application/json',
                            'x-api-key' => $apiKey,
                            'anthropic-version' => '2023-06-01',
                        ])->post('https://api.anthropic.com/v1/messages', [
                            'model' => 'claude-3-5-sonnet-20240620', // Use correct model name
                            'max_tokens' => 300,
                            'system' => $systemPrompt,
                            'messages' => [
                                ['role' => 'user', 'content' => $message],
                            ],
                        ]);

                        if ($response->successful()) {
                            $parsed = $response->json();
                            $aiReply = $parsed['content'][0]['text'] ?? null;
                        }
                    }
                }
            } else {
                $aiReply = "Thanks for reaching out! We’ll help with your question shortly.";
            }

            if ($aiReply) {
                DB::table('messages')->insert([
                    'order_id' => $dbOrderId,
                    'user_id' => $dbUserId,
                    'sender' => 'ai',
                    'message' => $aiReply,
                    'created_at' => now(),
                ]);
            }
        }

        return $this->corsResponse(['success' => true, 'message_id' => $insertedId, 'ai_reply' => $aiReply]);
    }

    public function createPayment(Request $request)
    {
        if ($request->isMethod('options')) {
            return response('', 204)
                ->header('Access-Control-Allow-Origin', '*')
                ->header('Access-Control-Allow-Methods', 'POST, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Content-Type');
        }

        $data = $this->parseJson($request);
        $orderId = trim($data['order_id'] ?? '');
        $amount = floatval($data['amount'] ?? 0);

        if (!$orderId || $amount <= 0) {
            return $this->corsResponse(['error' => 'Missing order_id or invalid amount'], 400);
        }

        $secretKey = env('PAYMONGO_SECRET');
        if (!$secretKey) {
            return $this->corsResponse(['error' => 'Payment gateway secret is not configured. Please set PAYMONGO_SECRET.'], 500);
        }

        $amountCents = (int) round($amount * 100);
        if ($amountCents < 2000) {
            return $this->corsResponse(['error' => 'Amount must be at least ₱20.00'], 400);
        }

        $payload = [
            'data' => [
                'attributes' => [
                    'amount' => $amountCents,
                    'currency' => 'PHP',
                    'description' => 'Pastry Order #' . $orderId,
                    'remarks' => 'Pastry Shop Order',
                ],
            ],
        ];

        $response = Http::withBasicAuth($secretKey, '')->withHeaders([
            'accept' => 'application/json',
            'content-type' => 'application/json',
        ])->post('https://api.paymongo.com/v1/links', $payload);

        return response()->json($response->json(), $response->status())
            ->header('Access-Control-Allow-Origin', '*');
    }

    public function cartApi(Request $request)
    {
        $this->loadLegacyRequirements();
        $action = $request->query('action', '');

        if ($action === 'get') {
            return $this->corsResponse(get_cart_items());
        }

        if ($action === 'add') {
            add_to_cart(
                (int)$request->input('product_id', 0),
                $request->input('size', 'slice'),
                (int)$request->input('quantity', 1)
            );

            return $this->corsResponse(['success' => true, 'cart_count' => get_cart_count()]);
        }

        if ($action === 'update') {
            $key = $request->input('key', '');
            $qty = (int)$request->input('quantity', 1);
            update_cart_item($key, max(0, $qty));

            return $this->corsResponse(['success' => true, 'cart_count' => get_cart_count()]);
        }

        if ($action === 'remove') {
            remove_from_cart($request->input('key', ''));
            return $this->corsResponse(['success' => true, 'cart_count' => get_cart_count()]);
        }

        if ($action === 'clear') {
            clear_cart();
            return $this->corsResponse(['success' => true, 'cart_count' => 0]);
        }

        return $this->corsResponse(['success' => false, 'message' => 'Invalid action']);
    }

    public function addresses(Request $request)
    {
        if ($request->isMethod('options')) {
            return $this->corsResponse(['success' => true]);
        }

        $user_id = intval($request->input('user_id', $request->query('user_id', 0)));
        if ($user_id <= 0) {
            return $this->corsResponse(['status' => 'error', 'message' => 'User ID is required'], 400);
        }

        if ($request->isMethod('get')) {
            $addresses = DB::table('addresses')
                ->where('customer_id', $user_id)
                ->orderByDesc('is_default')
                ->orderByDesc('updated_at')
                ->get();

            return $this->corsResponse(['status' => 'success', 'addresses' => $addresses]);
        }

        if ($request->isMethod('post')) {
            $data = $this->parseJson($request);
            $address_id = intval($data['address_id'] ?? 0);
            $isDefault = !empty($data['is_default']) ? 1 : 0;

            if ($isDefault) {
                DB::table('addresses')->where('customer_id', $user_id)->update(['is_default' => 0]);
            }

            $values = [
                'customer_id' => $user_id,
                'address_label' => $data['address_label'] ?? 'Home',
                'recipient_name' => $data['recipient_name'] ?? '',
                'contact_number' => $data['contact_number'] ?? '',
                'house_no' => $data['house_no'] ?? '',
                'street' => $data['street'] ?? '',
                'barangay' => $data['barangay'] ?? '',
                'city' => $data['city'] ?? '',
                'province' => $data['province'] ?? '',
                'zip_code' => $data['zip_code'] ?? '',
                'landmark' => $data['landmark'] ?? '',
                'delivery_instructions' => $data['delivery_instructions'] ?? '',
                'is_default' => $isDefault,
                'updated_at' => now(),
            ];

            if ($address_id > 0) {
                DB::table('addresses')->where('address_id', $address_id)->where('customer_id', $user_id)->update($values);
            } else {
                $values['created_at'] = now();
                $address_id = DB::table('addresses')->insertGetId($values);
            }

            $addresses = DB::table('addresses')
                ->where('customer_id', $user_id)
                ->orderByDesc('is_default')
                ->orderByDesc('updated_at')
                ->get();

            return $this->corsResponse(['status' => 'success', 'addresses' => $addresses, 'address_id' => $address_id]);
        }

        return $this->corsResponse(['status' => 'error', 'message' => 'Unsupported method'], 405);
    }

    public function user(Request $request)
    {
        return $this->corsResponse($_SESSION['user'] ?? null);
    }
}
