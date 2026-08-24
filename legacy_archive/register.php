<?php

session_start();

require_once 'includes/db.php';

$error = "";
$success = "";

/* =========================
   CREATE USERS TABLE
========================= */

mysqli_query($conn, "
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    role VARCHAR(50) DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
")
;

/* =========================
   REGISTER
========================= */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $name     = trim($_POST['name']);
    $email    = trim($_POST['email']);
    $password = trim($_POST['password']);

    if (!isset($_POST['agree_terms']) || !isset($_POST['agree_privacy'])) {
        $error = "You must agree to the Terms & Conditions and Privacy Policy to create an account.";
    } elseif (!$name || !$email || !$password) {
        $error = "Please fill all fields.";
    } else {
        $name  = mysqli_real_escape_string($conn, $name);
        $email = mysqli_real_escape_string($conn, $email);

        $check = mysqli_query($conn, "SELECT id FROM users WHERE email='$email' LIMIT 1");

        if (mysqli_num_rows($check) > 0) {
            $error = "Email already exists.";

        } else {

            $hashed  = password_hash($password, PASSWORD_DEFAULT);
            $hashed  = mysqli_real_escape_string($conn, $hashed);

            $insert = mysqli_query($conn, "
                INSERT INTO users (name, email, password, role)
                VALUES ('$name', '$email', '$hashed', 'customer')
            ");

            if ($insert) {
                $success = "Account created successfully.";
            } else {
                $error = mysqli_error($conn);
            }
        }
    }
}

?>

<!DOCTYPE html>
<html lang="en">
<head>
... (archived register UI)
</html>
