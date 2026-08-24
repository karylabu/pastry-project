<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login — Pastry Project</title>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fff7f8,#ffe3eb);font-family:'DM Sans',sans-serif;padding:24px}
        .card{position:relative;width:100%;max-width:430px;background:rgba(255,255,255,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.4);border-radius:34px;padding:40px;box-shadow:0 10px 40px rgba(0,0,0,0.08)}
        .brand{font-size:13px;letter-spacing:0.4em;text-transform:uppercase;color:#d4af37;margin-bottom:16px;font-weight:bold}
        h1{margin:0 0 8px;font-size:42px;font-weight:900;color:#111}
        p{margin:0 0 24px;color:#999;font-size:14px}
        .input-group{margin-bottom:18px}
        label{display:block;margin-bottom:10px;font-size:13px;color:#666;font-weight:500}
        input[type=email],input[type=password]{width:100%;height:58px;padding:0 20px;border:1px solid transparent;border-radius:18px;font-size:15px;outline:none;background:#f5f6fa;transition:all 0.2s ease;box-sizing:border-box}
        input[type=email]:focus,input[type=password]:focus{border-color:#d4af37;background:#fff;box-shadow:0 0 0 4px rgba(212,175,55,0.15)}
        .google-button{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:18px;padding:16px 14px;border:1px solid #ddd;border-radius:18px;background:#fff;color:#111;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 8px 20px rgba(0,0,0,.06);transition:all 0.2s ease}
        .google-button:hover{background:#f7f7f7;border-color:#d4af37}
        button{width:100%;height:58px;border:none;border-radius:18px;background:#000;color:#fff;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:0.2em;cursor:pointer;transition:all 0.2s ease}
        button:hover{background:#d4af37;color:#000}
        button:active{transform:scale(0.98)}
        button:disabled{opacity:0.4}
        .message{margin-bottom:16px;padding:14px;border-radius:20px;font-size:13px;border:1px solid}
        .error{background:#fff5f5;color:#dc2626;border-color:#fee2e2}
        .success{background:#f0fdf4;color:#16a34a;border-color:#bbf7d0}
        .bottom{margin-top:20px;text-align:center;font-size:14px;color:#999}
        .bottom a{color:#d4af37;text-decoration:none;font-weight:600;transition:color 0.2s ease}
        .bottom a:hover{color:#b8860b}
    </style>
</head>
<body>
    <div class="card">
        <p class="brand">Pastry Project</p>
        <h1>Login</h1>
        <p>Welcome back to your account</p>

        <a href="{{ route('auth.google.redirect') }}" class="google-button">
            <span class="google-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" focusable="false">
                    <path fill="#4285f4" d="M533.5 278.4c0-18.7-1.5-37-4.5-54.8H272v103.8h146.9c-6.4 34.9-25.8 64.5-55 84.3v69h88.7c51.9-47.8 81.9-118.3 81.9-202.3z"/>
                    <path fill="#34a853" d="M272 544.3c74.3 0 136.6-24.6 182.1-66.9l-88.7-69c-24.5 16.4-55.8 26-93.4 26-71.7 0-132.5-48.4-154.3-113.2H26.7v70.9c45.1 89.1 138.1 152.2 245.3 152.2z"/>
                    <path fill="#fbbc04" d="M117.7 324.3c-10.5-31.5-10.5-65.5 0-97l-71.1-70.9C18.6 206.5 0 238.5 0 272c0 33.5 18.6 65.5 46.6 86.6l71.1-70.9z"/>
                    <path fill="#ea4335" d="M272 107.7c39.9 0 75.9 13.7 104.2 40.7l78-78C404.3 24.4 345.5 0 272 0 164.8 0 71.8 63.1 26.7 152.2l71.1 70.9C139.5 156.1 200.3 107.7 272 107.7z"/>
                </svg>
            </span>
            Sign in with Google
        </a>

        @if(session('auth_success'))
            <div class="message success">{{ session('auth_success') }}</div>
        @endif
        @if(session('error'))
            <div class="message error">{{ session('error') }}</div>
        @elseif(!empty($error))
            <div class="message error">{{ $error }}</div>
        @endif

        <form method="POST" action="{{ route('auth.login.submit') }}">
            @csrf
            <div class="input-group">
                <label for="email">Email</label>
                <input id="email" type="email" name="email" value="{{ old('email') }}" required autofocus>
            </div>
            <div class="input-group">
                <label for="password">Password</label>
                <input id="password" type="password" name="password" required>
            </div>
            <button type="submit">Sign In</button>
        </form>

        <div class="bottom">
            Don't have an account? <a href="{{ route('auth.register') }}">Register</a>
        </div>
    </div>
</body>
</html>
