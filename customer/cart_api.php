<?php
require_once __DIR__ . '/cors.php';
session_start();

require_once __DIR__ . '/../includes/data.php';

header('Content-Type: application/json');

$action = $_GET['action'] ?? '';

try {

    // CREATE CART SESSION
    if (!isset($_SESSION['cart'])) {
        $_SESSION['cart'] = [];
    }

    switch ($action) {

        // ADD
        case 'add':

            $data = json_decode(file_get_contents('php://input'), true);

            if (!$data) {

                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid data'
                ]);

                exit;
            }

            $product_id =
                (int)($data['product_id'] ?? 0);

            $size =
                $data['size'] ?? 'slice';

            $quantity =
                (int)($data['quantity'] ?? 1);

            if ($product_id <= 0) {

                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid product'
                ]);

                exit;
            }

            // GET PRODUCT
            $products = db_all("SELECT * FROM products");

            $product = null;

            foreach ($products as $p) {

                if ($p['id'] == $product_id) {
                    $product = $p;
                    break;
                }
            }

            if (!$product) {

                echo json_encode([
                    'success' => false,
                    'message' => 'Product not found'
                ]);

                exit;
            }

            // PRICE
            $price = 0;

            if ($size === 'slice') {
                $price = $product['slice_price'];
            }

            if ($size === 'small') {
                $price = $product['small_price'];
            }

            if ($size === 'big') {
                $price = $product['big_price'];
            }

           // ALWAYS CREATE UNIQUE ITEM

$_SESSION['cart'][] = [

    'key' => uniqid('cart_', true),

    'product_id' => $product_id,

    'name' => $product['name'],

    'image' => $product['image'],

    'size' => $size,

    'price' => $price,

    'quantity' => $quantity,

    'subtotal' => $price * $quantity
];

            // COUNT
            $count = 0;

            foreach ($_SESSION['cart'] as $item) {
                $count += $item['quantity'];
            }

            $_SESSION['cart_count'] = $count;

            echo json_encode([
                'success' => true,
                'count' => $count,
                'message' => 'Added to cart'
            ]);

            exit;


        // COUNT
        case 'count':

            $count = 0;

            foreach ($_SESSION['cart'] as $item) {
                $count += $item['quantity'];
            }

            echo json_encode([
                'success' => true,
                'count' => $count
            ]);

            exit;


        // ITEMS
        case 'items':

            echo json_encode([
                'success' => true,
                'items' => $_SESSION['cart']
            ]);

            exit;


        // REMOVE
        case 'remove':

            $data = json_decode(file_get_contents('php://input'), true);

            $key = $data['key'] ?? '';

            $_SESSION['cart'] = array_values(array_filter(
                $_SESSION['cart'],
                fn($item) => $item['key'] !== $key
            ));

            $count = 0;

            foreach ($_SESSION['cart'] as $item) {
                $count += $item['quantity'];
            }

            $_SESSION['cart_count'] = $count;

            echo json_encode([
                'success' => true,
                'count' => $count
            ]);

            exit;


        // UPDATE QUANTITY
        case 'update_quantity':

            $data = json_decode(file_get_contents('php://input'), true);

            $key = $data['key'] ?? '';

            $qty = (int)($data['quantity'] ?? 1);

            if ($qty < 1) {
                $qty = 1;
            }

            foreach ($_SESSION['cart'] as &$item) {

                if ($item['key'] === $key) {

                    $item['quantity'] = $qty;

                    $item['subtotal'] =
                        $item['price'] * $qty;

                    break;
                }
            }

            $count = 0;

            foreach ($_SESSION['cart'] as $item) {
                $count += $item['quantity'];
            }

            $_SESSION['cart_count'] = $count;

            echo json_encode([
                'success' => true,
                'count' => $count
            ]);

            exit;


        default:

            echo json_encode([
                'success' => false,
                'message' => 'Invalid action'
            ]);

            exit;
    }

} catch (Exception $e) {

    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);

}
?>
