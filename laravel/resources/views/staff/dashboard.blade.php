@extends('staff.layout')

@section('title', 'Staff Dashboard')

@section('content')

<div class="card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;">

    <div class="card">
        <h3>Total Orders</h3>
        <p style="font-size:28px;font-weight:700;">{{ $totalOrders }}</p>
    </div>

    <div class="card">
        <h3>Low Stock Products</h3>
        <p style="font-size:28px;font-weight:700;">{{ $lowStocks }}</p>
    </div>

    <div class="card">
        <h3>Pending Orders</h3>
        <p style="font-size:28px;font-weight:700;">{{ $pendingOrders }}</p>
    </div>

    <div class="card">
        <h3>Today's Sales</h3>
        <p style="font-size:28px;font-weight:700;">₱{{ number_format($dailySales, 2) }}</p>
    </div>

</div>

<div style="display:flex;gap:15px;margin:20px 0;">
    <a href="#" class="button">Create Order</a>
    <a href="{{ url('staff/inventory.php') }}" class="button">Manage Inventory</a>
    <a href="{{ url('analytics.php') }}" class="button">View Analytics</a>
</div>

<div style="margin-top:20px;">
    <div style="display:flex;gap:10px;overflow-x:auto;">
        @foreach($categories as $i => $cat)
            <div class="" style="padding:8px 16px;background:#eee;border-radius:20px;{{ $i===0? 'background:#111;color:#fff;':'' }}">{{ $cat }}</div>
        @endforeach
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:16px;">
        @foreach($products as $p)
        <div style="background:#fff;padding:15px;border-radius:12px;border:1px solid #ddd;text-align:center;">
            @php
                $image = $p['image'] ?? '';
                $imagePath = url('../uploads/' . ($image ?? ''));
            @endphp

            @if(!empty($image) && file_exists(base_path('../uploads/' . ($image ?? ''))))
                <img src="{{ $imagePath }}" style="width:100px;height:100px;object-fit:contain;">
            @else
                <div style="font-size:40px">🍰</div>
            @endif

            <h3>{{ $p['name'] ?? '' }}</h3>
            <div class="price">₱{{ number_format($p['slice_price'] ?? 0, 2) }}</div>
            <div class="stock-display">Stock: {{ $p['stock'] ?? 0 }}</div>
            @if(($p['stock'] ?? 0) <= 5)
                <div style="margin-top:10px;background:#ffe3e3;color:#c00;padding:6px;border-radius:6px;font-size:12px;font-weight:700;">⚠ Low Stock</div>
            @endif
        </div>
        @endforeach
    </div>
</div>

@endsection
