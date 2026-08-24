@extends('customer.layout')

@section('title', 'Cart')

@section('content')
<div class="card">
    <h1>Cart</h1>
    @if (empty($items))
        <p>Your cart is empty.</p>
        <a href="{{ url('products') }}" class="button">Continue Shopping</a>
    @else
        <form method="post" action="{{ url('checkout.php') }}" id="checkoutForm">
            @csrf
            <table class="table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="select_all"></th>
                        <th>Product</th>
                        <th>Size</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Subtotal</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($items as $item)
                    <tr>
                        <td style="text-align:center;">
                            <input type="checkbox" name="selected_items[]" value="{{ $item['key'] }}" class="select_item">
                        </td>
                        <td>{{ $item['product']['name'] ?? 'Product' }}</td>
                        <td>{{ $item['size_label'] ?? 'Regular' }}</td>
                        <td>{{ $item['quantity'] }}</td>
                        <td>₱{{ number_format($item['price'], 2) }}</td>
                        <td>₱{{ number_format($item['subtotal'], 2) }}</td>
                        <td>
                            <form method="post" action="{{ url('cart.php') }}">
                                @csrf
                                <input type="hidden" name="remove_item" value="{{ $item['key'] }}">
                                <button type="submit" class="button-secondary">Remove</button>
                            </form>
                        </td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </form>

        <div class="card" style="margin-top:24px;">
            <p><strong>Cart total:</strong> ₱{{ number_format($total, 2) }}</p>
            <div style="display:flex;gap:12px;flex-wrap:wrap">
                <form method="post" action="{{ url('cart.php') }}">
                    @csrf
                    <button type="submit" name="clear_cart" value="1" class="button-secondary">Clear Cart</button>
                </form>
                <button type="submit" form="checkoutForm" class="button">Checkout</button>
            </div>
        </div>
    @endif
</div>
<script>
document.addEventListener('DOMContentLoaded', function(){
    const selectAll = document.getElementById('select_all');
    if (!selectAll) return;
    selectAll.addEventListener('change', function(){
        document.querySelectorAll('.select_item').forEach(cb => cb.checked = selectAll.checked);
    });
});
</script>

@endsection
