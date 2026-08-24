<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>@yield('title') - Pastry Project</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
    body { margin: 0; font-family: 'DM Sans', sans-serif; background: #f4f4f4; color: #111; }
    .top-nav { display: flex; justify-content: space-between; align-items: center; padding: 18px 30px; background: #fff; border-bottom: 1px solid #eee; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-name { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; }
    .brand-name span { color: #e7c46a; }
    .nav-links { display: flex; gap: 14px; }
    .nav-links a { text-decoration: none; font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #888; }
    .nav-links a.active { color: #000; border-bottom: 2px solid #e7c46a; }
    .nav-right { display: flex; align-items: center; gap: 12px; }
    .container { padding: 30px; max-width: 1200px; margin: 0 auto; }
    .card { background: #fff; border-radius: 14px; padding: 20px; margin-bottom: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.05); }
    .button { display: inline-block; background: #111; color: #fff; border: none; border-radius: 10px; padding: 12px 18px; text-decoration: none; cursor: pointer; }
    .button-secondary { background: #eee; color: #111; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { padding: 14px 12px; border-bottom: 1px solid #eee; text-align: left; }
    .status-pill { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; font-size: 12px; background: #f0f0f0; }
    .status-pending { background: #fff4e5; color: #b46c00; }
    .status-delivered { background: #e8f7ef; color: #166534; }
</style>
</head>
<body>
    <div class="top-nav">
        <div class="brand">
            <div class="brand-name">Pastry <span>Project</span></div>
        </div>
        <div class="nav-links">
            <a href="{{ url('dashboard.php') }}" class="{{ request()->is('dashboard.php') ? 'active' : '' }}">DASHBOARD</a>
            <a href="{{ url('products') }}" class="{{ request()->is('products') ? 'active' : '' }}">PRODUCTS</a>
            <a href="{{ url('orders.php') }}" class="{{ request()->is('orders.php') ? 'active' : '' }}">ORDERS</a>
            <a href="{{ url('notifications.php') }}" class="{{ request()->is('notifications.php') ? 'active' : '' }}">NOTIFICATIONS</a>
        </div>
        <div class="nav-right">
            <a href="{{ url('cart.php') }}" class="button-secondary">Cart ({{ $cartCount ?? 0 }})</a>
            <a href="{{ url('logout.php') }}" class="button-secondary">Logout</a>
        </div>
    </div>
    <div class="container">
        @if (session('message'))
            <div class="card" style="background:#e6ffed;color:#0f5132;border:1px solid #badbcc;">{{ session('message') }}</div>
        @endif
        @yield('content')
    </div>
</body>
</html>
