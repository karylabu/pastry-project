@extends('staff.layout')

@section('title', 'Analytics')

@section('content')

<div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:14px;margin-bottom:24px;">
    <div>
        <h2>Business Analytics</h2>
        <p style="color:#666;max-width:620px;">Real-time business metrics for your pastry operations, including revenue, sales trends, and product performance.</p>
    </div>
    <a href="{{ url('reports.php') }}" class="button" style="margin-top:8px;">View Reports</a>
</div>

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin-bottom:24px;">
    <div class="card" style="text-align:center;">
        <div style="font-size:32px;margin-bottom:10px;">💰</div>
        <div style="font-size:32px;font-weight:700;">₱{{ number_format($totalRevenue, 2) }}</div>
        <div style="color:#666;margin-top:8px;">Total Revenue</div>
    </div>
    <div class="card" style="text-align:center;">
        <div style="font-size:32px;margin-bottom:10px;">🛒</div>
        <div style="font-size:32px;font-weight:700;">₱{{ number_format($avgOrder, 2) }}</div>
        <div style="color:#666;margin-top:8px;">Average Order Value</div>
    </div>
    <div class="card" style="text-align:center;">
        <div style="font-size:32px;margin-bottom:10px;">📦</div>
        <div style="font-size:32px;font-weight:700;">{{ count($ingredients) }}</div>
        <div style="color:#666;margin-top:8px;">Tracked Ingredients</div>
    </div>
    <div class="card" style="text-align:center;">
        <div style="font-size:32px;margin-bottom:10px;">📈</div>
        <div style="font-size:32px;font-weight:700;">{{ $unitsSold }}</div>
        <div style="color:#666;margin-top:8px;">Units Sold</div>
    </div>
</div>

<div style="display:grid;grid-template-columns:1.5fr 1fr;gap:18px;margin-bottom:24px;">
    <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
                <h3 style="margin:0;">Monthly Revenue</h3>
                <p style="color:#666;margin:4px 0 0;">Recent revenue by month</p>
            </div>
            <div style="font-size:12px;color:#888;">Total: ₱{{ number_format(array_sum(array_column($monthSales,'value')),2) }}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;align-items:end;height:220px;">
            @foreach($monthSales as $month)
                @php $percent = $maxMonth? min(100, ($month['value'] / $maxMonth) * 100) : 0; @endphp
                <div style="display:flex;flex-direction:column;align-items:center;">
                    <div style="font-size:12px;color:#666;margin-bottom:6px;">₱{{ number_format($month['value']/1000,1) }}k</div>
                    <div style="width:100%;background:#f0f0f0;border-radius:16px;height:100%;display:flex;align-items:flex-end;">
                        <div style="width:100%;height:{{ $percent }}%;background:linear-gradient(180deg,#b08968,#f4d9ac);border-radius:16px 16px 0 0;"></div>
                    </div>
                    <div style="margin-top:8px;font-size:12px;color:#333;">{{ $month['label'] }}</div>
                </div>
            @endforeach
        </div>
    </div>

    <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
                <h3 style="margin:0;">Top Products</h3>
                <p style="color:#666;margin:4px 0 0;">Best sellers by units sold</p>
            </div>
            <div style="font-size:12px;color:#888;">Total items: {{ count($topProds) }}</div>
        </div>
        @foreach($topProds as $name => $data)
            @php $ratio = $unitsSold ? ($data['sold'] / $unitsSold) * 100 : 0; @endphp
            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:14px;font-weight:600;">
                    <span>{{ $name }}</span>
                    <span style="color:#b08968;">{{ $data['sold'] }} sold</span>
                </div>
                <div style="background:#f0f0f0;border-radius:12px;height:10px;overflow:hidden;">
                    <div style="width:{{ round($ratio,1) }}%;height:100%;background:linear-gradient(90deg,#b08968,#f4d9ac);"></div>
                </div>
                <div style="margin-top:6px;font-size:12px;color:#666;">₱{{ number_format($data['revenue'],2) }}</div>
            </div>
        @endforeach
    </div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
    <div class="card">
        <h3 style="margin-top:0;">Daily Sales Trend</h3>
        @foreach($dailySales as $date => $value)
            @php $percent = $maxDay ? min(100, ($value / $maxDay) * 100) : 0; @endphp
            <div style="margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
                    <span>{{ $date }}</span>
                    <span>₱{{ number_format($value,2) }}</span>
                </div>
                <div style="background:#f0f0f0;border-radius:10px;height:10px;overflow:hidden;">
                    <div style="width:{{ round($percent,1) }}%;height:100%;background:#b08968;"></div>
                </div>
            </div>
        @endforeach
    </div>

    <div class="card">
        <h3 style="margin-top:0;">Inventory Snapshot</h3>
        @if(empty($ingredients))
            <div style="color:#666;">No ingredient inventory data available.</div>
        @else
            <table class="table" style="margin-top:10px;">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Stock</th>
                        <th>Threshold</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($ingredients as $ingredient)
                        @php $low = ($ingredient['stock'] ?? 0) <= ($ingredient['threshold'] ?? 0); @endphp
                        <tr>
                            <td>{{ $ingredient['name'] ?? 'Unknown' }}</td>
                            <td>{{ $ingredient['stock'] ?? 0 }} {{ $ingredient['unit'] ?? '' }}</td>
                            <td>{{ $ingredient['threshold'] ?? 0 }}</td>
                            <td><span class="status-pill" style="background:{{ $low ? '#ffe5e5' : '#e7f5e8' }};color:{{ $low ? '#9c1f1f' : '#1f5d32' }};">{{ $low ? 'Low' : 'OK' }}</span></td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif
    </div>
</div>

@endsection
