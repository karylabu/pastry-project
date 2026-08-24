@extends('staff.layout')

@section('title', 'Manage Inventory')

@section('content')

<h2>Manage Inventory</h2>

<form method="GET" class="search-box">
    <input type="text" name="search" placeholder="Search product..." value="{{ $search }}">
</form>

<h3>Low Stock Items</h3>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:15px;">
    @if(empty($lowStock))
        <div style="background:#fff;padding:15px;border-radius:12px;border:1px solid #ddd;color:#777;">No low stock items 🎉</div>
    @else
        @foreach($lowStock as $p)
            <div style="background:#fff;padding:15px;border-radius:12px;border:1px solid #ddd;border-left:5px solid red;">
                <h4>{{ $p['name'] ?? 'Unknown' }}</h4>
                <div>Stock: <b>{{ $p['stock'] ?? 0 }}</b></div>
            </div>
        @endforeach
    @endif
</div>

<h3 style="margin-top:20px;">All Products</h3>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:15px;">
    @if(empty($products))
        <div style="background:#fff;padding:15px;border-radius:12px;border:1px solid #ddd;color:#777;">No products found.</div>
    @else
        @foreach($products as $p)
            @php
                $stock = $p['stock'] ?? 0;
                $reorder = 5;
                $status = ($stock <= 0) ? 'out' : (($stock <= $reorder) ? 'low' : 'safe');
                $badgeClass = $status === 'low' ? 'lowb' : $status;
            @endphp

            <div style="background:#fff;padding:15px;border-radius:12px;border:1px solid #ddd;">
                <h4>{{ $p['name'] ?? 'Unnamed' }}</h4>
                <div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-top:5px;">{{ strtoupper($status) }}</div>
                <div style="margin-top:10px;">Current Stock: <b>{{ $stock }}</b></div>
                <div>Reorder Level: {{ $reorder }}</div>

                <form method="POST" action="{{ url('staff/inventory_update.php') }}">
                    @csrf
                    <input type="hidden" name="id" value="{{ $p['id'] }}">
                    <select name="type" required style="margin-top:8px;padding:10px;border-radius:8px;border:1px solid #ddd;width:100%;">
                        <option value="IN">Stock IN (+)</option>
                        <option value="OUT">Stock OUT (-)</option>
                    </select>
                    <input type="number" name="quantity" placeholder="Quantity" required min="1" style="margin-top:8px;padding:10px;border-radius:8px;border:1px solid #ddd;width:100%;">
                    <button type="submit" style="margin-top:10px;padding:10px;width:100%;border:none;background:#111;color:#fff;border-radius:8px;">Update Stock</button>
                </form>
            </div>
        @endforeach
    @endif
</div>

@endsection
