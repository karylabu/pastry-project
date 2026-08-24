<?php
require_once __DIR__ . '/cors.php';
session_start();

require_once '../includes/data.php';

/* ================= AUTH ================= */

if (!isset($_SESSION['user'])) {
    header("Location: ../login.php");
    exit;
}

$role = $_SESSION['user']['role'] ?? 'customer';

if ($role !== 'customer') {
    header('Location: products.php');
    exit;
}

/* ================= LOAD CART ================= */

$cartItems =
    $_SESSION['cart'] ?? [];

/* ================= SELECTED ITEMS ================= */

$selectedKeys =
    $_POST['selected_items']
    ?? $_GET['selected_items']
    ?? [];

if (!is_array($selectedKeys)) {
    $selectedKeys = [];
}

/* ================= FILTER ITEMS ================= */

$filteredItems = [];

foreach ($cartItems as $item) {

    if (!isset($item['key'])) {
        continue;
    }

    if (!in_array($item['key'], $selectedKeys)) {
        continue;
    }

    $quantity =
        (int)($item['quantity'] ?? 1);

    $price =
        (float)($item['price'] ?? 0);

    $item['quantity'] =
        $quantity;

    $item['price'] =
        $price;

    $item['subtotal'] =
        $price * $quantity;

    if (!isset($item['size_label'])) {
        $item['size_label'] = 'Regular';
    }

    /* FIX PRODUCT STRUCTURE */
    if (!isset($item['product'])) {

        $item['product'] = [

            'name' =>
                $item['name'] ?? 'Unknown Product',

            'image' =>
                $item['image'] ?? ''
        ];
    }

    $filteredItems[] = $item;
}

/* ================= EMPTY CHECK ================= */

if (empty($filteredItems)) {

    header("Location: cart.php");
    exit;
}

/* ================= TOTALS ================= */

$cartTotal = 0;

foreach ($filteredItems as $item) {

    $cartTotal +=
        $item['subtotal'];
}

$deliveryFee = 50;

$grandTotal =
    $cartTotal + $deliveryFee;

/* ================= USER ================= */

$userName =
    $_SESSION['user']['name'] ?? '';

$userEmail =
    $_SESSION['user']['email'] ?? '';
?>

<!DOCTYPE html>
<html lang="en">
<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>Checkout</title>

<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap"
rel="stylesheet">

<style>

*{
    box-sizing:border-box;
}

body{
    margin:0;
    font-family:'DM Sans',sans-serif;
    background:#f6f6f6;
    color:#111;
}

/* NAV */
.top-nav{
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:18px 30px;
    background:#fff;
    border-bottom:1px solid #eee;
}

.left-nav{
    display:flex;
    align-items:center;
    gap:30px;
}

.brand{
    display:flex;
    align-items:center;
    gap:10px;
}

.logo{
    width:40px;
    height:40px;
    border-radius:10px;
    object-fit:cover;
}

.brand-name{
    font-family:'Playfair Display',serif;
    font-size:22px;
    font-weight:700;
}

.brand-name span{
    color:#e7c46a;
}

.nav-links{
    display:flex;
    gap:20px;
}

.nav-links a{
    text-decoration:none;
    font-size:11px;
    font-weight:700;
    letter-spacing:1px;
    color:#888;
}

.nav-links a.active{
    color:#000;
    border-bottom:2px solid #e7c46a;
}

.nav-right{
    display:flex;
    align-items:center;
    gap:12px;
}

.icon-btn{
    position:relative;
    width:42px;
    height:42px;
    border-radius:12px;
    display:flex;
    align-items:center;
    justify-content:center;
    text-decoration:none;
    font-size:18px;
    border:1px solid #ddd;
    background:#fff;
    color:#111;
}

.cart-btn{
    background:#111;
    color:#fff;
    border:none;
}

.icon-badge{
    position:absolute;
    top:-5px;
    right:-5px;
    background:red;
    color:#fff;
    font-size:10px;
    padding:3px 6px;
    border-radius:50%;
}

.account-btn{
    display:flex;
    align-items:center;
    gap:6px;
    background:#fff;
    color:#111;
    padding:10px 12px;
    border-radius:10px;
    text-decoration:none;
    border:1px solid #ddd;
    font-size:13px;
    font-weight:500;
}

/* MAIN */
.checkout-container{
    max-width:1150px;
    margin:30px auto;
    padding:0 20px;
}

.page-title{
    font-family:'Playfair Display',serif;
    font-size:32px;
    margin-bottom:25px;
}

.checkout-grid{
    display:grid;
    grid-template-columns:2fr 1fr;
    gap:28px;
}

.card{
    background:#fff;
    border-radius:18px;
    padding:30px;
    box-shadow:0 6px 20px rgba(0,0,0,0.05);
}

.card-title{
    font-size:20px;
    font-weight:700;
    margin-bottom:22px;
}

.shipping-form{
    display:grid;
    gap:22px;
}

.form-row{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:18px;
}

.shipping-form label{
    display:block;
    margin-bottom:8px;
    font-size:13px;
    font-weight:600;
}

.shipping-form input,
.shipping-form textarea,
.shipping-form select{
    width:100%;
    padding:14px 16px;
    border-radius:12px;
    border:1px solid #ddd;
    background:#fafafa;
    font-size:14px;
    outline:none;
}

.shipping-form textarea{
    min-height:120px;
    resize:vertical;
}

/* SUMMARY */
.summary-list{
    display:flex;
    flex-direction:column;
    gap:16px;
    margin-bottom:20px;
}

.summary-item{
    display:flex;
    align-items:center;
    gap:14px;
}

.summary-img{
    width:60px;
    height:60px;
    object-fit:cover;
    border-radius:12px;
    border:1px solid #eee;
}

.checkout-btn{
    margin-top:20px;
    width:100%;
    padding:15px;
    background:#111;
    color:#fff;
    border:none;
    border-radius:12px;
    font-size:15px;
    font-weight:700;
    cursor:pointer;
}

.checkout-btn:hover{
    background:#333;
}

@media(max-width:900px){

    .checkout-grid{
        grid-template-columns:1fr;
    }

    .form-row{
        grid-template-columns:1fr;
    }

}

</style>
</head>

<body>

<!-- NAV -->
<div class="top-nav">

    <div class="left-nav">

        <div class="brand">

            <img src="../logo.jpg"
            class="logo">

            <div class="brand-name">
                Pastry <span>Project</span>
            </div>

        </div>

        <div class="nav-links">
            <a href="dashboard.php">DASHBOARD</a>
            <a href="products.php">PRODUCTS</a>
            <a href="orders.php">ORDERS</a>
            <a href="checkout.php" class="active">CHECKOUT</a>
        </div>

    </div>

    <div class="nav-right">

        <a href="cart.php"
        class="icon-btn cart-btn">

            🛒

            <span class="icon-badge">
                <?= $_SESSION['cart_count'] ?? 0 ?>
            </span>

        </a>

        <a href="account.php"
        class="account-btn">

            👤 <?= $_SESSION['user']['name'] ?? 'Account' ?>

        </a>

    </div>

</div>

<!-- MAIN -->
<div class="checkout-container">

<h1 class="page-title">
Checkout
</h1>

<form method="POST"
action="place_order.php">

<div class="checkout-grid">

<!-- LEFT -->
<div class="card">

<h3 class="card-title">
Shipping Details
</h3>

<div class="shipping-form">

<div class="form-row">

<div>

<label>Full Name</label>

<input
type="text"
value="<?= htmlspecialchars($userName) ?>"
readonly>

</div>

<div>

<label>Email Address</label>

<input
type="email"
value="<?= htmlspecialchars($userEmail) ?>"
readonly>

</div>

</div>

<div>

<label>Delivery Address</label>

<textarea
name="address"
placeholder="Enter your full delivery address..."
required></textarea>

</div>

<div>

<label>Payment Method</label>

<select name="payment" required>

<option value="COD">
Cash on Delivery
</option>

<option value="GCash">
GCash
</option>

<option value="PayMaya">
PayMaya
</option>

</select>

</div>

</div>

</div>

<!-- RIGHT -->
<div class="card"
style="height:fit-content;">

<h3 style="margin-top:0;">
Order Summary
</h3>

<div class="summary-list">

<?php foreach ($filteredItems as $item): ?>

<?php

$img =
    trim($item['product']['image'] ?? '');

$path = '';

if ($img !== '') {

    if (str_starts_with($img, '../')) {

        $path = $img;

    } elseif (str_starts_with($img, '/uploads/')) {

        $path = '..' . $img;

    } elseif (str_contains($img, 'uploads/')) {

        $path = '../' . ltrim($img, '/\\');

    } else {

        $path = '../uploads/' . ltrim($img, '/\\');
    }
}

?>

<div class="summary-item">

<?php if (!empty($path) && file_exists($path)): ?>

<img
src="<?= $path ?>"
class="summary-img">

<?php else: ?>

<div class="summary-img"
style="
display:flex;
align-items:center;
justify-content:center;
font-size:22px;
background:#f5f5f5;
">
🍰
</div>

<?php endif; ?>

<div style="flex:1;">

<div style="font-weight:600;">

<?= htmlspecialchars(
$item['product']['name']
) ?>

</div>

<div style="
font-size:12px;
color:#777;
margin-top:3px;
">

<?= htmlspecialchars(
$item['size_label']
) ?>

• Qty:
<?= (int)$item['quantity'] ?>

</div>

</div>

<div style="
font-weight:700;
font-size:14px;
">

₱<?= number_format(
$item['subtotal'],
2
) ?>

</div>

</div>

<?php endforeach; ?>

</div>

<hr style="
border:none;
border-top:1px solid #eee;
margin:20px 0;
">

<div style="
display:flex;
justify-content:space-between;
margin-bottom:10px;
">

<span>Subtotal</span>

<span>
₱<?= number_format($cartTotal,2) ?>
</span>

</div>

<div style="
display:flex;
justify-content:space-between;
margin-bottom:10px;
color:#777;
">

<span>Delivery</span>

<span>
₱<?= number_format($deliveryFee,2) ?>
</span>

</div>

<hr style="
border:none;
border-top:1px solid #eee;
margin:20px 0;
">

<div style="
display:flex;
justify-content:space-between;
font-size:20px;
font-weight:700;
">

<span>Total</span>

<span>
₱<?= number_format($grandTotal,2) ?>
</span>

</div>

<?php foreach ($selectedKeys as $key): ?>

<input
type="hidden"
name="selected_items[]"
value="<?= htmlspecialchars($key) ?>">

<?php endforeach; ?>

<button
type="submit"
name="place_order"
class="checkout-btn">

Place Order

</button>

</div>

</div>

</form>

</div>

</body>
</html>
