@extends('staff.layout')

@section('title', 'Reports')

@section('content')

<div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:14px;margin-bottom:24px;">
    <div>
        <h2>Reports</h2>
        <p style="color:#666;max-width:620px;">Generate consolidated business reports for revenue, orders, and inventory performance.</p>
    </div>
    <button class="button" onclick="window.print()">🖨️ Print Report</button>
</div>

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin-bottom:24px;">
    <div class="card" style="text-align:center;">
        <div style="font-size:32px;margin-bottom:10px;">💰</div>
        <div style="font-size:32px;font-weight:700;">₱{{ number_format($totalRevenue, 2) }}</div>
        <div style="color:#666;margin-top:8px;">Gross Revenue</div>
    </div>
    <div class="card" style="text-align:center;">
        <div style="font-size:32px;margin-bottom:10px;">✅</div>
        <div style="font-size:32px;font-weight:700;">₱{{ number_format($completedRevenue, 2) }}</div>
        <div style="color:#666;margin-top:8px;">Collected Revenue</div>
    </div>
    <div class="card" style="text-align:center;">
        <div style="font-size:32px;margin-bottom:10px;">📈</div>
        <div style="font-size:32px;font-weight:700;">₱{{ number_format($avgOrder, 2) }}</div>
        <div style="color:#666;margin-top:8px;">Average Order Value</div>
    </div>
    <div class="card" style="text-align:center;">
        <div style="font-size:32px;margin-bottom:10px;">🛒</div>
        <div style="font-size:32px;font-weight:700;">{{ count($orders) }}</div>
        <div style="color:#666;margin-top:8px;">Total Orders</div>
    </div>
</div>

<div class="card" style="margin-bottom:24px;">
    <h3 style="margin-top:0;">Sales Summary</h3>
    <table class="table" style="width:100%;margin-top:12px;">
        <thead>
            <tr>
                <th>Date</th>
                <th>Revenue</th>
                <th>Trend</th>
            </tr>
        </thead>
        <tbody>
            @php $prev = null; @endphp
            @foreach($dailySales as $date => $value)
                <tr>
                    <td>{{ $date }}</td>
                    <td><strong>₱{{ number_format($value, 2) }}</strong></td>
                    <td>
                        @if($prev !== null)
                            @if($value > $prev)
                                <span style="color:#2f7d32;">↑ {{ round((($value - $prev) / max($prev,1)) * 100, 1) }}%</span>
                            @elseif($value < $prev)
                                <span style="color:#a71d2a;">↓ {{ round((($prev - $value) / max($prev,1)) * 100, 1) }}%</span>
                            @else
                                —
                            @endif
                        @else
                            —
                        @endif
                    </td>
                </tr>
                @php $prev = $value; @endphp
            @endforeach
        </tbody>
    </table>
</div>

<div class="card" style="margin-bottom:24px;">
    <h3 style="margin-top:0;">Inventory Report</h3>
    @if(empty($ingredients))
        <div style="color:#666;padding:12px 0;">No inventory data is available for this report.</div>
    @else
        <table class="table" style="width:100%;margin-top:12px;">
            <thead>
                <tr>
                    <th>Ingredient</th>
                    <th>Stock</th>
                    <th>Threshold</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                @foreach($ingredients as $ing)
                    @php $low = ($ing['stock'] ?? 0) <= ($ing['threshold'] ?? 0); @endphp
                    <tr>
                        <td>{{ $ing['name'] ?? 'Unknown' }}</td>
                        <td>{{ $ing['stock'] ?? 0 }} {{ $ing['unit'] ?? '' }}</td>
                        <td>{{ $ing['threshold'] ?? 0 }}</td>
                        <td><span class="status-pill" style="background:{{ $low ? '#ffe5e5' : '#e7f5e8' }};color:{{ $low ? '#9c1f1f' : '#1f5d32' }};">{{ $low ? 'Low' : 'OK' }}</span></td>
                        <td style="color:#666;">{{ $low ? 'Reorder now' : 'Sufficient' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif
</div>

<div class="card">
    <h3 style="margin-top:0;">Order Details</h3>
    <div style="overflow-x:auto;margin-top:12px;">
        <table class="table" style="width:100%;min-width:900px;">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>
                @forelse($orders as $order)
                    <tr>
                        <td>#{{ $order['id'] ?? '' }}</td>
                        <td>{{ $order['customer'] ?? 'Unknown' }}<br><small>{{ $order['email'] ?? '' }}</small></td>
                        <td>{{ $order['type'] ?? '' }}</td>
                        <td>₱{{ number_format($order['total'] ?? 0, 2) }}</td>
                        <td>{{ $order['payment'] ?? '' }}</td>
                        <td><span class="status-pill">{{ $order['status'] ?? '' }}</span></td>
                        <td>{{ $order['created_at'] ?? ($order['date'] ?? '') }}</td>
                    </tr>
                @empty
                    <tr><td colspan="7" style="text-align:center;color:#777;padding:20px;">No order records available.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
</div>

@endsection
