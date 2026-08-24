@extends('customer.layout')

@section('title', 'Notifications')

@section('content')
<div class="card">
    <h1>Notifications</h1>

    @if (empty($notifications))
        <p>No notifications available.</p>
        <a href="{{ url('products') }}" class="button">View Products</a>
    @else
        <ul style="list-style:none;padding:0;">
            @foreach ($notifications as $notification)
                <li style="background:#fff;padding:16px;border-radius:14px;margin-bottom:12px;">
                    <strong>{{ $notification['title'] ?? 'Notification' }}</strong>
                    <p>{{ $notification['message'] ?? '' }}</p>
                    <small>{{ $notification['created_at'] ?? '' }}</small>
                </li>
            @endforeach
        </ul>
    @endif
</div>
@endsection
