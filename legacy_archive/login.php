<?php
session_start();

require_once __DIR__ . '/../includes/db.php';

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
   CREATE PASSWORD RESETS TABLE
========================= */

mysqli_query($conn, "
CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
")
;

/* =========================
   LOGIN
========================= */

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $email    = trim($_POST['email'] ?? '');
    $password = trim($_POST['password'] ?? '');

    if (!$email || !$password) {

        $error = "Please fill all fields.";

    } else {

        $email = mysqli_real_escape_string($conn, $email);

        $query = mysqli_query(
            $conn,
            "SELECT * FROM users WHERE email='$email' LIMIT 1"
        );

        if ($query && mysqli_num_rows($query) > 0) {

            $user = mysqli_fetch_assoc($query);

            if (
                $password === $user['password'] ||
                password_verify($password, $user['password'])
            ) {

                $_SESSION['user'] = [
                    'id'    => $user['id'],
                    'name'  => $user['name'],
                    'email' => $user['email'],
                    'role'  => $user['role']
                ];

                header("Location: http://localhost:3000/pastry_system/customer");
                exit;

            } else {

                $error = "Incorrect password.";
            }

        } else {

            $error = "User not found.";
        }
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>

<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>

<title>Login</title>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">

<style>

*{
    margin:0;
    padding:0;
    box-sizing:border-box;
    font-family:'DM Sans', sans-serif;
}

body{
    min-height:100vh;
    background: linear-gradient(135deg, #fff7f8, #ffe3eb);
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    position:relative;
}

.circle{
    position:absolute;
    border-radius:50%;
    filter:blur(70px);
    opacity:.35;
}

.circle1{
    width:320px;
    height:320px;
    background:#ff9ec4;
    top:-80px;
    left:-80px;
}

.circle2{
    width:280px;
    height:280px;
    background:#ffd166;
    bottom:-80px;
    right:-80px;
}

.card{
    width:100%;
    max-width:430px;
    background:rgba(255,255,255,.85);
    backdrop-filter:blur(18px);
    border:1px solid rgba(255,255,255,.4);
    padding:42px;
    border-radius:34px;
    box-shadow: 0 10px 40px rgba(0,0,0,.08);
    position:relative;
    z-index:10;
}

.logo{
    font-size:14px;
    letter-spacing:.4em;
    text-transform:uppercase;
    color:#d4af37;
    margin-bottom:14px;
}

h1{
    font-size:42px;
    color:#111;
    margin-bottom:10px;
    line-height:1;
}

.subtitle{
    font-size:14px;
    color:#666;
    margin-bottom:30px;
}

.error{
    background:#fff1f1;
    color:#ff3b30;
    padding:14px;
    border-radius:16px;
    margin-bottom:18px;
    font-size:13px;
}

.input-group{
    margin-bottom:18px;
}

.input-group input{
    width:100%;
    height:58px;
    border:none;
    outline:none;
    background:#f5f6fa;
    border-radius:18px;
    padding:0 18px;
    font-size:15px;
    transition:.2s;
}

.input-group input:focus{
    background:#fff;
    border:1px solid #d4af37;
    box-shadow:0 0 0 4px rgba(212,175,55,.15);
}

.forgot-link{
    display:block;
    text-align:right;
    font-size:13px;
    color:#d4af37;
    text-decoration:none;
    margin-top:-10px;
    margin-bottom:18px;
    font-weight:600;
}

.forgot-link:hover{
    text-decoration:underline;
}

button{
    width:100%;
    height:58px;
    border:none;
    background:#111;
    color:#fff;
    border-radius:18px;
    font-size:14px;
    letter-spacing:.18em;
    text-transform:uppercase;
    cursor:pointer;
    transition:.25s;
    margin-top:8px;
}

button:hover{
    background:#d4af37;
    color:#111;
    transform:translateY(-2px);
}

.bottom{
    text-align:center;
    margin-top:24px;
    font-size:14px;
    color:#666;
}

.bottom a{
    color:#d4af37;
    text-decoration:none;
    font-weight:700;
}

.bottom a:hover{
    text-decoration:underline;
}

@media(max-width:500px){
    .card{ margin:20px; padding:30px; }
    h1{ font-size:34px; }
}

</style>
</head>

<body>

<div class="circle circle1"></div>
<div class="circle circle2"></div>

<div class="card">

    <div class="logo">Pastry Project</div>

    <h1>Login</h1>

    <p class="subtitle">Welcome back to your account</p>

    <?php if($error): ?>
        <div class="error"><?php echo $error; ?></div>
    <?php endif; ?>

    <form method="POST">

        <div class="input-group">
            <input
                type="email"
                name="email"
                placeholder="Email Address"
                required
            >
        </div>

        <div class="input-group">
            <input
                type="password"
                name="password"
                placeholder="Password"
                required
            >
        </div>

        <a class="forgot-link" href="forgot_password.php">Forgot password?</a>

        <button type="submit">Login</button>

    </form>

    <div class="bottom">
        Don't have an account?
        <a href="register.php">Sign up first</a>
    </div>

</div>

</body>
</html>
