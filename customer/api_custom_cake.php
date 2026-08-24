<?php
/**
 * api_custom_cake.php
 *
 * Receives the Customized Cakes form (FormData: name, email, phone,
 * event_date, details, files[]) and saves it into the database:
 *   1. Inserts a row into `orders`        -> so it shows up in Orders/Admin
 *   2. Inserts a row into `custom_cake_orders`, linked via order_id
 *
 * Adjust the db connection block below to match your existing
 * connection file (e.g. require 'db.php';) if you already have one.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// ---------------------------------------------------------------
// 1. DATABASE CONNECTION
// ---------------------------------------------------------------
require_once __DIR__ . '/../includes/db.php';
if (!$conn) {
    echo json_encode(['success' => false, 'message' => 'DB connection failed']);
    exit;
}

// ---------------------------------------------------------------
// 2. READ FORM FIELDS
// ---------------------------------------------------------------
$name      = trim($_POST['name'] ?? '');
$email     = trim($_POST['email'] ?? '');
$phone     = trim($_POST['phone'] ?? '');
$eventDate = trim($_POST['pickup_date'] ?? $_POST['event_date'] ?? '');   // accept pickup_date or event_date
$details   = trim($_POST['details'] ?? '');
$userId    = intval($_POST['user_id'] ?? 0);
if ($userId <= 0) {
    $userId = null;
}
$deliveryAddress = trim($_POST['delivery_address'] ?? '');
$deliveryMethod = trim($_POST['delivery_method'] ?? 'Pickup');
$pickupDate = trim($_POST['pickup_date'] ?? '');
$pickupTime = trim($_POST['pickup_time'] ?? '');
$deliveryDate = $pickupDate !== '' ? $pickupDate : null;
$deliveryTime = $pickupTime !== '' ? $pickupTime : null;
$cakeSize = trim($_POST['cake_size'] ?? '');
$servings = trim($_POST['servings'] ?? '');
$cakeFlavor = trim($_POST['cake_flavor'] ?? '');
$fillingFlavor = trim($_POST['filling_flavor'] ?? '');
$frostingType = trim($_POST['frosting_type'] ?? '');
$occasion = trim($_POST['occasion'] ?? '');
$theme = trim($_POST['theme'] ?? '');
$cakeColor = trim($_POST['cake_color'] ?? '');
$customMessage = trim($_POST['custom_message'] ?? '');
$specialInstructions = trim($_POST['special_instructions'] ?? '');
$addons = json_decode(trim($_POST['addons'] ?? '[]'), true) ?: [];
$estimatedPrice = trim($_POST['estimated_price'] ?? '');
$quantity = intval($_POST['quantity'] ?? 1);
$totalAmount = trim($_POST['total_amount'] ?? '');

if ($name === '') {
    echo json_encode(['success' => false, 'message' => 'Name is required.']);
    exit;
}

// ---------------------------------------------------------------
// 3. HANDLE UPLOADED REFERENCE IMAGES
// ---------------------------------------------------------------
$uploadDir = __DIR__ . '/uploads/custom_cake/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$savedFiles = [];
if (!empty($_FILES['files']['name'][0])) {
    foreach ($_FILES['files']['tmp_name'] as $i => $tmpName) {
        $originalName = basename($_FILES['files']['name'][$i]);
        $ext          = pathinfo($originalName, PATHINFO_EXTENSION);
        $safeName     = uniqid('cc_') . '.' . $ext;
        $destPath     = $uploadDir . $safeName;

        if (move_uploaded_file($tmpName, $destPath)) {
            // store the relative path that the frontend/admin can use to display it
            $savedFiles[] = 'uploads/custom_cake/' . $safeName;
        }
    }
}
$inspoImagesJson = json_encode($savedFiles);

// ---------------------------------------------------------------
// 4. INSERT INTO `orders`
//    Custom cake requests start with no fixed price (quote pending),
//    so totals are 0 and status is 'Pending Quote'.
// ---------------------------------------------------------------
$itemsJson = json_encode([[
    'name'             => 'Custom Cake Request',
    'qty'              => 1,
    'price'            => 0,
    'selectionDetails' => ['details' => $details],
]]);

$method  = $deliveryMethod ?: 'Pickup';
$payment = 'COD';      // payment is decided once the quote is confirmed
$status  = 'Pending Quote';

$customDetails = [
    'customer_name' => $name,
    'email' => $email,
    'phone' => $phone,
    'delivery_method' => $deliveryMethod,
    'delivery_address' => $deliveryAddress,
    'pickup_date' => $pickupDate,
    'pickup_time' => $pickupTime,
    'cake_size' => $cakeSize,
    'servings' => $servings,
    'cake_flavor' => $cakeFlavor,
    'filling_flavor' => $fillingFlavor,
    'frosting_type' => $frostingType,
    'occasion' => $occasion,
    'theme' => $theme,
    'cake_color' => $cakeColor,
    'custom_message' => $customMessage,
    'special_instructions' => $specialInstructions,
    'addons' => $addons,
    'estimated_price' => $estimatedPrice,
    'quantity' => $quantity,
    'total_amount' => $totalAmount,
    'details' => $details,
];
$customDetailsJson = json_encode($customDetails);

$stmt = $conn->prepare(
    "INSERT INTO orders
        (items, subtotal, delivery_fee, total, method, delivery_date, delivery_time, payment, address, phone, created_at, status, payment_status, customer, email, user_id)
     VALUES (?, 0, 0, 0, ?, ?, ?, ?, ?, ?, NOW(), ?, 'pending', ?, ?, ?)"
);
$stmt->bind_param('ssssssssssi', $itemsJson, $method, $deliveryDate, $deliveryTime, $payment, $deliveryAddress, $phone, $status, $name, $email, $userId);

if (!$stmt->execute()) {
    echo json_encode(['success' => false, 'message' => 'Failed to create order.']);
    exit;
}
$orderId = $conn->insert_id;
$stmt->close();

// ---------------------------------------------------------------
// 5. INSERT INTO `custom_cake_orders`
// ---------------------------------------------------------------
$stmt2 = $conn->prepare(
    "INSERT INTO custom_cake_orders
        (order_id, cake_size, quantity, flavor, filling, frosting, occasion, theme_design, preferred_colors, tiers, dedication, notes, estimated_price, inspo_images)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
$stmt2->bind_param('isisssssssssds', $orderId, $cakeSize, $quantity, $cakeFlavor, $fillingFlavor, $frostingType, $occasion, $theme, $cakeColor, $cakeSize, $customMessage, $customDetailsJson, $estimatedPrice, $inspoImagesJson);

if (!$stmt2->execute()) {
    echo json_encode(['success' => false, 'message' => 'Order created, but failed to save cake details.']);
    exit;
}
$stmt2->close();

// ---------------------------------------------------------------
// 6. (OPTIONAL) INSERT A NOTIFICATION FOR ADMIN
// ---------------------------------------------------------------
// Uncomment and adjust to match your `notifications` table columns if you
// want admins to see an alert as soon as a custom cake request comes in.
//
// $msg = "New custom cake request from {$name} (Order #{$orderId})";
// $conn->query("INSERT INTO notifications (order_id, message, created_at) VALUES ({$orderId}, '" . $conn->real_escape_string($msg) . "', NOW())");

echo json_encode([
    'success'  => true,
    'order_id' => $orderId,
    'message'  => 'Custom cake request submitted successfully.',
]);

$conn->close();