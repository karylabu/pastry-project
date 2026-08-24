<?php
$db = new mysqli('127.0.0.1', 'root', '', 'pastry_db');
if ($db->connect_error) {
    echo 'CONNECT_ERROR: ' . $db->connect_error . "\n";
    exit(1);
}
$tables = [];
$res = $db->query("SHOW TABLES");
while ($row = $res->fetch_row()) {
    $tables[] = $row[0];
}
echo "TABLES:\n";
foreach ($tables as $table) {
    echo "- $table\n";
}
if (in_array('promotions', $tables, true)) {
    $res = $db->query("SHOW CREATE TABLE promotions");
    $row = $res->fetch_assoc();
    echo "\nPROMOTIONS_SCHEMA:\n";
    echo $row['Create Table'] . "\n";
}
if (in_array('promotion_email_logs', $tables, true)) {
    $res = $db->query("SHOW CREATE TABLE promotion_email_logs");
    $row = $res->fetch_assoc();
    echo "\nPROMOTION_EMAIL_LOGS_SCHEMA:\n";
    echo $row['Create Table'] . "\n";
}
$res = $db->query("SELECT id, role, email, subscribed_promo FROM users ORDER BY id ASC LIMIT 10");
if ($res) {
    echo "\nUSERS:\n";
    while ($row = $res->fetch_assoc()) {
        echo json_encode($row) . "\n";
    }
}
