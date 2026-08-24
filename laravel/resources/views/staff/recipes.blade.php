@extends('staff.layout')

@section('title', 'Recipes')

@section('content')
<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
            <h1 style="margin:0; font-size:28px;">Recipes</h1>
            <p style="margin:4px 0 0;color:#666;">Define ingredient recipes for menu items and keep inventory consumption consistent.</p>
        </div>
        <button class="button" onclick="document.getElementById('recipeModal').classList.add('open')">+ Add / Update Recipe</button>
    </div>
</div>

@if(session('message'))
<div class="card" style="background:#e6ffed;color:#0f5132;border:1px solid #badbcc;">{{ session('message') }}</div>
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

<div class="card">
    @if(empty($recipeMap))
        <p style="color:#666; margin:0;">No recipes defined yet. Use the button above to add ingredient recipes for your products.</p>
    @else
        <div style="display:grid;gap:18px;">
            @foreach($recipeMap as $productName => $items)
            <div class="card" style="padding:18px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <div>
                        <div style="font-size:18px;font-weight:700;">{{ $productName }}</div>
                        <div style="color:#666;font-size:14px;">{{ count($items) }} ingredient{{ count($items) === 1 ? '' : 's' }}</div>
                    </div>
                    <button class="button button-secondary" onclick="openRecipeForm('{{ addslashes($productName) }}')">Edit</button>
                </div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Ingredient</th>
                            <th>Qty</th>
                            <th>Unit</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($items as $item)
                        <tr>
                            <td>{{ $item['ingredient_name'] }}</td>
                            <td>{{ number_format($item['qty'], 3) }}</td>
                            <td>{{ $item['ingredient_unit'] }}</td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
            @endforeach
        </div>
    @endif
</div>

<div class="modal-overlay" id="recipeModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.35);align-items:center;justify-content:center;padding:20px;">
    <div class="card" style="max-width:900px;width:100%;position:relative;">
        <button type="button" onclick="document.getElementById('recipeModal').style.display='none'" style="position:absolute;top:18px;right:18px;border:none;background:none;font-size:20px;cursor:pointer;">×</button>
        <h2 style="margin-top:0;">Add / Update Recipe</h2>
        <form method="POST" action="{{ url('recipes.php') }}">
            @csrf
            <input type="hidden" name="save_recipe" value="1">
            <div class="card" style="padding:18px;">
                <div class="form-group" style="margin-bottom:18px;">
                    <label class="form-label">Product</label>
                    <select name="product_id" class="form-select" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" required>
                        <option value="">Select a product</option>
                        @foreach($products as $product)
                        <option value="{{ $product['id'] }}">{{ $product['name'] }}</option>
                        @endforeach
                    </select>
                </div>
                <div id="ingredientRows">
                    <div class="form-group" style="display:grid;grid-template-columns:2fr 1fr auto;gap:10px;align-items:end; margin-bottom:10px;">
                        <div>
                            <label class="form-label">Ingredient</label>
                            <select name="ingredient_id[]" class="form-select" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" required>
                                <option value="">Choose ingredient</option>
                                @foreach($ingredients as $ingredient)
                                <option value="{{ $ingredient['id'] }}">{{ $ingredient['name'] }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div>
                            <label class="form-label">Quantity</label>
                            <input type="number" name="qty[]" class="form-input" step="0.001" placeholder="0.000" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" />
                        </div>
                        <button type="button" class="button button-secondary" onclick="removeIngredientRow(this)" style="height:40px;">−</button>
                    </div>
                </div>
                <button type="button" class="button button-secondary" onclick="addIngredientRow()" style="margin-top:10px;">+ Add ingredient</button>
            </div>
            <div style="display:flex;gap:10px;margin-top:18px;">
                <button type="submit" class="button" style="flex:1;">Save Recipe</button>
                <button type="button" class="button button-secondary" onclick="document.getElementById('recipeModal').style.display='none'" style="flex:1;">Cancel</button>
            </div>
        </form>
    </div>
</div>

<script>
function addIngredientRow() {
    const container = document.getElementById('ingredientRows');
    const row = document.createElement('div');
    row.style = 'display:grid;grid-template-columns:2fr 1fr auto;gap:10px;align-items:end;margin-bottom:10px;';
    row.innerHTML = `
        <div>
            <label class="form-label">Ingredient</label>
            <select name="ingredient_id[]" class="form-select" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" required>
                <option value="">Choose ingredient</option>
                @foreach($ingredients as $ingredient)
                <option value="{{ $ingredient['id'] }}">{{ $ingredient['name'] }}</option>
                @endforeach
            </select>
        </div>
        <div>
            <label class="form-label">Quantity</label>
            <input type="number" name="qty[]" class="form-input" step="0.001" placeholder="0.000" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;" />
        </div>
        <button type="button" class="button button-secondary" onclick="removeIngredientRow(this)" style="height:40px;">−</button>
    `;
    container.appendChild(row);
}

function removeIngredientRow(button) {
    const row = button.closest('div[style*="grid-template-columns"]');
    if (row) {
        row.remove();
    }
}

function openRecipeForm(productName) {
    const select = document.querySelector('select[name="product_id"]');
    const option = Array.from(select.options).find(o => o.text === productName);
    if (option) {
        select.value = option.value;
        document.getElementById('recipeModal').style.display = 'flex';
    }
}
</script>
@endsection
