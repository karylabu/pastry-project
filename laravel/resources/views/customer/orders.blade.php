@extends('customer.layout')

@section('title', 'Orders')

@section('content')
<div class="card">
    <h1>My Orders</h1>
    <div style="margin-bottom: 16px;">
        <a href="{{ url('orders.php') }}?filter=all" class="button-secondary">All</a>
        <a href="{{ url('orders.php') }}?filter=Pending" class="button-secondary">Pending</a>
        <a href="{{ url('orders.php') }}?filter=Delivered" class="button-secondary">Delivered</a>
    </div>

    @if (empty($orders))
        <p>No orders found.</p>
        <a href="{{ url('products') }}" class="button">Browse Products</a>
    @else
        <table class="table">
            <thead>
                <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Items</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($orders as $order)
                <tr>
                    <td>{{ $order['id'] }}</td>
                    <td>{{ $order['date'] }}</td>
                    <td><span class="status-pill {{ strtolower($order['status']) === 'pending' ? 'status-pending' : 'status-delivered' }}">{{ $order['status'] }}</span></td>
                    <td>₱{{ number_format($order['total'], 2) }}</td>
                    <td>
                        @foreach ($order['items'] as $item)
                            <div>{{ $item['product'] }} x {{ $item['qty'] }} @ ₱{{ number_format($item['price'], 2) }}</div>
                        @endforeach
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>
    @endif
</div>
@endsection
