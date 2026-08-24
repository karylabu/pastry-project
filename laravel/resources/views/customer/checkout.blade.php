@extends('customer.layout')

@section('title', 'Checkout')

@section('content')
<div class="card">
    <h1>Checkout</h1>
    <div style="margin-bottom: 18px;">
        <p><strong>Name:</strong> {{ $user['name'] ?? 'Guest' }}</p>
        <p><strong>Email:</strong> {{ $user['email'] ?? '' }}</p>
        <p><strong>Cart total:</strong> ₱{{ number_format($cartTotal, 2) }}</p>
        <p><strong>Delivery fee:</strong> ₱{{ number_format($deliveryFee, 2) }}</p>
        <p><strong>Grand total:</strong> ₱{{ number_format($grandTotal, 2) }}</p>
    </div>

    <form method="post" action="{{ url('place_order.php') }}">
        @csrf
        <div style="margin-bottom:16px;">
            <h3>Items</h3>
            <table class="table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($items as $it)
                    <tr>
                        <td>{{ $it['product']['name'] ?? 'Product' }}</td>
                        <td>{{ $it['quantity'] }}</td>
                        <td>₱{{ number_format($it['price'], 2) }}</td>
                        <td>₱{{ number_format($it['price'] * $it['quantity'], 2) }}</td>
                    </tr>
                    <input type="hidden" name="selected_items[]" value="{{ $it['key'] }}">
                    @endforeach
                </tbody>
            </table>
        </div>

        <div style="display:grid;gap:16px;">
            <label>
                Delivery address
                <input type="text" name="address" value="{{ $user['address'] ?? '' }}" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:10px;">
            </label>

            <label>
                Payment method
                <select name="payment" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:10px;">
                    <option value="COD">Cash on Delivery</option>
                    <option value="GCASH">GCash</option>
                    <option value="PAYMONGO">PayMongo</option>
                </select>
            </label>

            <label>
                Order type
                <select name="order_type" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:10px;">
                    <option value="Delivery">Delivery</option>
                    <option value="Pick-up">Pick-up</option>
                </select>
            </label>

            <button type="submit" class="button">Place Order</button>
        </div>
    </form>
</div>
@endsection
