<?php
$conn = mysqli_connect('127.0.0.1', 'root', '', 'pastry_db');
if (!$conn) {
    echo "DB connection failed: " . mysqli_connect_error();
    exit(1);
}
$sql = "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer VARCHAR(255) DEFAULT '' , ADD COLUMN IF NOT EXISTS email VARCHAR(255) DEFAULT ''";
if (mysqli_query($conn, $sql)) {
    echo "OK\n";
} else {
    echo "ERROR: " . mysqli_error($conn) . "\n";
}
mysqli_close($conn);
?>