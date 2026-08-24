import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ShoppingCart, Bell, User, Search, Minus, Plus } from 'lucide-react';

/**
 * Pastry Project Dashboard - React Implementation
 * Features: Category filtering, real-time search, Fly-to-Cart animation, and responsive design.
 */

const App = () => {
  const [products, setProducts] = useState([]);
  const [activeCat, setActiveCat] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  
  const cartIconRef = useRef(null);
  const badgeRef = useRef(null);

  // Initialize data
  useEffect(() => {
    // Replace URL with your actual PHP API endpoint
    fetch('api_products.php?action=list')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        if (data.length > 0) {
          const uniqueCats = [...new Set(data.map(p => p.category))];
          setActiveCat(uniqueCats[0]);
        }
      })
      .catch(err => console.error("Error fetching products:", err));
  }, []);

  // Derived data
  const categories = useMemo(() => [...new Set(products.map(p => p.category))], [products]);
  
  const filteredProducts = products.filter(p => {
    const matchesCat = p.category === activeCat;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleAddToCart = (product, size, qty, sourceElement) => {
    // API Call to update backend state
    fetch('api_products.php?action=add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: product.id, size, quantity: qty })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setCartCount(prev => prev + qty);
        triggerFlyAnimation(sourceElement);
      }
    });
  };

  const triggerFlyAnimation = (sourceEl) => {
    if (!sourceEl || !cartIconRef.current) return;

    const clone = sourceEl.cloneNode(true);
    const srcRect = sourceEl.getBoundingClientRect();
    const destRect = cartIconRef.current.getBoundingClientRect();

    // Setup initial style for clone
    Object.assign(clone.style, {
      position: 'fixed',
      left: `${srcRect.left}px`,
      top: `${srcRect.top}px`,
      width: `${srcRect.width}px`,
      height: `${srcRect.height}px`,
      zIndex: '10000',
      transition: 'all 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: 'none',
      borderRadius: '10px',
      objectFit: 'contain'
    });

    document.body.appendChild(clone);

    // Animate to destination
    requestAnimationFrame(() => {
      Object.assign(clone.style, {
        left: `${destRect.left + destRect.width / 2 - 30}px`,
        top: `${destRect.top + destRect.height / 2 - 30}px`,
        width: '40px',
        height: '40px',
        opacity: '0.5',
        transform: 'scale(0.2)'
      });
    });

    // Cleanup and trigger "pop" animations
    setTimeout(() => {
      clone.remove();
      cartIconRef.current.classList.add('animate-cartPop');
      badgeRef.current.classList.add('animate-badgeBump');
      
      setTimeout(() => {
        cartIconRef.current.classList.remove('animate-cartPop');
        badgeRef.current.classList.remove('animate-badgeBump');
      }, 450);
    }, 650);
  };

  return (
    <div className="min-h-screen bg-[#f4f4f4] font-sans text-[#111]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;700&display=swap');
        
        .font-playfair { font-family: 'Playfair Display', serif; }
        .font-dm { font-family: 'DM Sans', sans-serif; }

        @keyframes heroFadeUp {
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-hero { opacity: 0; transform: translateY(40px); animation: heroFadeUp 1s ease forwards; }
        .delay-1 { animation-delay: 0.2s; }
        .delay-2 { animation-delay: 0.4s; }
        .delay-3 { animation-delay: 0.6s; }
        
        @keyframes cartPop {
          0% { transform: scale(1); }
          30% { transform: scale(1.35); }
          60% { transform: scale(0.88); }
          100% { transform: scale(1); }
        }
        .animate-cartPop { animation: cartPop 0.45s ease forwards; }

        @keyframes badgeBump {
          0% { transform: scale(1); }
          40% { transform: scale(1.5); }
          100% { transform: scale(1); }
        }
        .animate-badgeBump { animation: badgeBump 0.4s ease forwards; }
      `}</style>

      {/* NAVIGATION */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-[#e7c46a] font-bold">P</div>
            <h1 className="text-xl font-bold font-playfair tracking-tight">
              Pastry <span className="text-[#e7c46a]">Project</span>
            </h1>
          </div>
          <div className="hidden md:flex gap-6">
            {['DASHBOARD', 'PRODUCTS', 'ORDERS'].map(link => (
              <a key={link} href="#" className={`text-[11px] font-bold tracking-widest ${link === 'DASHBOARD' ? 'text-black border-b-2 border-[#e7c46a]' : 'text-gray-400'}`}>
                {link}
              </a>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group hidden sm:block">
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-4 pr-10 py-2 text-sm border border-gray-300 rounded-full outline-none w-44 focus:w-64 transition-all duration-300"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
          </div>
          
          <button className="relative p-2 border border-gray-200 rounded-xl bg-white hover:bg-gray-50">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{notifCount}</span>
          </button>

          <button ref={cartIconRef} className="relative p-2 bg-black text-white rounded-xl hover:bg-gray-900 transition-transform">
            <ShoppingCart className="w-5 h-5" />
            <span ref={badgeRef} className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          </button>

          <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
            <User className="w-4 h-4" /> <span className="hidden sm:inline">Account</span>
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <header className="bg-[radial-gradient(circle_at_20%_30%,#3b3f45,#1b1e22_70%)] text-white py-24 px-6 text-center overflow-hidden">
        <div className="animate-hero">
          <p className="text-[10px] tracking-[4px] text-gray-400 mb-2 uppercase">Pastry Project</p>
          <p className="text-[11px] tracking-[2px] text-[#e7c46a] mb-6">BY CHEF LAWRENCE GOGUANCO</p>
          <h2 className="text-5xl md:text-6xl font-playfair leading-tight mb-6">
            Baked Fresh,<br />
            <span className="text-[#e7c46a] italic">Made with Love.</span>
          </h2>
          <p className="max-w-2xl mx-auto text-sm text-gray-300 leading-relaxed mb-8">
            What started as a small online shop in 2016 has grown into a full bakeshop and café.
            Today, Pastry Project serves a wide selection of artisan pastries, hearty meals,
            and quality coffee — crafted with passion in every bite.
          </p>
          <div className="flex justify-center gap-3 mb-8">
            {['DINE IN', 'TAKEOUT', 'DELIVERY'].map(opt => (
              <div key={opt} className="px-4 py-2 border border-[#e7c46a] text-[10px] rounded tracking-widest">{opt}</div>
            ))}
          </div>
          <button className="bg-[#e7c46a] text-black px-10 py-3 font-bold rounded hover:bg-[#d4b35a] transition-colors">
            ORDER NOW
          </button>
        </div>
      </header>

      {/* CATEGORIES */}
      <div className="flex gap-4 p-6 overflow-x-auto no-scrollbar">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={`px-5 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${activeCat === cat ? 'bg-black text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* PRODUCT GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
        {filteredProducts.map(product => (
          <ProductCard 
            key={product.id} 
            product={product} 
            onAdd={handleAddToCart}
          />
        ))}
        {filteredProducts.length === 0 && (
          <div className="col-span-full py-20 text-center text-gray-400 italic">
            No products found in this category.
          </div>
        )}
      </div>
    </div>
  );
};

const ProductCard = ({ product, onAdd }) => {
  const isMeal = product.category.toLowerCase().includes('meal');
  const [size, setSize] = useState(isMeal ? 'regular' : 'slice');
  const [qty, setQty] = useState(1);
  const imgRef = useRef(null);

  // Price determination logic
  const getPrice = () => {
    if (isMeal) {
      if (size === 'regular') return 209;
      if (size === 'meal') return 199;
      return 309; // Combo
    }
    return product[`${size}_price`];
  };

  const sizes = isMeal ? ['regular', 'meal', 'combo'] : ['slice', 'small', 'big'];

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-200 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
      <div className="h-32 flex items-center justify-center mb-4">
        {product.image ? (
          <img 
            ref={imgRef}
            src={`/uploads/${product.image}`} 
            alt={product.name} 
            className="h-full object-contain"
            onError={(e) => { e.target.src = "https://via.placeholder.com/100?text=🍰" }}
          />
        ) : (
          <div ref={imgRef} className="text-5xl">🍰</div>
        )}
      </div>

      <h3 className="font-bold text-sm mb-3 h-10 overflow-hidden">{product.name}</h3>

      <div className="flex gap-2 mb-4">
        {sizes.map(s => (
          <button
            key={s}
            onClick={() => setSize(s)}
            className={`text-[10px] px-3 py-1.5 border rounded-lg transition-colors capitalize ${size === s ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-300'}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="text-lg font-bold mb-4">
        ₱{getPrice().toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </div>

      <div className="flex items-center gap-4 mb-4">
        <button 
          onClick={() => setQty(Math.max(1, qty - 1))}
          className="w-8 h-8 flex items-center justify-center bg-black text-white rounded-lg hover:bg-gray-800"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-6 font-bold">{qty}</span>
        <button 
          onClick={() => setQty(qty + 1)}
          className="w-8 h-8 flex items-center justify-center bg-black text-white rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <button 
        onClick={() => onAdd(product, size, qty, imgRef.current)}
        className="w-full bg-black text-white py-3 rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors"
      >
        Add to Cart
      </button>
    </div>
  );
};

export default App;