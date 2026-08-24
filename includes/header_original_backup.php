<?php
if (!isset($_SESSION['user'])) { header('Location: index.php'); exit; }
$role = $_SESSION['user']['role'];
$name = $_SESSION['user']['name'];
$current = basename($_SERVER['PHP_SELF'], '.php');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pastry Project — <?= ucfirst($current) ?></title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Playfair Display',serif;background:#F4F4F4;color:#111}

/* ✅ TOP NAVBAR (from sidebar converted) */
.topnav{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:14px 24px;
  background:#000;
  color:white;
}

.topnav .left{
  display:flex;
  align-items:center;
  gap:18px;
}

.logo{
  display:flex;
  align-items:center;
  gap:8px;
  font-weight:600;
}

.logo-icon{
  font-size:18px;
}

.nav-links a{
  color:rgba(255,255,255,0.7);
  text-decoration:none;
  font-size:13.5px;
  padding:6px 10px;
  border-radius:8px;
  transition:.2s;
}

.nav-links a:hover{
  background:rgba(255,255,255,0.08);
  color:white;
}

.nav-links a.active{
  background:rgba(255,255,255,0.1);
  color:white;
}

/* RIGHT SIDE */
.topnav .right{
  display:flex;
  align-items:center;
  gap:12px;
}

.user-avatar{
  width:32px;height:32px;
  background:#111;
  border-radius:8px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:12px;
}

/* MAIN FULL WIDTH */
.main{
  padding:28px;
}

/* KEEP YOUR EXISTING STYLES */
.topbar{background:#fff;border-bottom:1px solid #DADADA;padding:16px 28px;display:flex;align-items:center;justify-content:space-between}
.page-title h1{font-size:22px;font-weight:600}
.page-title p{color:#666;font-size:13px}
.content{padding:20px}

/* cards / tables (minimal retain) */
.card{background:#fff;border-radius:16px;border:1px solid #DADADA;padding:24px}
table{width:100%;border-collapse:collapse}
th,td{padding:12px;border-bottom:1px solid #eee}
.status{padding:4px 10px;border-radius:20px;font-size:11px;background:#eee}

/* buttons */
.btn{padding:8px 14px;border-radius:8px;border:none;cursor:pointer}
.btn-primary{background:#111;color:white}
.btn-ghost{background:#eee}
</style>
</head>

<body>

<!-- ✅ NEW TOP NAV -->
<div class="topnav">

  <div class="left">
    <div class="logo">
      <span class="logo-icon">🥐</span>
      <span>Pastry Project</span>
    </div>

    <div class="nav-links">
      <a href="dashboard.php" class="<?= $current==='dashboard'?'active':'' ?>">Dashboard</a>
      <a href="orders.php" class="<?= $current==='orders'?'active':'' ?>">Orders</a>

      <?php if ($role !== 'customer'): ?>
      <a href="inventory.php" class="<?= $current==='inventory'?'active':'' ?>">Inventory</a>
      <?php endif; ?>

      <a href="products.php" class="<?= $current==='products'?'active':'' ?>">Products</a>

      <?php if ($role === 'admin'): ?>
      <a href="analytics.php" class="<?= $current==='analytics'?'active':'' ?>">Analytics</a>
      <a href="reports.php" class="= $current==='reports'?'active':'' ?>">Reports</a>
      <?php endif; ?>

      <a href="notifications.php" class="<?= $current==='notifications'?'active':'' ?>">Notifications</a>
    </div>
  </div>

  <div class="right">
    <div class="user-avatar"><?= strtoupper($name[0]) ?></div>
    <a href="logout.php" style="color:white;text-decoration:none">Logout</a>
  </div>

</div>

<main class="main">
</main>
</body>
</html>
