<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>@yield('title') - Staff</title>
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
</style>
</head>
<body>
    <div class="top-nav">
        <div class="brand">
            <div class="brand-name">Pastry <span>Project</span></div>
        </div>
        <div class="nav-links">
            <a href="{{ url('staff/dashboard.php') }}" class="{{ request()->is('staff/dashboard.php') ? 'active' : '' }}">DASHBOARD</a>
            <a href="{{ url('staff/products.php') }}" class="{{ request()->is('staff/products.php') ? 'active' : '' }}">PRODUCTS</a>
            <a href="{{ url('staff/inventory.php') }}" class="{{ request()->is('staff/inventory.php') ? 'active' : '' }}">INVENTORY</a>
            <a href="{{ url('staff/orders.php') }}" class="{{ request()->is('staff/orders.php') ? 'active' : '' }}">ORDERS</a>
            @if(session('user.role') === 'admin')
                <a href="{{ url('recipes.php') }}" class="{{ request()->is('recipes.php') ? 'active' : '' }}">RECIPES</a>
                <a href="{{ url('update_categories.php') }}" class="{{ request()->is('update_categories.php') ? 'active' : '' }}">CATEGORIES</a>
            @endif
            @if(in_array(session('user.role'), ['admin', 'staff']))
                <a href="{{ url('variance.php') }}" class="{{ request()->is('variance.php') ? 'active' : '' }}">VARIANCE</a>
            @endif
            @if(session('user.role') === 'admin')
                <a href="{{ url('analytics.php') }}" class="{{ request()->is('analytics.php') ? 'active' : '' }}">ANALYTICS</a>
                <a href="{{ url('reports.php') }}" class="{{ request()->is('reports.php') ? 'active' : '' }}">REPORTS</a>
            @endif
        </div>
        <div class="nav-right">
            <a href="{{ url('staff/logout.php') }}" class="button-secondary">Logout</a>
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
