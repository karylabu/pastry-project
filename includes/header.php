<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user'])) {
    header('Location: ../staff_login.php');
    exit;
}

$current = basename($_SERVER['PHP_SELF']);
?>

<style>

.top-nav{
    width:100%;
    background:#fff;
    color:#111;
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:14px 30px;
    box-sizing:border-box;
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
    object-fit:cover;
    border-radius:50%;
}

.brand-name{
    font-size:22px;
    font-weight:700;
    color:#fff;
    font-family:'Playfair Display', serif;
}

.brand-name span{
    color:#d4a373;
}

.nav-links{
    display:flex;
    align-items:center;
    gap:8px;
}

.nav-links a{
    text-decoration:none;
    color:#ddd;
    padding:10px 16px;
    border-radius:10px;
    font-size:13px;
    font-weight:700;
    transition:0.2s;
    letter-spacing:0.5px;
}

.nav-links a:hover{
    background:#222;
    color:#fff;
}

.nav-links a.active{
    background:#d4a373;
    color:#111;
}

.nav-right{
    display:flex;
    align-items:center;
    gap:12px;
}

.search-box input{
    padding:10px 14px;
    border:none;
    border-radius:30px;
    width:220px;
    outline:none;
    font-size:13px;
}

.account-btn{
    text-decoration:none;
    color:#fff;
    background:#222;
    padding:10px 14px;
    border-radius:10px;
    font-size:13px;
    font-weight:600;
    transition:0.2s;
}

.account-btn:hover{
    background:#333;
}

.logout-btn{
    background:#8b0000;
}

.logout-btn:hover{
    background:#a30000;
}

@media(max-width:1100px){

    .top-nav{
        flex-direction:column;
        align-items:flex-start;
        gap:15px;
    }

    .left-nav{
        flex-direction:column;
        align-items:flex-start;
        gap:15px;
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

<!-- HEADER -->
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
            <input type="text"
                   id="searchInput"
                   placeholder="Search...">
        </div>

        <a href="#" class="account-btn">
            👤 <?= htmlspecialchars($_SESSION['user']['name'] ?? 'Staff') ?>
        </a>

        <a href="logout.php" class="account-btn logout-btn">
            🚪 Logout
        </a>

    </div>

</div>