<?php

$host = "localhost";
$user = "root";
$password = "";
$database = "pastry_db";
$db_error = "";

mysqli_report(MYSQLI_REPORT_OFF);
$conn = @mysqli_connect(
    $host,
    $user,
    $password,
    $database
);

if (!$conn) {
    $db_error = mysqli_connect_error();
    $conn = null;
}

?>