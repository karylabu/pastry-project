<?php
session_start();
require_once __DIR__ . '/../includes/data.php';

if (!isset($_SESSION['user'])) {
    header("Location: ../login.php");
    exit;
}

$db = &getDB();
$userId = $_SESSION['user']['id'] ?? 0;

/* ================= ACTIONS ================= */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    if (isset($_POST['mark_read'])) {
        db_mark_notification_read((int)$_POST['notification_id']);
        header('Location: notifications.php');
        exit;
    }

    if (isset($_POST['delete'])) {
        db_delete_notification((int)$_POST['notification_id']);
        header('Location: notifications.php');
        exit;
    }

    if (isset($_POST['mark_all_read'])) {
        db_mark_all_notifications_read($userId);
        header('Location: notifications.php');
        exit;
    }
}

/* ================= DATA ================= */
$notifications = db_get_notifications($userId, 50);
$unreadCount   = count(db_get_unread_notifications($userId));
?>

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Notifications</title>

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

/* ICON BUTTONS */
.icon-btn{
    position:relative;
    background:#fff;
    color:#111;
    padding:10px 12px;
    border-radius:10px;
    text-decoration:none;
    border:1px solid #ddd;
    font-size:18px;
    transition:0.2s;
}

.icon-btn:hover{
    background:#f7f7f7;
}

.cart-dark{
    background:#111;
    color:#fff;
    border:none;
}

.cart-dark:hover{
    background:#222;
}

.icon-badge{
    position:absolute;
    top:-6px;
    right:-6px;
    background:red;
    color:#fff;
    font-size:10px;
    padding:3px 6px;
    border-radius:50%;
    min-width:18px;
    text-align:center;
}

/* ACCOUNT */
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

/* PAGE */
.main{
    padding:30px;
    max-width:1100px;
    margin:auto;
}

.topbar{
    display:flex;
    justify-content:space-between;
    align-items:center;
    margin-bottom:25px;
}

.page-title h1{
    margin:0;
    font-family:'Playfair Display',serif;
    font-size:34px;
}

.page-title p{
    margin-top:6px;
    color:#777;
    font-size:14px;
}

.btn{
    border:none;
    padding:10px 14px;
    border-radius:10px;
    cursor:pointer;
    font-size:13px;
    transition:0.2s;
}

.btn-primary{
    background:#111;
    color:#fff;
}

.btn-primary:hover{
    background:#222;
}

.btn-ghost{
    background:#eee;
    color:#111;
}

.btn-ghost:hover{
    background:#ddd;
}

/* NOTIFICATION CARD */
.notification-list{
    display:flex;
    flex-direction:column;
    gap:14px;
}

.card{
    background:#fff;
    border-radius:16px;
    padding:18px;
    box-shadow:0 5px 15px rgba(0,0,0,0.04);
    transition:0.2s;
}

.card:hover{
    transform:translateY(-2px);
}

.notification-header{
    display:flex;
    justify-content:space-between;
    gap:20px;
}

.notification-title{
    font-size:16px;
    font-weight:700;
}

.notification-message{
    margin-top:8px;
    color:#555;
    line-height:1.5;
    font-size:14px;
}

.notification-date{
    margin-top:10px;
    font-size:12px;
    color:#999;
}

.notification-actions{
    display:flex;
    gap:8px;
    align-items:flex-start;
}

/* EMPTY */
.empty{
    background:#fff;
    border-radius:18px;
    padding:60px 20px;
    text-align:center;
}

.empty-icon{
    font-size:60px;
    margin-bottom:15px;
}

.empty h3{
    margin:0;
    font-size:24px;
}

.empty p{
    color:#777;
    margin-top:8px;
}

/* POPUP */
.popup{
    position:fixed;
    top:20px;
    right:20px;
    background:#111;
    color:#fff;
    padding:14px 18px;
    border-radius:12px;
    font-size:14px;
    box-shadow:0 10px 25px rgba(0,0,0,0.2);
    z-index:9999;
    animation:slideIn 0.4s ease;
}

@keyframes slideIn{
    from{
        opacity:0;
        transform:translateY(-20px);
    }
    to{
        opacity:1;
        transform:translateY(0);
    }
}

</style>
</head>

<body>

<?php if ($unreadCount > 0): ?>
<div class="popup">
    🔔 You have <?= $unreadCount ?> new notification<?= $unreadCount > 1 ? 's' : '' ?>
</div>

<script>
setTimeout(()=>{
    const popup = document.querySelector('.popup');
    if(popup){
        popup.style.display = 'none';
    }
}, 4000);
</script>
<?php endif; ?>

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
            <a href="orders.php">ORDERS</a>
            <a href="notifications.php" class="active">NOTIFICATIONS</a>
        </div>

    </div>

    <div class="nav-right">

        <!-- NOTIFICATIONS -->
        <a href="notifications.php" class="icon-btn">
            🔔

            <?php if ($unreadCount > 0): ?>
            <span class="icon-badge">
                <?= $unreadCount ?>
            </span>
            <?php endif; ?>
        </a>

        <!-- CART -->
        <a href="cart.php" class="icon-btn cart-dark">
            🛒

            <?php if (!empty($_SESSION['cart_count'])): ?>
            <span class="icon-badge">
                <?= $_SESSION['cart_count'] ?>
            </span>
            <?php endif; ?>
        </a>

        <!-- ACCOUNT -->
        <a href="account.php" class="account-btn">
            👤 <?= $_SESSION['user']['name'] ?? 'Account' ?>
        </a>

    </div>

</div>

<div class="main">

    <!-- TOPBAR -->
    <div class="topbar">

        <div class="page-title">
            <h1>Notifications</h1>
            <p>
                <?= $unreadCount ?> unread notification<?= $unreadCount > 1 ? 's' : '' ?>
            </p>
        </div>

        <?php if ($unreadCount > 0): ?>
        <form method="POST">
            <button name="mark_all_read" class="btn btn-ghost">
                Mark all as read
            </button>
        </form>
        <?php endif; ?>

    </div>

    <?php if (empty($notifications)): ?>

    <div class="empty">

        <div class="empty-icon">🔔</div>

        <h3>No notifications yet</h3>

        <p>
            Your order updates will appear here.
        </p>

    </div>

    <?php else: ?>

    <div class="notification-list">

        <?php foreach ($notifications as $n): ?>

        <?php
        $color =
            $n['type']=='Alert' ? '#e53935' :
            ($n['type']=='Warning' ? '#fb8c00' :
            ($n['type']=='Success' ? '#43a047' : '#1e88e5'));

        $icon =
            $n['type']=='Alert' ? '⚠️' :
            ($n['type']=='Warning' ? '⚠️' :
            ($n['type']=='Success' ? '✅' : 'ℹ️'));
        ?>

        <div class="card"
             style="
                border-left:6px solid <?= $color ?>;
                opacity:<?= $n['is_read'] ? '0.7' : '1' ?>;
             ">

            <div class="notification-header">

                <div style="flex:1">

                    <div class="notification-title">
                        <?= $icon ?>
                        <?= htmlspecialchars($n['title']) ?>
                    </div>

                    <div class="notification-message">
                        <?= nl2br(htmlspecialchars($n['message'])) ?>
                    </div>

                    <div class="notification-date">
                        <?= date('M d, Y h:i A', strtotime($n['created_at'])) ?>
                    </div>

                </div>

                <div class="notification-actions">

                    <?php if (!empty($n['action_url'])): ?>

                    <a href="<?= $n['action_url'] ?>" class="btn btn-primary">
                        View
                    </a>

                    <?php endif; ?>

                    <?php if (!$n['is_read']): ?>

                    <form method="POST">
                        <input type="hidden"
                               name="notification_id"
                               value="<?= $n['id'] ?>">

                        <button name="mark_read"
                                class="btn btn-ghost">
                            ✓
                        </button>
                    </form>

                    <?php endif; ?>

                    <form method="POST">
                        <input type="hidden"
                               name="notification_id"
                               value="<?= $n['id'] ?>">

                        <button name="delete"
                                class="btn btn-ghost">
                            ✕
                        </button>
                    </form>

                </div>

            </div>

        </div>

        <?php endforeach; ?>

    </div>

    <?php endif; ?>

</div>

</body>
</html>