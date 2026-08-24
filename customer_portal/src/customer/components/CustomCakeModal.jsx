// src/customer/components/CustomCakeModal.jsx
import React, { useState } from 'react';
import { X, ShoppingBag, Upload, ChevronDown } from 'lucide-react';

export default function CustomCakeModal({ isOpen, onClose, allCakes, onAddToCart }) {
  const [flavor, setFlavor] = useState('');
  const [tiers, setTiers] = useState(1);
  const [dedication, setDedication] = useState('');
  const [inspoFiles, setInspoFiles] = useState([]);
  const [dateTime, setDateTime] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('pickup');
  const [notes, setNotes] = useState('');
  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    setInspoFiles(prev => [...prev, ...Array.from(e.target.files)]);
  };

  const handleSubmit = () => {
    if (!flavor || !dateTime) {
      alert('Please select a flavor and date/time.');
      return;
    }
    const price = 500 * tiers;
    const order = {
      id: Date.now(),
      name: `Custom Cake - ${flavor}`,
      flavor,
      tiers,
      dedication,
      inspoFiles,
      dateTime,
      deliveryMode,
      notes,

      price,
      qty: 1,
      image: allCakes.find(c => c.name === flavor)?.image || '',
    };
    onAddToCart(order);
    onClose();
  };

  // Exclude "Cake Customization" from flavor dropdown
  const cakeOptions = allCakes.filter(c => !c.name.toLowerCase().includes('customization'));

  return (
    // FIXED: replaced `inset-0 pt-10` with `top-[var(--navbar-height,64px)] bottom-0`
    // so the overlay starts right below the navbar and never overlaps it.
    // The modal itself is clamped to the remaining viewport height.
    <div
      className="fixed left-0 right-0 bottom-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-sm p-4 font-[DM_Sans] overflow-y-auto"
      style={{ top: 'var(--navbar-height, 64px)' }}
    >
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-[550px] relative flex flex-col my-4"
        style={{ maxHeight: 'calc(100vh - var(--navbar-height, 64px) - 2rem)' }}
      >

        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors z-20">
          <X size={20} className="text-gray-500" />
        </button>

        {/* Scrollable Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <h2 className="text-2xl font-medium text-gray-900 mb-1">Customize Your Cake</h2>
          <p className="text-xs text-gray-500 mb-4">Personalized Order</p>

          {/* Flavor & Tiers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Flavor</label>
              <div className="relative">
                <select
                  value={flavor}
                  onChange={(e) => setFlavor(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#d4af37] appearance-none pr-10 cursor-pointer"
                >
                  <option value="" disabled>Choose a flavor...</option>
                  {cakeOptions.map(cake => (
                    <option key={cake.id} value={cake.name}>{cake.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">No. of Tiers</label>
              <input
                type="number"
                min="1"
                value={tiers}
                onChange={(e) => setTiers(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#d4af37]"
              />
            </div>
          </div>

          {/* Dedication */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Dedication (Optional)</label>
            <input
              type="text"
              placeholder="Message on cake..."
              value={dedication}
              onChange={(e) => setDedication(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#d4af37]"
            />
          </div>

          {/* Delivery & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Delivery</label>
              <select
                value={deliveryMode}
                onChange={(e) => setDeliveryMode(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#d4af37] cursor-pointer"
              >
                <option value="pickup">Pickup</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Date & Time</label>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#d4af37]"
              />
            </div>
          </div>



          {/* Inspiration Photos */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Inspiration Photos (Optional)</label>
            <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-3 flex items-center justify-center hover:bg-gray-50 transition-all group cursor-pointer">
              <input type="file" multiple onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              <div className="flex items-center gap-2">
                <Upload size={16} className="text-gray-400 group-hover:text-black" />
                <span className="text-xs text-gray-500">{inspoFiles.length ? `${inspoFiles.length} files selected` : 'Upload samples'}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Additional Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special requests..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#d4af37] resize-none"
            />
          </div>
        </div>

        {/* Confirm Button — sticky at bottom of modal */}
        <div className="p-6 bg-white border-t border-gray-100 flex-shrink-0">
          <button
            onClick={handleSubmit}
            className="w-full bg-[#d4af37] text-black py-3 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-yellow-400 transition-all shadow-lg"
          >
            <ShoppingBag size={16} />
            <span className="text-sm">CONFIRM & ADD • ₱{500 * tiers}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
