<?php
session_start();

require_once __DIR__ . '/../includes/db.php';

if (!isset($_POST['id'], $_POST['type'], $_POST['quantity'])) {
    header("Location: inventory.php");
    exit;
}

$id = $_POST['id'];
$type = $_POST['type'];
$qty = (int)$_POST['quantity'];

if ($qty <= 0) {
    header("Location: inventory.php");
    exit;
}

/*
|--------------------------------------------------------------------------
| STOCK UPDATE USING YOUR db() HELPER
|--------------------------------------------------------------------------
*/
if ($type === "IN") {
    $sql = "UPDATE products SET stock = stock + ? WHERE id = ?";
} else {
    $sql = "UPDATE products SET stock = stock - ? WHERE id = ?";
}

$stmt = db()->prepare($sql);   // ✅ FIXED HERE
$stmt->execute([$qty, $id]);

header("Location: inventory.php");
exit;