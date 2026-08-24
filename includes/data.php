<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Ensure compatibility helpers exist (db(), db_all(), db_run(), etc.).
$compat = __DIR__ . '/../laravel/legacy_compat.php';
if (file_exists($compat)) {
    require_once $compat;
}

if (!function_exists('db_all')) {
    trigger_error(
        'Legacy DB compatibility helpers not found. Please verify laravel/legacy_compat.php is accessible.',
        E_USER_ERROR
    );
}

require_once __DIR__ . '/db.php';

/* =========================
   LOAD DATABASE
========================= */

function &getDB(): array {

    static $db = null;

    if ($db === null) {

        $db = _load_db();
    }

    return $db;
}

function _load_db(): array {

    $products =
        db_all(
            'SELECT * FROM products ORDER BY id'
        );

    foreach ($products as &$p) {

        $p['id'] =
            (int)$p['id'];

        $p['price'] =
            (float)$p['price'];

        $p['stock'] =
            (int)$p['stock'];

        $p['available'] =
            (bool)$p['available'];
    }

    $ordersRaw =
        db_all(
            'SELECT * FROM orders ORDER BY id'
        );

    $itemsRaw =
        db_all(
            'SELECT * FROM order_items'
        );

    $itemsByOrder = [];

    foreach ($itemsRaw as $it) {

        $itemsByOrder[
            $it['order_id']
        ][] = [

            'product' =>
                $it['product'],

            'qty' =>
                (int)$it['qty'],

            'price' =>
                (float)$it['price']
        ];
    }

    $orders = [];

    foreach ($ordersRaw as $o) {

        $orders[] = [

            'id' =>
                (int)($o['id'] ?? 0),

            'customer' =>
                $o['customer'] ?? $o['phone'] ?? '',

            'email' =>
                $o['email'] ?? '',

            'type' =>
                $o['type'] ?? '',

            'status' =>
                $o['status'] ?? '',

            'total' =>
                (float)($o['total'] ?? 0),

            'items' =>
                $itemsByOrder[$o['id']]
                ?? [],

            'date' =>
                $o['order_date'] ?? $o['created_at'] ?? '',

            'payment' =>
                $o['payment'] ?? '',

            'address' =>
                $o['address'] ?? '',
        ];
    }

    return [

        'products' =>
            $products,

        'orders' =>
            $orders
    ];
}

/* =========================
   UPDATE ORDER STATUS
========================= */

function db_update_order_status(
    $orderId,
    $newStatus
) {

    db_run(
        "UPDATE orders
         SET status = ?
         WHERE id = ?",
        [
            $newStatus,
            $orderId
        ]
    );

    return true;
}

/* =========================
   PLACE ORDER
========================= */

function db_place_order($data) {

    $pdo = db();

    $subtotal =
        array_sum(

            array_map(

                fn($i) =>
                    $i['price']
                    *
                    $i['qty'],

                $data['items']
            )
        );

    $delivery_fee = 50;

    $grand_total =
        $subtotal +
        $delivery_fee;

    $today =
        date('Y-m-d');

    $pdo->beginTransaction();

    db_run(

        "INSERT INTO orders
        (
            customer,
            email,
            type,
            status,
            total,
            payment,
            address,
            order_date
        )
        VALUES
        (
            ?,?,?,?,?,?,?,?
        )",

        [

            $data['customer'],

            $data['email'],

            $data['type'],

            'Pending',

            $grand_total,

            $data['payment'],

            $data['address'],

            $today
        ]
    );

    $orderId =
        db_insert_id();

    foreach ($data['items'] as $i) {

        db_run(

            "INSERT INTO order_items
            (
                order_id,
                product,
                qty,
                price
            )
            VALUES
            (
                ?,?,?,?
            )",

            [

                $orderId,

                $i['product'],

                $i['qty'],

                $i['price']
            ]
        );
    }

    $pdo->commit();

    return $orderId;
}

/* =========================================================
   CART SYSTEM
========================================================= */

function add_to_cart(
    $productId,
    $size = 'slice',
    $quantity = 1
) {

    $db = &getDB();

    if (!isset($_SESSION['cart'])) {

        $_SESSION['cart'] = [];
    }

    foreach ($db['products'] as $p) {

        if ($p['id'] == $productId) {

            $category =
                strtolower(
                    $p['category']
                );

            $size =
                strtolower(
                    trim($size)
                );

            /* MEALS */

            if ($category === 'meals') {

                switch ($size) {

                    case 'regular':

                        $price =
                            $p['price'];

                    break;

                    case 'meal':

                        $price =
                            $p['meal_price']
                            ??
                            $p['price'];

                    break;

                    case 'combo':
                    case 'combo meal':

                        $price =
                            $p['combo_price']
                            ??
                            $p['price'];

                        $size = 'combo';

                    break;

                    default:

                        $price =
                            $p['price'];

                        $size =
                            'regular';

                    break;
                }

            } else {

                /* CAKES */

                if ($size === 'big') {

                    $price =
                        $p['big_price']
                        ??
                        $p['price'];

                } elseif ($size === 'small') {

                    $price =
                        $p['small_price']
                        ??
                        $p['price'];

                } else {

                    $price =
                        ($p['slice_price'] ?? 0) > 0
                        ? $p['slice_price']
                        : $p['price'];

                    $size = 'slice';
                }
            }

            $price =
                (float)$price;

            $key =
                $productId
                .
                '_'
                .
                $size;

            /* MERGE SAME ITEM */

            if (
                !isset(
                    $_SESSION['cart'][$key]
                )
            ) {

                $_SESSION['cart'][$key] = [

                    'key' =>
                        $key,

                    'product' =>
                        $p,

                    'quantity' =>
                        (int)$quantity,

                    'price' =>
                        $price,

                    'size' =>
                        $size
                ];

            } else {

                $_SESSION['cart'][$key]['quantity']
                    +=
                    (int)$quantity;
            }

            return true;
        }
    }

    return false;
}

/* =========================
   GET CART ITEMS
========================= */

function get_cart_items() {

    if (!isset($_SESSION['cart'])) {

        return [];
    }

    $items = [];

    foreach ($_SESSION['cart'] as $item) {

        if (!isset($item['product'])) {
            continue;
        }

        $category =
            strtolower(
                $item['product']['category']
            );

        if ($category === 'meals') {

            $label = match($item['size']) {

                'regular' =>
                    'Regular',

                'meal' =>
                    'Meal',

                'combo' =>
                    'Combo Meal',

                default =>
                    'Regular'
            };

        } else {

            $label = match($item['size']) {

                'slice' =>
                    'Slice',

                'small' =>
                    'Small',

                'big' =>
                    'Big',

                default =>
                    ''
            };
        }

        $price =
            (float)$item['price'];

        $qty =
            (int)$item['quantity'];

        $items[] = [

            'key' =>
                $item['key'],

            'product' =>
                $item['product'],

            'quantity' =>
                $qty,

            'price' =>
                $price,

            'subtotal' =>
                $price * $qty,

            'size_label' =>
                $label
        ];
    }

    return $items;
}

/* =========================
   TOTAL
========================= */

function get_cart_total() {

    return array_sum(

        array_column(
            get_cart_items(),
            'subtotal'
        )
    );
}

/* =========================
   COUNT
========================= */

function get_cart_count() {

    $count = 0;

    foreach (get_cart_items() as $i) {

        $count +=
            $i['quantity'];
    }

    return $count;
}

/* =========================
   UPDATE
========================= */

function update_cart_item(
    $key,
    $qty
) {

    if (
        isset(
            $_SESSION['cart'][$key]
        )
    ) {

        if ($qty <= 0) {

            unset(
                $_SESSION['cart'][$key]
            );

        } else {

            $_SESSION['cart'][$key]['quantity']
                =
                (int)$qty;
        }
    }
}

/* =========================
   REMOVE
========================= */

function remove_from_cart($key) {

    unset(
        $_SESSION['cart'][$key]
    );
}

/* =========================
   CLEAR
========================= */

function clear_cart() {

    $_SESSION['cart'] = [];
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

function db_get_notifications(
    $userId,
    $limit = 50
) {

    return db_all(

        "SELECT *
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT $limit",

        [$userId]
    );
}

function db_get_unread_notifications(
    $userId
) {

    return db_all(

        "SELECT *
         FROM notifications
         WHERE user_id = ?
         AND is_read = 0",

        [$userId]
    );
}

function db_add_notification($data) {

    db_run(

        "INSERT INTO notifications
        (
            user_id,
            type,
            title,
            message,
            action_url,
            is_read,
            created_at
        )
        VALUES
        (
            ?,?,?,?,?,0,NOW()
        )",

        [

            $data['user_id'],

            $data['type']
            ?? 'Info',

            $data['title']
            ?? '',

            $data['message']
            ?? '',

            $data['action_url']
            ?? ''
        ]
    );
}

function db_mark_notification_read($id) {

    db_run(

        "UPDATE notifications
         SET is_read = 1
         WHERE id = ?",

        [$id]
    );
}

function db_mark_all_notifications_read(
    $userId
) {

    db_run(

        "UPDATE notifications
         SET is_read = 1
         WHERE user_id = ?",

        [$userId]
    );
}

function db_delete_notification($id) {

    db_run(

        "DELETE FROM notifications
         WHERE id = ?",

        [$id]
    );
}
?>