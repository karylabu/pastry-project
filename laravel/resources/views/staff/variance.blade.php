@extends('staff.layout')

@section('title', 'Variance')

@section('content')
<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
            <h1 style="margin:0; font-size:28px;">Variance Management</h1>
            <p style="margin:4px 0 0;color:#666;">Track waste, spoilage, and inventory discrepancies by ingredient or product.</p>
        </div>
        <button class="button" onclick="document.getElementById('varianceModal').style.display='flex'">+ Log Variance</button>
    </div>
</div>

@if(session('message'))
<div class="card" style="background:#e6ffed;color:#0f5132;border:1px solid #badbcc;">{{ session('message') }}</div>
@endif

@if(session('error'))
<div class="card" style="background:#fff1f0;color:#842029;border:1px solid #f5c2c7;">{{ session('error') }}</div>
@endif

@if($errors->any())
<div class="card" style="background:#fff1f0;color:#842029;border:1px solid #f5c2c7;">
    <ul style="margin:0;padding-left:18px;">
        @foreach($errors->all() as $error)
            <li>{{ $error }}</li>
        @endforeach
    </ul>
</div>
@endif

<div class="card" style="margin-bottom:18px;">
    <form method="GET" style="display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end;">
        <div>
            <label class="form-label">From</label>
            <input type="date" name="start" class="form-input" value="{{ $startDate }}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" />
        </div>
        <div>
            <label class="form-label">To</label>
            <input type="date" name="end" class="form-input" value="{{ $endDate }}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" />
        </div>
        <button type="submit" class="button" style="height:44px;">Filter</button>
    </form>
</div>

<div class="card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-bottom:18px;">
    <div style="padding:18px;background:#fff;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,0.05);">
        <div style="font-size:28px;font-weight:700;">{{ count($varianceRows) }}</div>
        <div style="color:#666;margin-top:6px;">Total records</div>
        <div style="color:#999;font-size:13px;margin-top:10px;">Period: {{ $startDate }} – {{ $endDate }}</div>
    </div>
    <div style="padding:18px;background:#fff;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,0.05);">
        <div style="font-size:28px;font-weight:700;">{{ number_format($varianceSummaryRows['Waste'] ?? 0, 3) }}</div>
        <div style="color:#666;margin-top:6px;">Waste (units)</div>
    </div>
    <div style="padding:18px;background:#fff;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,0.05);">
        <div style="font-size:28px;font-weight:700;">{{ number_format($varianceSummaryRows['Spoilage'] ?? 0, 3) }}</div>
        <div style="color:#666;margin-top:6px;">Spoilage (units)</div>
    </div>
    <div style="padding:18px;background:#fff;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,0.05);">
        <div style="font-size:28px;font-weight:700;">{{ number_format($varianceSummaryRows['Damage'] ?? 0, 3) }}</div>
        <div style="color:#666;margin-top:6px;">Damage (units)</div>
    </div>
</div>

<div class="card">
    <table class="table">
        <thead>
            <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Item</th>
                <th>Qty Lost</th>
                <th>Reason</th>
                <th>Logged By</th>
                <th>Notes</th>
            </tr>
        </thead>
        <tbody>
            @if(empty($varianceRows))
                <tr><td colspan="7" style="text-align:center;color:#666;padding:24px;">No variance records found for this period.</td></tr>
            @else
                @foreach($varianceRows as $v)
                <tr>
                    <td>{{ $v['recorded_date'] }}</td>
                    <td>{{ $v['variance_type'] }}</td>
                    <td>{{ $v['ingredient_name'] ?? $v['product_name'] ?? '—' }}</td>
                    <td>{{ number_format($v['qty_lost'], 3) }}</td>
                    <td>{{ $v['reason'] ?: '—' }}</td>
                    <td>{{ $v['recorded_by_name'] ?: '—' }}</td>
                    <td>{{ \Illuminate\Support\Str::limit($v['notes'] ?? '', 40) }}</td>
                </tr>
                @endforeach
            @endif
        </tbody>
    </table>
</div>

<div class="modal-overlay" id="varianceModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.35);align-items:center;justify-content:center;padding:20px;">
    <div class="card" style="max-width:720px;width:100%;position:relative;">
        <button type="button" onclick="document.getElementById('varianceModal').style.display='none'" style="position:absolute;top:18px;right:18px;border:none;background:none;font-size:20px;cursor:pointer;">×</button>
        <h2 style="margin-top:0;">Log New Variance</h2>
        <form method="POST" action="{{ url('variance.php') }}">
            @csrf
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                <div>
                    <label class="form-label">Variance Type</label>
                    <select name="variance_type" class="form-select" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" required>
                        <option value="Waste">Waste</option>
                        <option value="Spoilage">Spoilage</option>
                        <option value="Damage">Damage</option>
                        <option value="Unaccounted">Unaccounted</option>
                    </select>
                </div>
                <div>
                    <label class="form-label">Item Type</label>
                    <select name="item_type" id="itemType" class="form-select" onchange="toggleItemFields()" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" required>
                        <option value="ingredient">Ingredient</option>
                        <option value="product">Product</option>
                    </select>
                </div>
            </div>
            <div class="card" style="padding:16px; margin-top:14px; background:#f9fafb;">
                <div id="ingredientGroup">
                    <label class="form-label">Ingredient</label>
                    <select name="ingredient_id" class="form-select" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;">
                        <option value="">Choose an ingredient</option>
                        @foreach($ingredients as $ingredient)
                        <option value="{{ $ingredient['id'] }}">{{ $ingredient['name'] }}</option>
                        @endforeach
                    </select>
                </div>
                <div id="productGroup" style="display:none;">
                    <label class="form-label">Product</label>
                    <select name="product_id" class="form-select" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;">
                        <option value="">Choose a product</option>
                        @foreach($products as $product)
                        <option value="{{ $product['id'] }}">{{ $product['name'] }}</option>
                        @endforeach
                    </select>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">
                <div>
                    <label class="form-label">Quantity Lost</label>
                    <input type="number" name="qty_lost" step="0.001" class="form-input" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" required />
                </div>
                <div>
                    <label class="form-label">Reason</label>
                    <input type="text" name="reason" class="form-input" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" />
                </div>
            </div>
            <div style="margin-top:14px;">
                <label class="form-label">Additional Notes</label>
                <textarea name="notes" class="form-input" rows="4" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;"></textarea>
            </div>
            <div style="display:flex;gap:10px;margin-top:18px;">
                <button type="submit" class="button" style="flex:1;">Log Variance</button>
                <button type="button" class="button button-secondary" onclick="document.getElementById('varianceModal').style.display='none'" style="flex:1;">Cancel</button>
            </div>
        </form>
    </div>
</div>

<script>
function toggleItemFields() {
    const type = document.getElementById('itemType').value;
    const ingredientGroup = document.getElementById('ingredientGroup');
    const productGroup = document.getElementById('productGroup');
    if (type === 'ingredient') {
        ingredientGroup.style.display = 'block';
        productGroup.style.display = 'none';
    } else {
        ingredientGroup.style.display = 'none';
        productGroup.style.display = 'block';
    }
}
</script>
@endsection
