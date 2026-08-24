<?php
require_once __DIR__ . '/cors.php';
session_start();

require '../includes/data.php';

if (!isset($_SESSION['user'])) {

    header("Location: ../login.php");
    exit;
}

$user = $_SESSION['user'];

/* =========================
   ROLE CHECK
========================= */

$role = $user['role'] ?? 'customer';

if ($role !== 'customer') {

    header("Location: products.php");
    exit;
}

/* =========================
   SELECTED ITEMS
========================= */

$selectedKeys =
    $_POST['selected_items']
    ?? $_SESSION['selected_items']
    ?? [];

if (!is_array($selectedKeys)) {

    $selectedKeys = [];
}

if (empty($selectedKeys)) {

    header("Location: cart.php");
    exit;
}

/* SAVE SELECTED */
$_SESSION['selected_items'] =
    $selectedKeys;

/* =========================
   LOAD CART
========================= */

$cartItems =
    $_SESSION['cart'] ?? [];

$filteredItems = [];

foreach ($cartItems as $item) {

    if (
        isset($item['key']) &&
        in_array($item['key'], $selectedKeys)
    ) {

        $item['quantity'] =
            (int)($item['quantity'] ?? 1);

        $item['price'] =
            (float)($item['price'] ?? 0);

        $item['subtotal'] =
            $item['quantity'] *
            $item['price'];

        /* SIZE LABEL */
        $size =
            strtolower($item['size'] ?? '');

        $category =
            strtolower(
                $item['product']['category']
                ?? ''
            );

        if ($category === 'meals') {

            $item['size_label'] = match($size){

                'regular' => 'Regular',
                'meal'    => 'Meal',
                'combo'   => 'Combo Meal',

                default   => 'Regular'
            };

        } else {

            $item['size_label'] = match($size){

                'slice' => 'Slice',
                'small' => 'Small',
                'big'   => 'Big',

                default => ''
            };
        }

        $filteredItems[] = $item;
    }
}

/* =========================
   EMPTY CHECK
========================= */

if (empty($filteredItems)) {

    header("Location: cart.php");
    exit;
}

/* =========================
   PLACE ORDER
========================= */

if (
    $_SERVER['REQUEST_METHOD'] === 'POST'
    && isset($_POST['place_order'])
) {

    $address =
        trim($_POST['address'] ?? '');

    $payment =
        trim($_POST['payment'] ?? 'COD');

    if ($address === '') {

        $_SESSION['error'] =
            'Delivery address is required';

        header("Location: checkout.php");
        exit;
    }

    /* BUILD ITEMS */

    $items = [];

    foreach ($filteredItems as $item) {

        $items[] = [

            'product' =>
                $item['product']['name']
                ?? $item['name']
                ?? 'Product',

            'qty' =>
                (int)$item['quantity'],

            'price' =>
                (float)$item['price']
        ];
    }

    /* SAVE TO DATABASE */

    $orderId = db_place_order([

        'user_id' =>
            (int)($user['id'] ?? 0),

        'customer' =>
            $user['name'] ?? 'Customer',

        'email' =>
            $user['email'] ?? '',

        'type' =>
            'Delivery',

        'payment' =>
            $payment,

        'address' =>
            $address,

        'items' =>
            $items

    ]);

    /* =========================
       REMOVE ORDERED ITEMS
    ========================= */

    foreach ($selectedKeys as $key) {

        if (isset($_SESSION['cart'][$key])) {

            unset($_SESSION['cart'][$key]);
        }
    }

    /* UPDATE CART COUNT */

    $_SESSION['cart_count'] =
        get_cart_count();

    /* CLEAR */

    unset($_SESSION['selected_items']);

    $_SESSION['success'] =
        'Order placed successfully';

    $userId =
        (int)($user['id'] ?? 0);

    if ($userId > 0) {

        db_add_notification([

            'user_id' =>
                $userId,

            'type' =>
                'Success',

            'title' =>
                'Order Placed',

            'message' =>
                "Your order #{$orderId} has been placed successfully. We will update you once it is ready.",

            'action_url' =>
                'orders.php'
        ]);
    }

    /* =========================
       SUCCESS REDIRECT
    ========================= */

    header("Location: orders.php");
    exit;
}

/* =========================
   INVALID ACCESS
========================= */

header("Location: cart.php");
exit;
?>
