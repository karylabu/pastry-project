<?php
session_start();
require_once __DIR__ . '/includes/db.php';

$user = $_SESSION['user'] ?? null;
$products = db_all("SELECT * FROM products WHERE available = 1");
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Pastry Project</title>

<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">

<style>
body{margin:0;font-family:'DM Sans',sans-serif;background:#f8f7f5;}
.top-nav{display:flex;justify-content:space-between;align-items:center;padding:18px 30px;background:#fff;border-bottom:1px solid #eee;position:sticky;top:0;z-index:10;}
.left-nav{display:flex;align-items:center;gap:30px;}
.brand{display:flex;align-items:center;gap:10px;}
.logo{width:40px;height:40px;object-fit:cover;border-radius:10px;}
.brand-name{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;}
.brand-name span{color:#e7c46a;}
.nav-links{display:flex;gap:20px;}
.nav-links button{background:none;border:none;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer;color:#888;}
.nav-links button.active{color:#000;border-bottom:2px solid #e7c46a;}
.nav-right{display:flex;align-items:center;gap:10px;}
.btn-login{padding:8px 16px;border-radius:10px;text-decoration:none;color:#111;font-weight:600;}
.user-menu{position:relative;z-index:60;}
.user-name{font-family:'Playfair Display',serif;font-weight:600;cursor:pointer;padding:6px 10px;border-radius:8px;}
.user-name:hover{background:#f1f1f1;}
.dropdown{position:absolute;top:40px;right:0;background:#fff;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,0.1);display:none;min-width:140px;overflow:hidden;z-index:50;}
.dropdown a{display:block;padding:10px;text-decoration:none;color:#111;text-align:left;}
.dropdown a:hover{background:#f5f5f5;}
.cart-btn{position:relative;background:#111;color:#fff;padding:10px 14px;border-radius:10px;}
.cart-badge{position:absolute;top:-6px;right:-6px;background:red;color:#fff;font-size:10px;padding:3px 6px;border-radius:50%;}

/* SEARCH */
.header-search input{
  padding:8px 14px;
  border-radius:20px;
  border:1px solid #ddd;
  font-size:13px;
  width:180px;
  outline:none;
}
.header-search input:focus{border-color:#111;}

/* ================= HERO ================= */
.hero{
  background: radial-gradient(circle at center, #2a2f35 0%, #1b1e22 100%);
  color:#fff;
  text-align:center;
  padding:140px 20px 120px;
  position:relative;
  overflow:hidden;
}

.hero::after{
  content:'';
  position:absolute;
  width:400px;
  height:400px;
  background:rgba(231,196,106,0.08);
  filter:blur(100px);
  top:10%;
  left:50%;
  transform:translateX(-50%);
}

/* animated elements */
.hero-sub{
  font-size:12px;
  letter-spacing:3px;
  color:#aaa;
  margin-bottom:10px;
  opacity:0;
  transform:translateY(20px);
  animation:fadeUp 0.6s ease forwards 0.2s;
}

.hero-chef{
  font-size:11px;
  letter-spacing:2px;
  color:#e7c46a;
  margin-bottom:25px;
  opacity:0;
  transform:translateY(20px);
  animation:fadeUp 0.6s ease forwards 0.4s;
}

.hero h1{
  font-family:'Playfair Display',serif;
  font-size:64px;
  line-height:1.1;
  margin:0;
  opacity:0;
  transform:translateY(20px);
  animation:fadeUp 0.6s ease forwards 0.6s;
}

.hero span{
  color:#e7c46a;
  font-style:italic;
}

.hero p{
  color:#bbb;
  margin-top:18px;
  max-width:600px;
  margin-left:auto;
  margin-right:auto;
  opacity:0;
  transform:translateY(20px);
  animation:fadeUp 0.6s ease forwards 0.8s;
}

.hero-buttons{
  display:flex;
  justify-content:center;
  gap:12px;
  margin-top:25px;
  flex-wrap:wrap;
  opacity:0;
  transform:translateY(20px);
  animation:fadeUp 0.6s ease forwards 1s;
}

.hero-buttons button{
  padding:10px 18px;
  border:1px solid #e7c46a;
  background:transparent;
  color:#fff;
  font-size:12px;
  letter-spacing:1px;
  border-radius:6px;
  cursor:pointer;
  transition:0.3s;
}

.hero-buttons button:hover{
  background:#e7c46a;
  color:#111;
}

.order-btn{
  margin-top:30px;
  padding:14px 32px;
  background:#e7c46a;
  border:none;
  border-radius:6px;
  font-weight:600;
  letter-spacing:2px;
  cursor:pointer;
  transition:0.3s;
  opacity:0;
  transform:translateY(20px);
  animation:fadeUp 0.6s ease forwards 1.2s;
}

.order-btn:hover{
  background:#d6b45c;
}

@keyframes fadeUp{
  from{opacity:0;transform:translateY(30px);}
  to{opacity:1;transform:translateY(0);}
}
/* ======================================================= */

.products{padding:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:20px;}
.card{background:#fff;border-radius:16px;padding:16px;text-align:center;border:1px solid #eee;}
.card img{width:100px;height:100px;object-fit:contain;}
.card h4{font-family:'Playfair Display',serif;}
.size-btns{display:flex;gap:5px;margin-top:10px;}
.size-btn{flex:1;padding:6px;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-size:11px;}
.size-btn.active{background:#111;color:#fff;}
.qty{display:flex;justify-content:center;align-items:center;gap:10px;margin-top:10px;}
.qty button{width:28px;height:28px;}
.add{margin-top:10px;width:100%;padding:10px;background:#111;color:#fff;border:none;border-radius:10px;cursor:pointer;}
</style>
</head>

<body>

<div class="top-nav">
  <div class="left-nav">
    <div class="brand">
      <img src="logo.jpg" class="logo">
      <div class="brand-name">Pastry <span>Project</span></div>
    </div>

    <div class="nav-links">
      <button class="nav-btn active" data-filter="all">TODAY'S OFFER</button>
      <button class="nav-btn" data-filter="best">BEST SELLING</button>
      <button class="nav-btn" data-filter="new">WHAT'S NEW</button>
      <button class="nav-btn" data-filter="Cakes">CAKES</button>
      <button class="nav-btn" data-filter="Meals">MEALS</button>
    </div>
  </div>

  <div class="nav-right">
    <div class="header-search">
      <input type="text" id="headerSearch" placeholder="Search...">
    </div>

    <?php if(!$user): ?>
      <a href="login.php" class="btn-login">Sign In</a>
    <?php else: ?>
      <div class="user-menu">
        <div class="user-name" onclick="toggleUserMenu(event)">
          <?= $user['name'] ?> ⌄
        </div>

        <div class="dropdown" id="userDropdown">
          <a href="#" onclick="openLogout(event)">Logout</a>
        </div>

        <div id="logoutModal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);justify-content:center;align-items:center;z-index:9999;">
          <div style="background:#fff;padding:25px;border-radius:14px;width:300px;text-align:center;">
            <h3>Log out?</h3>
            <p>Are you sure?</p>
            <div style="display:flex;gap:10px;">
              <button onclick="closeLogout()">Cancel</button>
              <button onclick="confirmLogout()">Logout</button>
            </div>
          </div>
        </div>
      </div>
    <?php endif; ?>

    <a href="cart.php" class="cart-btn">
      🛒 <span id="cartCount" class="cart-badge">0</span>
    </a>
  </div>
</div>

<!-- HERO -->
<div class="hero">
  <div class="hero-sub">PASTRY PROJECT</div>
  <div class="hero-chef">BY CHEF LAWRENCE GOGUANCO</div>

  <h1>Baked Fresh,<br><span>Made with Love.</span></h1>

  <p>
    What started as a small online shop in 2016 has grown into a full bakeshop and café.
    Today, Pastry Project serves a wide selection of artisan pastries, hearty meals,
    and quality coffee — crafted with passion in every bite.
  </p>

  <div class="hero-buttons">
    <button>DINE IN</button>
    <button>TAKEOUT</button>
    <button>DELIVERY</button>
  </div>

  <button class="order-btn">ORDER NOW</button>
</div>

<div class="products">
<?php foreach($products as $p):
$image="uploads/".$p['image'];
$category=strtolower($p['category']);
?>
<div class="card" data-category="<?= $p['category'] ?>" data-id="<?= $p['id'] ?>">

<?php if(file_exists($image)): ?>
<img src="<?= $image ?>">
<?php else: ?> 🍰 <?php endif; ?>

<h4><?= $p['name'] ?></h4>

<div class="size-btns">
<?php if($category === 'meals'): ?>
<button class="size-btn active" data-price="<?= $p['slice_price'] ?>">Regular</button>
<button class="size-btn" data-price="<?= $p['small_price'] ?>">Meal</button>
<button class="size-btn" data-price="<?= $p['big_price'] ?>">Combo Meal</button>
<?php else: ?>
<button class="size-btn active" data-price="<?= $p['slice_price'] ?>">Slice</button>
<button class="size-btn" data-price="<?= $p['small_price'] ?>">Small</button>
<button class="size-btn" data-price="<?= $p['big_price'] ?>">Big</button>
<?php endif; ?>
</div>

<div class="price">₱<span><?= $p['slice_price'] ?></span></div>

<div class="qty">
<button class="minus">-</button>
<span class="count">1</span>
<button class="plus">+</button>
</div>

<button class="add">Add to Cart</button>

</div>
<?php endforeach; ?>
</div>

<script>
// SEARCH
document.getElementById('headerSearch').addEventListener('input', function(){
  const value = this.value.toLowerCase();
  document.querySelectorAll('.card').forEach(card=>{
    const name = card.querySelector('h4').innerText.toLowerCase();
    card.style.display = name.includes(value) ? 'block' : 'none';
  });
});

function toggleUserMenu(e){
  e.stopPropagation();
  const menu = document.getElementById('userDropdown');
  if(menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}
document.addEventListener('click', ()=>{
  const menu = document.getElementById('userDropdown');
  if(menu) menu.style.display='none';
});
function openLogout(e){ e.preventDefault(); document.getElementById('logoutModal').style.display='flex'; }
function closeLogout(){ document.getElementById('logoutModal').style.display='none'; }
function confirmLogout(){ window.location='logout.php'; }

// FILTER
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    document.querySelectorAll('.card').forEach(card=>{
      const cat = card.dataset.category;
      card.style.display = (filter==='all'||filter===cat)?'block':'none';
    });
  };
});

// SIZE
document.querySelectorAll('.card').forEach(card=>{
  const priceText=card.querySelector('.price span');
  card.querySelectorAll('.size-btn').forEach(btn=>{
    btn.onclick=()=>{
      card.querySelectorAll('.size-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      priceText.innerText=btn.dataset.price;
    };
  });
});

// QTY
document.querySelectorAll('.card').forEach(card=>{
  let count=1;
  const text=card.querySelector('.count');
  card.querySelector('.plus').onclick=()=>{count++;text.innerText=count;};
  card.querySelector('.minus').onclick=()=>{if(count>1){count--;text.innerText=count;}};
});

// CART COUNT
function loadCartCount(){
  fetch('cart_api.php?action=count')
    .then(res=>res.json())
    .then(data=>{
      document.getElementById('cartCount').innerText = data.count || 0;
    });
}
loadCartCount();

// FLY
function flyToCart(img){
  const cart = document.querySelector('.cart-btn');
  if(!img || !cart) return;

  const clone = img.cloneNode(true);
  const rect = img.getBoundingClientRect();
  const cartRect = cart.getBoundingClientRect();

  clone.style.position='fixed';
  clone.style.left=rect.left+'px';
  clone.style.top=rect.top+'px';
  clone.style.width='60px';
  clone.style.height='60px';
  clone.style.transition='all 0.7s ease';

  document.body.appendChild(clone);

  setTimeout(()=>{
    clone.style.left=cartRect.left+'px';
    clone.style.top=cartRect.top+'px';
    clone.style.opacity='0';
  },10);

  setTimeout(()=>clone.remove(),700);
}

// ADD TO CART
document.querySelectorAll('.card').forEach(card=>{
  card.querySelector('.add').onclick = () => {

    const loggedIn = <?= $user ? 'true':'false' ?>;

    if(!loggedIn){
      alert("Please login first before checkout");
      window.location='login.php';
      return;
    }

    const productId = card.dataset.id;
    const qty = parseInt(card.querySelector('.count').innerText);
    const size = card.querySelector('.size-btn.active').innerText.toLowerCase();
    const img = card.querySelector('img');

    fetch('cart_api.php?action=add', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        product_id: productId,
        size: size,
        quantity: qty
      })
    })
    .then(res=>res.json())
    .then(data=>{
      if(data.success){
        loadCartCount();
        if(img) flyToCart(img);
      }
    });
  };
});

// OPTIONAL: scroll to products
document.querySelector('.order-btn').onclick = () => {
  document.querySelector('.products').scrollIntoView({behavior:'smooth'});
};
</script>

</body>
</html>