<?php
session_start();
require '../includes/data.php';

if (!isset($_SESSION['user'])) {
    header("Location: ../login.php");
    exit;
}

$user = $_SESSION['user'];
$userEmail = trim($user['email'] ?? '');
$userName = trim($user['name'] ?? '');

/* CUSTOMER ORDERS ONLY */
$orders = [];

if ($userEmail !== '' || $userName !== '') {
    // Query orders where email, customer name, or user_id matches (case-insensitive)
    $ordersRaw = db_all(
        'SELECT * FROM orders WHERE LOWER(email) = LOWER(?) OR LOWER(customer) = LOWER(?) OR user_id = ? ORDER BY id DESC',
        [$userEmail, $userName, (int)($user['id'] ?? 0)]
    );
    
    $itemsRaw = db_all('SELECT * FROM order_items');

    $itemsByOrder = [];
    foreach ($itemsRaw as $item) {
        $itemsByOrder[$item['order_id']][] = [
            'product' => $item['product'],
            'qty' => (int)$item['qty'],
            'price' => (float)$item['price']
        ];
    }

    foreach ($ordersRaw as $order) {
        $orders[] = [
            'id' => (int)$order['id'],
            'customer' => $order['customer'] ?? '',
            'email' => $order['email'] ?? '',
            'type' => $order['type'] ?? '',
            'status' => $order['status'] ?? '',
            'total' => (float)($order['total'] ?? 0),
            'items' => $itemsByOrder[$order['id']] ?? [],
            'date' => $order['order_date'] ?? $order['created_at'] ?? '',
            'payment' => $order['payment'] ?? '',
            'address' => $order['address'] ?? ''
        ];
    }
}

/* FILTER */
$filter = $_GET['filter'] ?? 'all';

if ($filter !== 'all') {
    $orders = array_filter($orders, function($o) use ($filter){
        return strtolower($o['status']) === strtolower($filter);
    });
}

$orders = array_reverse($orders);
?>

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>My Orders</title>

<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">

<style>
body{
    margin:0;
    font-family:'DM Sans',sans-serif;
    background:#f4f4f4;
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

/* RIGHT */
.nav-right{
    display:flex;
    align-items:center;
    gap:12px;
}

.search-box{
    padding:10px 16px;
    border-radius:20px;
    border:1px solid #ddd;
    outline:none;
    width:200px;
    font-size:13px;
}

.icon-btn{
    position:relative;
    background:#f3f3f3;
    padding:10px 12px;
    border-radius:12px;
    font-size:16px;
    display:flex;
    align-items:center;
    justify-content:center;
    cursor:pointer;
    text-decoration:none;
    color:#111;
}

.cart-dark{
    background:#111;
    color:#fff;
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

/* PAGE */
.container{
    padding:30px;
}

h2{
    font-family:'Playfair Display';
    margin-bottom:20px;
}

/* FILTER */
.order-tabs{
    display:flex;
    gap:10px;
    margin-bottom:20px;
    flex-wrap:wrap;
}

.order-tab{
    text-decoration:none;
    padding:8px 16px;
    border-radius:20px;
    font-size:13px;
    color:#666;
    background:#eee;
}

.order-tab.active{
    background:#111;
    color:#fff;
}

/* TABLE */
table{
    width:100%;
    border-collapse:collapse;
    background:#fff;
    border-radius:12px;
    overflow:hidden;
}

th,td{
    padding:14px;
    border-bottom:1px solid #eee;
    font-size:14px;
}

th{
    background:#fafafa;
    text-align:left;
}

tr:hover{
    background:#fafafa;
}

/* STATUS */
.status{
    padding:6px 12px;
    border-radius:20px;
    font-size:12px;
    font-weight:600;
}

.pending{
    background:#fff3cd;
    color:#856404;
}

.confirmed{
    background:#d4edda;
    color:#155724;
}

.preparing{
    background:#d1ecf1;
    color:#0c5460;
}

.completed{
    background:#d6d8ff;
    color:#3d3db3;
}

.empty{
    background:#fff;
    padding:40px;
    border-radius:12px;
    text-align:center;
    color:#777;
}
</style>
</head>

<body>

<!-- NAV -->
<div class="top-nav">

    <div class="left-nav">

        <div class="brand">
            <img src="../logo.jpg" class="logo">

            <div class="brand-name">
                Pastry <span>Project</span>
            </div>
        </div>

        <div class="nav-links">
            <a href="dashboard.php">DASHBOARD</a>
            <a href="products.php">PRODUCTS</a>
            <a href="orders.php" class="active">ORDERS</a>
        </div>

    </div>

    <div class="nav-right">

        <input type="text" placeholder="Search..." class="search-box">

        <!-- NOTIFICATIONS -->
        <a href="notifications.php" class="icon-btn">
            🔔
            <span class="icon-badge" id="notifBadge">0</span>
        </a>

        <!-- CART -->
        <a href="cart.php" class="icon-btn cart-dark">
            🛒
            <span class="icon-badge" id="cartCountBadge">
                <?= $_SESSION['cart_count'] ?? 0 ?>
            </span>
        </a>

        <!-- ACCOUNT -->
        <a href="account.php" class="account-btn">
            👤 <?= $_SESSION['user']['name'] ?? 'Account' ?>
        </a>

    </div>

</div>

<div class="container">

<h2>My Orders</h2>

<!-- FILTER -->
<div class="order-tabs">

<?php foreach(['all','pending','confirmed','preparing','completed'] as $f): ?>

<a href="?filter=<?= $f ?>"
class="order-tab <?= $filter==$f?'active':'' ?>">

<?= ucfirst($f) ?>

</a>

<?php endforeach; ?>

</div>

<?php if(empty($orders)): ?>

<div class="empty">
    No orders found.
</div>

<?php else: ?>

<table>

<thead>
<tr>
    <th>Order</th>
    <th>Items</th>
    <th>Total</th>
    <th>Status</th>
    <th>Date</th>
</tr>
</thead>

<tbody>

<?php foreach($orders as $o): ?>

<tr>

<td>
    <strong>#<?= $o['id'] ?></strong><br>
    <small><?= htmlspecialchars($o['address']) ?></small>
</td>

<td>
<?php foreach($o['items'] as $item): ?>

<div>
    <?= $item['qty'] ?>x <?= htmlspecialchars($item['product']) ?>
</div>

<?php endforeach; ?>
</td>

<td>
    ₱<?= number_format($o['total']) ?>
</td>

<td>

<?php
$statusClass = strtolower($o['status']);
?>

<span class="status <?= $statusClass ?>">
    <?= htmlspecialchars($o['status']) ?>
</span>

</td>

<td>
    <?= htmlspecialchars($o['date']) ?>
</td>

</tr>

<?php endforeach; ?>

</tbody>

</table>

<?php endif; ?>

</div>

<script>
// CART COUNT
function loadCartCount(){
  fetch('cart_api.php?action=count')
    .then(res=>res.json())
    .then(data=>{
      document.getElementById('cartCountBadge').innerText = data.count || 0;
    });
}
loadCartCount();

// NOTIF COUNT
function loadNotifCount(){
  fetch('notifications_api.php?action=count')
    .then(res=>res.json())
    .then(data=>{
      document.getElementById('notifBadge').innerText = data.count || 0;
    });
}
loadNotifCount();
</script>

</body>
</html>