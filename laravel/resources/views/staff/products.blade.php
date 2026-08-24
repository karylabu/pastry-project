@extends('staff.layout')

@section('title', 'Products')

@section('content')

<h2>Products</h2>

<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
    <a href="{{ url('staff/products.php') }}" class="button {{ $filterCat === 'all' ? 'button-secondary' : '' }}">All</a>
    @foreach($categories as $cat)
        <a href="{{ url('staff/products.php') . '?cat=' . urlencode($cat) }}" class="button {{ $filterCat === $cat ? 'button-secondary' : '' }}">{{ $cat }}</a>
    @endforeach
</div>

<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;">
    @forelse($products as $p)
        @php
            $slice = floatval($p['slice_price'] ?? $p['price'] ?? 0);
            $small = floatval($p['small_price'] ?? $slice);
            $big = floatval($p['big_price'] ?? $slice);
            $available = isset($p['available']) ? (bool) $p['available'] : true;
            $image = $p['image'] ?? '';
            $imagePath = url('../uploads/' . trim($image));
        @endphp

        <div class="card" style="padding:18px;" data-slice="{{ $slice }}" data-small="{{ $small }}" data-big="{{ $big }}">
            <div style="margin-bottom:14px;">
                @if(!empty($image))
                    <img src="{{ $imagePath }}" alt="{{ $p['name'] ?? 'Product' }}" style="width:100%;height:190px;object-fit:cover;border-radius:14px;border:1px solid #eee;" />
                @else
                    <div style="width:100%;height:190px;border-radius:14px;border:1px solid #eee;display:flex;align-items:center;justify-content:center;font-size:40px;">🍰</div>
                @endif
            </div>

            <div style="text-align:center;">
                <div style="font-size:11px;color:#777;text-transform:uppercase;margin-bottom:6px;letter-spacing:.6px;">{{ $p['category'] ?? 'Uncategorized' }}</div>
                <h3 style="margin:0 0 10px;font-family:'Playfair Display',serif;font-size:18px;">{{ $p['name'] ?? 'Unnamed Product' }}</h3>
                <p style="font-size:13px;color:#666;min-height:42px;margin-bottom:14px;">{{ $p['description'] ?? 'No description available.' }}</p>
                <div style="display:flex;justify-content:center;gap:6px;margin-bottom:14px;">
                    <button type="button" class="button button-secondary size-btn active" data-type="slice">Slice</button>
                    <button type="button" class="button button-secondary size-btn" data-type="small">Small</button>
                    <button type="button" class="button button-secondary size-btn" data-type="big">Big</button>
                </div>
                <div class="price-display" style="font-size:22px;font-weight:700;color:#b08968;margin-bottom:10px;">₱{{ number_format($slice, 2) }}</div>
                <div style="font-size:13px;color:#555;margin-bottom:16px;">Stock: <strong>{{ $p['stock'] ?? 0 }}</strong></div>
                <div style="display:flex;gap:8px;">
                    <button type="button" class="button {{ $available ? '' : 'button-secondary' }}" style="flex:1;">Available</button>
                    <button type="button" class="button {{ $available ? 'button-secondary' : '' }}" style="flex:1;">Not Available</button>
                </div>
            </div>
        </div>
    @empty
        <div style="background:#fff;padding:18px;border-radius:14px;border:1px solid #eee;color:#777;">No products found for this filter.</div>
    @endforelse
</div>

<script>
    document.querySelectorAll('.card').forEach(card => {
        const buttons = card.querySelectorAll('.size-btn');
        const priceDisplay = card.querySelector('.price-display');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const sizeType = btn.dataset.type;
                const newPrice = card.dataset[sizeType] || priceDisplay.textContent.replace(/[^0-9\.]/g, '');
                priceDisplay.textContent = '₱' + parseFloat(newPrice).toFixed(2);
            });
        });
    });
</script>

@endsection
