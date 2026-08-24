<?php
session_start();

require_once __DIR__ . '/../includes/data.php';

$db = &getDB();

if (!isset($_SESSION['user'])) {
    header("Location: ../login.php");
    exit;
}

$role = $_SESSION['user']['role'] ?? 'customer';

$categories = array_unique(array_column($db['products'], 'category'));

$filterCat = $_GET['cat'] ?? 'all';

$products = $db['products'];

if ($filterCat !== 'all') {

    $products = array_filter(
        $products,
        fn($p) => $p['category'] === $filterCat
    );
}

$current = basename($_SERVER['PHP_SELF']);
?>

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Products</title>

<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">

<style>

:root{
    --rose:#d4a373;
    --rose-dark:#b08968;
    --bg:#f7f3ef;
    --card:#ffffff;
    --text:#2b2b2b;
    --muted:#777;
}

*{
    margin:0;
    padding:0;
    box-sizing:border-box;
}

body{
    background:var(--bg);
    font-family:'DM Sans',sans-serif;
    color:var(--text);
}

/* NAV */

.top-nav{
    width:100%;
    background:#fff;
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:14px 30px;
    border-bottom:1px solid #ececec;
    position:sticky;
    top:0;
    z-index:999;
}

.left-nav{
    display:flex;
    align-items:center;
    gap:35px;
}

.brand{
    display:flex;
    align-items:center;
    gap:12px;
}

.logo{
    width:45px;
    height:45px;
    border-radius:50%;
    object-fit:cover;
}

.brand-name{
    font-size:24px;
    font-weight:700;
    font-family:'Playfair Display',serif;
}

.brand-name span{
    color:var(--rose);
}

.nav-links{
    display:flex;
    align-items:center;
    gap:10px;
}

.nav-links a{
    text-decoration:none;
    color:#666;
    padding:10px 16px;
    border-radius:10px;
    font-size:13px;
    font-weight:700;
    transition:0.2s;
}

.nav-links a:hover{
    background:#f4f4f4;
    color:#111;
}

.nav-links a.active{
    background:var(--rose);
    color:#111;
}

.nav-right{
    display:flex;
    align-items:center;
    gap:12px;
}

.search-box input{
    padding:10px 14px;
    border:1px solid #ddd;
    border-radius:30px;
    width:220px;
    outline:none;
    font-size:13px;
}

.account-btn{
    text-decoration:none;
    color:#111;
    background:#fff;
    border:1px solid #ddd;
    padding:10px 14px;
    border-radius:10px;
    font-size:13px;
    font-weight:600;
}

.logout-btn{
    background:#8b0000;
    color:#fff;
    border:none;
}

/* MAIN */

.main{
    padding:30px;
}

.topbar{
    margin-bottom:25px;
}

.topbar h1{
    font-size:34px;
    font-family:'Playfair Display',serif;
}

.topbar p{
    color:var(--muted);
    margin-top:5px;
}

/* BUTTONS */

.btn{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    border:none;
    border-radius:12px;
    padding:10px 16px;
    font-size:13px;
    font-weight:600;
    cursor:pointer;
    text-decoration:none;
    transition:0.2s;
}

.btn-sm{
    padding:8px 14px;
    font-size:12px;
}

.btn-primary{
    background:var(--rose);
    color:#fff;
}

.btn-primary:hover{
    background:var(--rose-dark);
}

.btn-ghost{
    background:#fff;
    border:1px solid #ddd;
    color:#333;
}

/* PRODUCT CARD */

.card{
    background:#fff;
    border-radius:22px;
    border:1px solid #eee;
    box-shadow:0 2px 10px rgba(0,0,0,0.03);
}

.product-card{
    padding:20px;
}

.product-image{
    width:100%;
    height:190px;
    object-fit:cover;
    border-radius:18px;
    border:1px solid #eee;
    display:block;
}

.size-btn{
    border:1px solid #ddd;
    background:#fff;
    padding:5px 10px;
    border-radius:8px;
    font-size:11px;
    cursor:pointer;
}

.size-btn.active{
    background:var(--rose);
    color:#fff;
    border-color:var(--rose);
}

@media(max-width:900px){

    .top-nav{
        flex-direction:column;
        align-items:flex-start;
        gap:15px;
    }

    .left-nav{
        flex-direction:column;
        align-items:flex-start;
    }

    .nav-links{
        flex-wrap:wrap;
    }

    .nav-right{
        width:100%;
        flex-wrap:wrap;
    }

    .search-box input{
        width:100%;
    }

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

            <a href="dashboard.php"
               class="<?= $current == 'dashboard.php' ? 'active' : '' ?>">
               DASHBOARD
            </a>

            <a href="orders.php"
               class="<?= $current == 'orders.php' ? 'active' : '' ?>">
               ORDERS
            </a>

            <a href="products.php"
               class="<?= $current == 'products.php' ? 'active' : '' ?>">
               PRODUCTS
            </a>

            <a href="inventory.php"
               class="<?= $current == 'inventory.php' ? 'active' : '' ?>">
               INVENTORY
            </a>

        </div>

    </div>

    <div class="nav-right">

        <div class="search-box">
            <input type="text" placeholder="Search...">
        </div>

        <a href="#" class="account-btn">
            👤 <?= htmlspecialchars($_SESSION['user']['name'] ?? 'Staff') ?>
        </a>

        <a href="logout.php" class="account-btn logout-btn">
            🚪 Logout
        </a>

    </div>

</div>

<!-- MAIN -->
<div class="main">

    <div class="topbar">
        <h1>Products</h1>
        <p>Browse our pastries</p>
    </div>

    <!-- CATEGORY -->
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">

        <a href="?cat=all"
           class="btn <?= $filterCat==='all'?'btn-primary':'btn-ghost' ?> btn-sm">
           All
        </a>

        <?php foreach ($categories as $cat): ?>

            <a href="?cat=<?= urlencode($cat) ?>"
               class="btn <?= $filterCat===$cat?'btn-primary':'btn-ghost' ?> btn-sm">

                <?= htmlspecialchars($cat) ?>

            </a>

        <?php endforeach; ?>

    </div>

    <!-- PRODUCTS -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px">

    <?php foreach ($products as $p): ?>

    <?php
    $slice = (float)($p['slice_price'] ?? 0);
    $small = (float)($p['small_price'] ?? 0);
    $big   = (float)($p['big_price'] ?? 0);
    ?>

    <div class="card product-card"
         data-slice="<?= $slice ?>"
         data-small="<?= $small ?>"
         data-big="<?= $big ?>">

        <!-- IMAGE -->
        <div style="margin-bottom:12px">

            <img
                src="<?= htmlspecialchars($p['image']) ?>"
                alt="<?= htmlspecialchars($p['name']) ?>"
                class="product-image"
            >

        </div>

        <div style="text-align:center">

            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">
                <?= htmlspecialchars($p['category']) ?>
            </div>

            <h3 style="font-family:'Playfair Display',serif;font-size:15px;margin-bottom:6px">
                <?= htmlspecialchars($p['name']) ?>
            </h3>

            <p style="font-size:12px;color:var(--muted);margin-bottom:12px">
                <?= htmlspecialchars($p['description']) ?>
            </p>

            <!-- SIZE -->
            <div style="display:flex;gap:6px;justify-content:center;margin-bottom:8px">

                <button class="size-btn active" data-type="slice">
                    Slice
                </button>

                <button class="size-btn" data-type="small">
                    Small
                </button>

                <button class="size-btn" data-type="big">
                    Big
                </button>

            </div>

            <!-- PRICE -->
            <div class="price-display"
                 style="font-size:20px;font-weight:700;color:var(--rose-dark);margin-bottom:10px">

                ₱<?= number_format($slice) ?>

            </div>

            <!-- STOCK -->
            <div style="font-size:12px;color:var(--muted);margin-bottom:12px">
                Stock:
                <strong><?= $p['stock'] ?></strong>
            </div>

            <!-- AVAILABILITY -->
            <div style="display:flex;gap:8px">

                <button
                    type="button"
                    class="btn <?= ($p['available'] ?? 1) ? 'btn-primary' : 'btn-ghost' ?> availability-btn"
                    style="flex:1"
                    onclick="setAvailability(this, 'available')">

                    Available

                </button>

                <button
                    type="button"
                    class="btn <?= !($p['available'] ?? 1) ? 'btn-primary' : 'btn-ghost' ?> availability-btn"
                    style="flex:1"
                    onclick="setAvailability(this, 'not')">

                    Not Available

                </button>

            </div>

        </div>

    </div>

    <?php endforeach; ?>

    </div>

</div>

<script>

/* PRICE SWITCH */

document.querySelectorAll('.product-card').forEach(card => {

    const buttons = card.querySelectorAll('.size-btn');

    const price = card.querySelector('.price-display');

    buttons.forEach(btn => {

        btn.onclick = () => {

            buttons.forEach(b => b.classList.remove('active'));

            btn.classList.add('active');

            price.innerText = "₱" + card.dataset[btn.dataset.type];

        };

    });

});

/* AVAILABILITY BUTTON */

function setAvailability(button, status){

    const parent = button.parentElement;

    const buttons = parent.querySelectorAll('.availability-btn');

    buttons.forEach(btn => {

        btn.classList.remove('btn-primary');

        btn.classList.add('btn-ghost');

    });

    if(status === 'available'){

        buttons[0].classList.remove('btn-ghost');
        buttons[0].classList.add('btn-primary');

    }else{

        buttons[1].classList.remove('btn-ghost');
        buttons[1].classList.add('btn-primary');

    }

}

</script>

</body>
</html>