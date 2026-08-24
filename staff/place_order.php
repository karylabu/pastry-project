<?php
session_start();
require 'includes/data.php';
$db = &getDB();
$role = $_SESSION['user']['role'] ?? 'customer';

// Handle order submission
if ($_POST && isset($_POST['place_order'])) {
    $items = [];
    foreach ($_POST['qty'] as $pid => $qty) {
        $qty = (int)$qty;
        if ($qty > 0) {
            foreach ($db['products'] as $p) {
                if ($p['id'] == $pid) {
                    $items[] = ['product' => $p['name'], 'qty' => $qty, 'price' => $p['price'] * $qty];
                }
            }
        }
    }
    if (!empty($items)) {
        // Build notes with custom details and addons
        $notes = $_POST['notes'] ?? '';
        if ($_POST['order_type'] === 'Custom' && !empty($_POST['custom_details'])) {
            $notes .= "\n\n🎨 CUSTOM REQUEST: " . $_POST['custom_details'];
            if (!empty($_POST['preferred_date'])) {
                $notes .= "\nPreferred Date: " . $_POST['preferred_date'];
            }
        }
        if ($_POST['order_type'] === 'Addons' && !empty($_POST['addons'])) {
            $notes .= "\n\n➕ ADD-ONS: " . implode(', ', $_POST['addons']);
        }

        $orderId = db_place_order([
            'customer' => $_SESSION['user']['name'],
            'email'    => $_SESSION['user']['email'],
            'type'     => $_POST['order_type'],
            'payment'  => $_POST['payment'],
            'address'  => $_POST['address'],
            'notes'    => $notes,
            'items'    => $items,
        ]);
        $_SESSION['order_success'] = $orderId;
        header('Location: place_order.php?success=1'); exit;
    }
}

// Handle pre-selected product/category from dashboard
$preselectedProduct = null;
$preselectedCategory = null;
if (isset($_GET['product'])) {
    $productId = (int)$_GET['product'];
    $preselectedProduct = array_filter($db['products'], fn($p) => $p['id'] === $productId);
    $preselectedProduct = reset($preselectedProduct);
}
if (isset($_GET['category'])) {
    $preselectedCategory = $_GET['category'];
}

include 'includes/header.php';
?>
<div class="main">
  <div class="topbar">
    <div class="page-title">
      <h1>Place an Order</h1>
      <p>Browse our menu and add items to your order</p>
    </div>
  </div>
  <div class="content">
    <?php if (isset($_GET['success']) && isset($_SESSION['order_success'])): ?>
    <div class="alert alert-success" style="font-size:15px">
      🎉 Order <strong>#<?= $_SESSION['order_success'] ?></strong> placed successfully! We'll confirm it shortly via email/SMS.
    </div>
    <?php unset($_SESSION['order_success']); endif; ?>

    <form method="POST">
      <div class="grid-2" style="align-items:start">
        <!-- Products -->
        <div>
          <div class="card" style="margin-bottom:16px">
            <div class="card-header">
              <div class="card-title">🎂 Select Items</div>
              <?php if ($preselectedCategory): ?>
              <div style="font-size:12px;color:var(--muted)">Showing: <strong><?= htmlspecialchars($preselectedCategory) ?></strong> category</div>
              <?php endif; ?>
            </div>
            <?php 
            $categories = array_unique(array_column($db['products'], 'category'));
            foreach ($categories as $cat):
              $catProds = array_filter($db['products'], fn($p) => $p['category'] === $cat && $p['available']);
              if (empty($catProds)) continue;
              
              // Skip categories if filtering by specific category
              if ($preselectedCategory && $cat !== $preselectedCategory) continue;
            ?>
            <div style="margin-bottom:16px">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:600;margin-bottom:8px"><?= $cat ?></div>
              <?php foreach ($catProds as $p): 
                $isPreselected = $preselectedProduct && $preselectedProduct['id'] === $p['id'];
              ?>
              <div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:10px;border:1.5px solid <?= $isPreselected ? 'var(--rose)' : 'var(--border)' ?>;margin-bottom:6px;background:<?= $isPreselected ? 'var(--blush)' : 'var(--cream)' ?>;">
                <div style="font-size:28px"><?= $p['image'] ?></div>
                <div style="flex:1">
                  <div style="font-weight:500;font-size:13.5px"><?= htmlspecialchars($p['name']) ?> <?php if ($isPreselected): ?><span style="color:var(--rose);font-size:11px">★ SELECTED</span><?php endif; ?></div>
                  <div style="font-size:12px;color:var(--muted)"><?= htmlspecialchars($p['description']) ?></div>
                  <div style="color:var(--rose-dark);font-weight:700;font-size:14px;margin-top:2px">₱<?= number_format($p['price']) ?></div>
                </div>
                <div style="display:flex;align-items:center;gap:6px">
                  <input type="number" name="qty[<?= $p['id'] ?>]" min="0" max="<?= $p['stock'] ?>" value="<?= $isPreselected ? 1 : 0 ?>" 
                    class="form-input" style="width:70px;text-align:center;padding:7px 8px"
                    onchange="updateTotal()" data-price="<?= $p['price'] ?>">
                </div>
              </div>
              <?php endforeach; ?>
            </div>
            <?php endforeach; ?>
          </div>
        </div>

        <!-- Order details -->
        <div style="position:sticky;top:80px">
          <div class="card" style="margin-bottom:16px">
            <div class="card-header">
              <div class="card-title">📋 Order Details</div>
            </div>
            <div class="form-group">
              <label class="form-label">Order Type</label>
              <select name="order_type" class="form-select" id="orderType" onchange="toggleCustomFields()">
                <option value="Standard">Standard Order</option>
                <option value="Pre-order">Pre-order (schedule date)</option>
                <option value="Rush">Rush Order (+₱50 fee)</option>
                <option value="Custom">Custom Order (special request)</option>
                <option value="Addons">Add Extra Items</option>
              </select>
            </div>

            <!-- Custom Order Fields -->
            <div id="customFields" style="display:none;">
              <div class="form-group">
                <label class="form-label">Custom Request Details</label>
                <textarea name="custom_details" class="form-textarea" placeholder="Describe your custom order (e.g., special decorations, dietary requirements, size modifications)..."></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Preferred Date (for custom orders)</label>
                <input type="date" name="preferred_date" class="form-input" min="<?= date('Y-m-d') ?>">
              </div>
            </div>

            <!-- Addons Fields -->
            <div id="addonsFields" style="display:none;">
              <div class="form-group">
                <label class="form-label">Extra Add-ons</label>
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <label style="display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" name="addons[]" value="Extra Frosting (+₱25)"> Extra Frosting (+₱25)
                  </label>
                  <label style="display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" name="addons[]" value="Sprinkles (+₱15)"> Sprinkles (+₱15)
                  </label>
                  <label style="display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" name="addons[]" value="Candles (+₱10)"> Candles (+₱10)
                  </label>
                  <label style="display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" name="addons[]" value="Special Packaging (+₱30)"> Special Packaging (+₱30)
                  </label>
                  <label style="display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" name="addons[]" value="Personalized Message (+₱20)"> Personalized Message (+₱20)
                  </label>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Delivery Address</label>
              <textarea name="address" class="form-textarea" placeholder="Enter your complete delivery address..." required></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Payment Method</label>
              <select name="payment" class="form-select">
                <option value="GCash">GCash</option>
                <option value="PayMaya">PayMaya</option>
                <option value="COD">Cash on Delivery</option>
              </select>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">🧾 Order Summary</div>
            </div>
            <div id="orderSummary" style="min-height:60px;color:var(--muted);font-size:13px;margin-bottom:16px">
              No items selected yet. Add items from the menu.
            </div>
            <div style="padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600">Total Amount</span>
              <span id="orderTotal" style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:var(--rose-dark)">₱0</span>
            </div>
            <button type="submit" name="place_order" class="btn btn-primary" style="width:100%;justify-content:center;padding:13px;font-size:15px">
              🛒 Place Order
            </button>
            <p style="font-size:11px;color:var(--muted);text-align:center;margin-top:10px">You'll receive an email/SMS confirmation</p>
          </div>
        </div>
      </div>
    </form>
  </div>
</div>
<script>
function toggleCustomFields() {
  const orderType = document.getElementById('orderType').value;
  const customFields = document.getElementById('customFields');
  const addonsFields = document.getElementById('addonsFields');
  
  customFields.style.display = orderType === 'Custom' ? 'block' : 'none';
  addonsFields.style.display = orderType === 'Addons' ? 'block' : 'none';
}

function updateTotal() {
  const inputs = document.querySelectorAll('input[data-price]');
  let total = 0;
  let summary = '';
  inputs.forEach(inp => {
    const qty = parseInt(inp.value) || 0;
    const price = parseFloat(inp.dataset.price);
    if (qty > 0) {
      total += qty * price;
      const pName = inp.closest('div').previousElementSibling?.querySelector('.form-input')?.value || 
                    inp.closest('[style]').querySelector('[style*="font-weight:500"]')?.textContent?.trim() || '';
      const label = inp.closest('div[style*="flex:1"]') ? inp.closest('div[style*="display:flex"]').querySelector('div[style*="flex:1"]') : null;
      const name = inp.closest('div[style*="display:flex"]').querySelector('div[style*="font-weight:500"]')?.textContent?.trim() || 'Item';
      summary += `<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px"><span>${qty}× ${name}</span><span style="font-weight:600">₱${(qty*price).toLocaleString()}</span></div>`;
    }
  });
  document.getElementById('orderTotal').textContent = '₱' + total.toLocaleString();
  document.getElementById('orderSummary').innerHTML = summary || '<div style="color:var(--muted);font-size:13px">No items selected yet.</div>';
}
</script>
</body></html>
