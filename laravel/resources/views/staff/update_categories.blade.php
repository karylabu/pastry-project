@extends('staff.layout')

@section('title', 'Update Categories')

@section('content')
<div class="card">
    <h1 style="margin-top:0;">Update Product Categories</h1>
    <p style="color:#666;">Normalize product categories in the database. Run this if you need to standardize lower-case category values.</p>
</div>

@if(session('message'))
<div class="card" style="background:#e6ffed;color:#0f5132;border:1px solid #badbcc;">{{ session('message') }}</div>
@endif

<div class="card" style="display:flex;justify-content:space-between;align-items:center;">
    <div>
        <p style="margin:0;color:#333;">This operation updates existing products with category values of "meals" and "cakes" to title case.</p>
    </div>
    <form method="POST" action="{{ url('update_categories.php') }}">
        @csrf
        <button type="submit" class="button">Run Update</button>
    </form>
</div>

@if(session('categories'))
<div class="card" style="margin-top:18px;">
    <div style="font-weight:700;margin-bottom:10px;">Current categories:</div>
    <div>{{ implode(', ', session('categories')) }}</div>
</div>
@endif
@endsection
