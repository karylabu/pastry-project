@extends('staff.layout')

@section('title', 'Staff Orders')

@section('content')

<h2>Orders</h2>

<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
    @foreach(['all','pending','confirmed','preparing','ready','completed'] as $f)
        <a href="{{ url('staff/orders.php') . '?filter=' . $f }}" class="button {{ $filter === $f ? 'button-secondary' : '' }}" style="text-transform:capitalize;">{{ ucfirst($f) }}</a>
    @endforeach
</div>

<div style="overflow-x:auto;">
    <table class="table" style="min-width:900px;">
        <thead>
            <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
            </tr>
        </thead>
        <tbody>
            @forelse($orders as $o)
                @php
                    $status = strtolower($o['status'] ?? '');
                    $color = '#eee';
                    if ($status === 'pending') $color = '#fff3cd';
                    elseif ($status === 'confirmed') $color = '#cfe2ff';
                    elseif ($status === 'preparing') $color = '#ffe5b4';
                    elseif ($status === 'ready') $color = '#d1e7dd';
                    elseif ($status === 'completed') $color = '#d1e7dd';
                @endphp
                <tr>
                    <td>#{{ $o['id'] }}</td>
                    <td>
                        {{ $o['customer'] ?? 'Unknown' }}<br>
                        <small>{{ $o['email'] ?? '' }}</small>
                    </td>
                    <td>{{ $o['type'] ?? '' }}</td>
                    <td>₱{{ number_format($o['total'] ?? 0, 2) }}</td>
                    <td>{{ $o['payment'] ?? '' }}</td>
                    <td><span style="display:inline-flex;padding:6px 10px;border-radius:999px;background:{{ $color }};font-size:12px;">{{ $o['status'] ?? 'Unknown' }}</span></td>
                    <td>{{ $o['created_at'] ?? '' }}</td>
                    <td>
                        <form method="POST" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                            @csrf
                            <input type="hidden" name="order_id" value="{{ $o['id'] }}">
                            <select name="new_status" style="padding:8px;border:1px solid #ddd;border-radius:8px;min-width:120px;">
                                <option>Pending</option>
                                <option>Confirmed</option>
                                <option>Preparing</option>
                                <option>Ready</option>
                                <option>Completed</option>
                            </select>
                            <button type="submit" name="update_status" class="button" style="background:#111;color:#fff;">Update</button>
                        </form>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="8" style="text-align:center;padding:30px;color:#777;">No orders found.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>

@endsection
