<?php
session_start();

/*
|--------------------------------------------------------------------------
| AUTH CHECK
|--------------------------------------------------------------------------
*/
if (!isset($_SESSION['user'])) {
    header('Location: ../staff_login.php');
    exit;
}

require_once __DIR__ . '/../includes/db.php';

/*
|--------------------------------------------------------------------------
| FETCH PRODUCTS
|--------------------------------------------------------------------------
*/
$products = db_all("SELECT * FROM products WHERE available = 1");
$categories = array_unique(array_column($products, 'category'));

/*
|--------------------------------------------------------------------------
| DASHBOARD COUNTS
|--------------------------------------------------------------------------
*/
$totalOrders = db_one("
    SELECT COUNT(*) as total 
    FROM orders
")['total'] ?? 0;

$lowStocks = db_one("
    SELECT COUNT(*) as total 
    FROM products 
    WHERE stock <= 5
")['total'] ?? 0;

$pendingOrders = db_one("
    SELECT COUNT(*) as total 
    FROM orders 
    WHERE status = 'Pending'
")['total'] ?? 0;

$dailySales = db_one("
    SELECT SUM(total) as total 
    FROM orders 
    WHERE DATE(created_at) = CURDATE()
")['total'] ?? 0;
?>

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Staff Dashboard</title>

<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">

<style>

body{
    margin:0;
    font-family:'DM Sans',sans-serif;
    background:#f5f5f5;
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

/* SEARCH */
.search-box input{
    padding:8px 12px;
    border-radius:20px;
    border:1px solid #ddd;
    width:180px;
    outline:none;
}

/* BUTTONS */
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

.logout-btn{
    background:#111;
    color:#fff;
}

/* SUMMARY CARDS */
.staff-cards{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
    gap:20px;
    padding:20px;
}

.staff-card{
    background:#fff;
    border-radius:14px;
    padding:20px;
    border:1px solid #ddd;
}

.staff-card h3{
    margin:0;
    font-size:14px;
    color:#777;
}

.staff-card p{
    margin-top:10px;
    font-size:28px;
    font-weight:700;
}

/* QUICK ACTIONS */
.quick-actions{
    display:flex;
    gap:15px;
    padding:0 20px 20px;
    flex-wrap:wrap;
}

.quick-btn{
    background:#111;
    color:#fff;
    text-decoration:none;
    padding:12px 18px;
    border-radius:10px;
    font-size:14px;
}

/* CATEGORY */
.category-tabs{
    display:flex;
    gap:10px;
    overflow-x:auto;
    padding:20px;
}

.category-tab{
    padding:8px 16px;
    background:#eee;
    border-radius:20px;
    cursor:pointer;
    white-space:nowrap;
}

.category-tab.active{
    background:#111;
    color:#fff;
}

/* PRODUCTS */
.products{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
    gap:16px;
    padding:20px;
}

.product-card{
    background:#fff;
    padding:15px;
    border-radius:12px;
    text-align:center;
    border:1px solid #ddd;
}

.product-img{
    width:100px;
    height:100px;
    object-fit:contain;
}

.price{
    margin-top:10px;
    font-weight:600;
}

.stock-display{
    margin-top:10px;
    font-weight:700;
}

.low-stock-alert{
    margin-top:10px;
    background:#ffe3e3;
    color:#c00;
    padding:6px;
    border-radius:6px;
    font-size:12px;
    font-weight:700;
}

</style>
</head>

<body>

<?php include __DIR__ . '/../includes/header.php'; ?>

<!-- SUMMARY CARDS -->
<div class="staff-cards">

    <div class="staff-card">
        <h3>Total Orders</h3>
        <p><?= $totalOrders ?></p>
    </div>

    <div class="staff-card">
        <h3>Low Stock Products</h3>
        <p><?= $lowStocks ?></p>
    </div>

    <div class="staff-card">
        <h3>Pending Orders</h3>
        <p><?= $pendingOrders ?></p>
    </div>

    <div class="staff-card">
        <h3>Today's Sales</h3>
        <p>₱<?= number_format($dailySales, 2) ?></p>
    </div>

</div>

<!-- QUICK ACTIONS -->
<div class="quick-actions">

    <a href="new_order.php" class="quick-btn">
        Create Order
    </a>

    <a href="inventory.php" class="quick-btn">
        Manage Inventory
    </a>

    <a href="analytics.php" class="quick-btn">
        View Analytics
    </a>

</div>

<!-- CATEGORY TABS -->
<div class="category-tabs">

<?php foreach ($categories as $i => $cat): ?>

    <div class="category-tab <?= $i === 0 ? 'active' : '' ?>"
         data-cat="<?= $cat ?>">

         <?= htmlspecialchars($cat) ?>

    </div>

<?php endforeach; ?>

</div>

<!-- PRODUCTS -->
<?php foreach ($categories as $i => $cat): ?>

<div class="products category-group"
     data-cat="<?= $cat ?>"
     style="<?= $i !== 0 ? 'display:none' : '' ?>">

<?php foreach ($products as $p):

    if ($p['category'] !== $cat) continue;

    $image = $p['image'] ?? '';
    $imagePath = "../uploads/" . $image;
?>

<div class="product-card"
     data-name="<?= strtolower($p['name']) ?>">

<?php if (!empty($image) && file_exists(__DIR__ . "/../uploads/" . $image)): ?>

    <img src="<?= $imagePath ?>" class="product-img">

<?php else: ?>

    <div style="font-size:40px">🍰</div>

<?php endif; ?>

<h3><?= htmlspecialchars($p['name']) ?></h3>

<div class="price">
    ₱<?= number_format($p['slice_price'], 2) ?>
</div>

<div class="stock-display">
    Stock: <?= $p['stock'] ?? 0 ?>
</div>

<?php if (($p['stock'] ?? 0) <= 5): ?>

    <div class="low-stock-alert">
        ⚠ Low Stock
    </div>

<?php endif; ?>

</div>

<?php endforeach; ?>

</div>

<?php endforeach; ?>

<script>

/* SEARCH */
document.getElementById('searchInput').addEventListener('input', function(){

    const value = this.value.toLowerCase();

    document.querySelectorAll('.product-card').forEach(card => {

        card.style.display =
            card.dataset.name.includes(value)
            ? 'block'
            : 'none';

    });

});

/* CATEGORY SWITCH */
document.querySelectorAll('.category-tab').forEach(tab => {

    tab.onclick = () => {

        document.querySelectorAll('.category-tab')
        .forEach(t => t.classList.remove('active'));

        tab.classList.add('active');

        const cat = tab.dataset.cat;

        document.querySelectorAll('.category-group')
        .forEach(group => {

            group.style.display =
                (group.dataset.cat === cat)
                ? 'grid'
                : 'none';

        });

    };

});

</script>

</body>
</html>