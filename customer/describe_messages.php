<?php
require_once __DIR__ . '/../includes/db.php';
if (!$conn) {
    die("DB connection failed");
}
$res = $conn->query("DESCRIBE messages");
while ($row = $res->fetch_assoc()) {
    print_r($row);
}
$conn->close();
?>
