<?php
session_start();
require_once __DIR__ . '/../includes/db.php';

/*
|--------------------------------------------------------------------------
| AUTH CHECK
|--------------------------------------------------------------------------
*/
if (!isset($_SESSION['user'])) {
    header('Location: staff_login.php');
    exit;
}

$role = $_SESSION['user']['role'] ?? 'staff';

/*
|--------------------------------------------------------------------------
| UPDATE STATUS (STAFF ONLY)
|--------------------------------------------------------------------------
*/
if ($_POST && isset($_POST['update_status']) && $role !== 'customer') {

    $oid = (int)$_POST['order_id'];
    $newStatus = $_POST['new_status'];

    db_run("UPDATE orders SET status = ? WHERE id = ?", [
        $newStatus,
        $oid
    ]);

    $_SESSION['success'] = "Order #$oid updated to $newStatus.";
    header('Location: orders.php');
    exit;
}

/*
|--------------------------------------------------------------------------
| FETCH ORDERS
|--------------------------------------------------------------------------
*/
$filter = $_GET['filter'] ?? 'all';

if ($filter === 'all') {
    $orders = db_all("SELECT * FROM orders ORDER BY created_at DESC");
} else {
    $orders = db_all(
        "SELECT * FROM orders WHERE LOWER(status) = ? ORDER BY created_at DESC",
        [strtolower($filter)]
    );
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Staff Orders</title>

<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">

<style>
body{
    margin:0;
    font-family:'DM Sans',sans-serif;
    background:#f5f5f5;
}

/* HEADER */
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

h1{margin:0;font-size:22px}

.content{
    padding:20px;
}

.btn{
    padding:8px 12px;
    border:none;
    border-radius:8px;
    cursor:pointer;
    text-decoration:none;
    font-size:13px;
}

.btn-primary{
    background:#111;
    color:#fff;
}

.btn-ghost{
    background:#eee;
    color:#111;
}

/* TABLE */
table{
    width:100%;
    border-collapse:collapse;
    background:#fff;
}

th,td{
    padding:12px;
    border-bottom:1px solid #eee;
    font-size:13px;
}

th{
    text-align:left;
    background:#fafafa;
}

.status{
    padding:4px 8px;
    border-radius:6px;
    font-size:12px;
}

.status-pending{background:#fff3cd}
.status-confirmed{background:#cfe2ff}
.status-preparing{background:#ffe5b4}
.status-completed{background:#d1e7dd}

.alert{
    background:#d1e7dd;
    padding:10px;
    border-radius:8px;
    margin-bottom:15px;
}
</style>
</head>

<body>

<?php include __DIR__ . '/../includes/header.php'; ?>

<div class="topbar">
    <div>
        <h1>Orders</h1>
        <small>Manage all customer orders</small>
    </div>
</div>

<div class="content">

<?php if (isset($_SESSION['success'])): ?>
    <div class="alert">
        ✅ <?= htmlspecialchars($_SESSION['success']) ?>
    </div>
<?php unset($_SESSION['success']); endif; ?>

<!-- FILTER -->
<div style="display:flex;gap:8px;margin-bottom:15px;flex-wrap:wrap">

<?php foreach (['all','pending','confirmed','preparing','ready','completed'] as $f): ?>
    <a class="btn <?= $filter===$f?'btn-primary':'btn-ghost' ?>"
       href="?filter=<?= $f ?>">
        <?= ucfirst($f) ?>
    </a>
<?php endforeach; ?>

</div>

<!-- TABLE -->
<table>
<thead>
<tr>
    <th>ID</th>
    <th>Customer</th>
    <th>Type</th>
    <th>Total</th>
    <th>Payment</th>
    <th>Status</th>
    <th>Date</th>
    <?php if ($role !== 'customer'): ?>
    <th>Action</th>
    <?php endif; ?>
</tr>
</thead>

<tbody>

<?php if (empty($orders)): ?>
<tr>
    <td colspan="8" style="text-align:center;padding:30px">
        No orders found
    </td>
</tr>
<?php endif; ?>

<?php foreach ($orders as $o): ?>

<tr>
    <td>#<?= $o['id'] ?></td>

    <td>
        <?= htmlspecialchars($o['customer']) ?><br>
        <small><?= htmlspecialchars($o['email']) ?></small>
    </td>

    <td><?= $o['type'] ?></td>

    <td>₱<?= number_format($o['total'],2) ?></td>

    <td><?= $o['payment'] ?></td>

    <td>
        <span class="status status-<?= strtolower($o['status']) ?>">
            <?= $o['status'] ?>
        </span>
    </td>

    <td><?= $o['created_at'] ?></td>

    <?php if ($role !== 'customer'): ?>
    <td>
        <form method="POST" style="display:flex;gap:5px">
            <input type="hidden" name="order_id" value="<?= $o['id'] ?>">

            <select name="new_status">
                <option>Pending</option>
                <option>Confirmed</option>
                <option>Preparing</option>
                <option>Ready</option>
                <option>Completed</option>
            </select>

            <button class="btn btn-primary" name="update_status">✓</button>
        </form>
    </td>
    <?php endif; ?>

</tr>

<?php endforeach; ?>

</tbody>
</table>

</div>

</body>
</html>