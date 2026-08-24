<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Staff Login</title>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg,#fff7f8,#ffe3eb); font-family: 'DM Sans', sans-serif; }
        .card { width: 100%; max-width: 420px; background: rgba(255,255,255,.92); border-radius: 24px; padding: 36px; box-shadow: 0 20px 60px rgba(0,0,0,.08); }
        h1 { margin: 0 0 8px; font-size: 32px; }
        p { margin: 0 0 24px; color: #555; }
        .input-group { margin-bottom: 18px; }
        .input-group label { display: block; margin-bottom: 8px; font-size: 14px; color: #555; }
        .input-group input { width: 100%; border: 1px solid #ddd; border-radius: 14px; padding: 14px 16px; font-size: 15px; outline: none; }
        .input-group input:focus { border-color: #d4af37; box-shadow: 0 0 0 6px rgba(212,175,55,.12); }
        button { width: 100%; border: none; border-radius: 14px; padding: 14px 16px; background: #111; color: #fff; font-size: 14px; cursor: pointer; }
        .error { margin-bottom: 16px; padding: 14px 16px; border-radius: 14px; background: #fff1f1; color: #b02a37; }
        .footer { margin-top: 18px; text-align: center; color: #777; font-size: 13px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Staff Login</h1>
        <p>Enter your credentials to access the staff dashboard.</p>

        @if (!empty($error))
            <div class="error">{{ $error }}</div>
        @endif

        <form method="POST" action="{{ url('staff_login.php') }}">
            @csrf
            <div class="input-group">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" required autofocus value="{{ old('email') }}">
            </div>
            <div class="input-group">
                <label for="password">Password</label>
                <input id="password" name="password" type="password" required>
            </div>
            <button type="submit">Sign In</button>
        </form>
        <div class="footer">Use a staff or admin account to access inventory, products, and orders.</div>
    </div>
</body>
</html>
