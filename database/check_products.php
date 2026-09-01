<?php
require_once __DIR__ . '/../includes/db.php';
$res = mysqli_query($conn, "SELECT name, image FROM products WHERE name = 'Chicken Pasta'");
$row = mysqli_fetch_assoc($res);
echo "CHICKEN_PASTA_IMAGE:" . $row['image'] . "\n";
?>