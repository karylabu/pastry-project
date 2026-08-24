@extends('customer.layout')

@section('title', 'Dashboard')

@section('content')
<div class="card">
    <h1>Welcome back, {{ $user['name'] ?? 'Customer' }}!</h1>
    <p>You have {{ $cartCount }} item(s) in your cart.</p>
</div>

<div class="card">
    <h2>Store Snapshot</h2>
    <p>Total available products: {{ count($products) }}</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:20px;">
        <div style="padding:16px;background:#f9f9f9;border-radius:14px;">Products: {{ count($products) }}</div>
        <div style="padding:16px;background:#f9f9f9;border-radius:14px;">Orders: {{ count(getDB()['orders'] ?? []) }}</div>
    </div>
</div>

<div class="card">
    <a href="{{ url('products') }}" class="button">Browse Products</a>
</div>
@endsection
