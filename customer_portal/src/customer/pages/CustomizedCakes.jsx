import React, { useEffect, useState } from 'react';
import PageShell from '../components/PageShell';
import { CUSTOMER_BASE } from '../../services/config';
import { useNavigate } from 'react-router-dom';
import { safeParseJson } from '../../services/api';

export default function CustomizedCakes() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('Pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [cakeSize, setCakeSize] = useState('6 inches');
  const [customCakeSize, setCustomCakeSize] = useState('');
  const [servings, setServings] = useState('1');
  const [cakeFlavor, setCakeFlavor] = useState('Chocolate');
  const [fillingFlavor, setFillingFlavor] = useState('Chocolate Ganache');
  const [frostingType, setFrostingType] = useState('Buttercream');
  const [occasion, setOccasion] = useState('Birthday');
  const [customTheme, setCustomTheme] = useState('');
  const [cakeColor, setCakeColor] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [addons, setAddons] = useState([]);
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [details, setDetails] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState(0);

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      if (storedUser?.id) {
        setUserId(Number(storedUser.id));
        setName(storedUser.name || '');
        setEmail(storedUser.email || '');
        setContactNumber(storedUser.phone || '');
      }
    } catch {
      setUserId(0);
    }
  }, []);

  const sampleImages = [
    { src: '/assets/customize/customize_1.jpg', label: 'Wedding Cakes' },
    { src: '/assets/customize/customized_2.jpg', label: 'Floral Designs' },
    { src: '/assets/customize/customized_3.jpg', label: 'Valentines' },
    { src: '/assets/customize/customized_4.jpg', label: 'Mothers Day' },
    { src: '/assets/customize/cuztomized_5.jpg', label: 'Kids Themes' },
    { src: '/assets/customize/customized_6.jpg', label: 'Debut Birthday' },
  ];

  const handleFiles = (evt) => {
    const list = Array.from(evt.target.files || []);
    setFiles(list);
  };

  const handleAddonChange = (addon) => {
    setAddons((prev) =>
      prev.includes(addon)
        ? prev.filter((item) => item !== addon)
        : [...prev, addon]
    );
  };

  const totalAmount = Number(estimatedPrice || 0) * Number(quantity || 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('email', email);
      fd.append('phone', contactNumber);
      fd.append('pickup_date', pickupDate);
      fd.append('pickup_time', pickupTime);
      fd.append('delivery_method', deliveryMethod);
      fd.append('delivery_address', deliveryAddress);
      fd.append('cake_size', cakeSize === 'Custom Size' ? customCakeSize : cakeSize);
      fd.append('servings', servings);
      fd.append('cake_flavor', cakeFlavor);
      fd.append('filling_flavor', fillingFlavor);
      fd.append('frosting_type', frostingType);
      fd.append('occasion', occasion);
      fd.append('theme', customTheme);
      fd.append('cake_color', cakeColor);
      fd.append('custom_message', customMessage);
      fd.append('special_instructions', specialInstructions);
      fd.append('addons', JSON.stringify(addons));
      fd.append('estimated_price', estimatedPrice);
      fd.append('quantity', quantity);
      fd.append('total_amount', totalAmount);
      fd.append('details', details);
      fd.append('user_id', String(userId || 0));
      files.forEach((f, i) => fd.append('files[]', f, f.name || `file${i}`));

      const res = await fetch(`${CUSTOMER_BASE}/api_custom_cake.php`, {
        method: 'POST',
        body: fd,
      });

      let data = await safeParseJson(res);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server returned ${res.status}`);
      }

      // The response has already been parsed safely.

      if (data && data.success) {
        setMessage('Request sent. We will contact you soon.');
        setName('');
        setEmail('');
        setContactNumber('');
        setPickupDate('');
        setPickupTime('');
        setDeliveryMethod('Pickup');
        setDeliveryAddress('');
        setCakeSize('6 inches');
        setCustomCakeSize('');
        setServings('1');
        setCakeFlavor('Chocolate');
        setFillingFlavor('Chocolate Ganache');
        setFrostingType('Buttercream');
        setOccasion('Birthday');
        setCustomTheme('');
        setCakeColor('');
        setCustomMessage('');
        setSpecialInstructions('');
        setAddons([]);
        setEstimatedPrice('');
        setQuantity(1);
        setDetails('');
        setFiles([]);
        setTimeout(() => navigate('/customer/menu'), 1200);
      } else {
        setMessage(data?.message || 'Failed to send request. Please try again.');
      }
    } catch (err) {
      console.error('Customize submit error:', err);
      setMessage(err?.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell background="bg-[#F5F6FA]" padding="px-6 md:px-10 py-8" innerClassName="max-w-5xl">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.35em] text-gray-400 mb-2">Customize</p>
          <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Customized Cakes</h1>
          <p className="mt-2 text-sm text-gray-400">Describe your cake idea and attach reference images. We'll get back with a quote.</p>
        </div>

        {/* Gallery */}
        <div className="mb-10">
          <p className="text-[13px] font-semibold mb-3 text-slate-900">Examples</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {sampleImages.map((item, i) => (
              <div
                key={i}
                className="relative rounded-2xl overflow-hidden group cursor-pointer shadow-sm"
              >
                <img
                  src={item.src}
                  alt={item.label}
                  className="w-full h-48 sm:h-56 object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <span className="absolute left-3 bottom-3 bg-[#fdeec2] text-black text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-md shadow">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white border rounded-[16px] p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-[13px] font-semibold mb-3 text-slate-900">Customer Information</p>
              <div className="space-y-3">
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" className="border rounded-md px-3 py-2 w-full text-[13px]" />
                <input required value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="Contact Number" className="border rounded-md px-3 py-2 w-full text-[13px]" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address (optional)" type="email" className="border rounded-md px-3 py-2 w-full text-[13px]" />
              </div>
            </div>

            <div>
              <p className="text-[13px] font-semibold mb-3 text-slate-900">Order Information</p>
              <div className="space-y-3">
                <input required value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} type="date" className="border rounded-md px-3 py-2 w-full text-[13px]" />
                <input required value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} type="time" className="border rounded-md px-3 py-2 w-full text-[13px]" />
                <div className="grid grid-cols-2 gap-3">
                  {['Pickup', 'Delivery'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDeliveryMethod(option)}
                      className={`rounded-md px-3 py-2 text-sm font-semibold border ${deliveryMethod === option ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {deliveryMethod === 'Delivery' && (
                  <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Delivery Address" rows={3} className="w-full border rounded-md px-3 py-2 text-[13px]" required />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-[13px] font-semibold mb-3 text-slate-900">Cake Details</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {['6 inches', '8 inches', '10 inches', 'Custom Size'].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setCakeSize(size)}
                      className={`rounded-md px-3 py-2 text-sm font-semibold border ${cakeSize === size ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {cakeSize === 'Custom Size' && (
                  <input value={customCakeSize} onChange={(e) => setCustomCakeSize(e.target.value)} placeholder="Enter custom size" className="border rounded-md px-3 py-2 w-full text-[13px]" required />
                )}
                <input value={servings} onChange={(e) => setServings(e.target.value)} placeholder="Number of Servings" type="number" min={1} className="border rounded-md px-3 py-2 w-full text-[13px]" />
                <select value={cakeFlavor} onChange={(e) => setCakeFlavor(e.target.value)} className="border rounded-md px-3 py-2 w-full text-[13px]">
                  {['Chocolate', 'Vanilla', 'Red Velvet', 'Mocha', 'Strawberry', 'Others'].map((flavor) => (
                    <option key={flavor} value={flavor}>{flavor}</option>
                  ))}
                </select>
                <select value={fillingFlavor} onChange={(e) => setFillingFlavor(e.target.value)} className="border rounded-md px-3 py-2 w-full text-[13px]">
                  {['Chocolate Ganache', 'Buttercream', 'Strawberry Filling', 'Custard', 'Others'].map((filling) => (
                    <option key={filling} value={filling}>{filling}</option>
                  ))}
                </select>
                <select value={frostingType} onChange={(e) => setFrostingType(e.target.value)} className="border rounded-md px-3 py-2 w-full text-[13px]">
                  {['Buttercream', 'Whipped Cream', 'Fondant'].map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="text-[13px] font-semibold mb-3 text-slate-900">Customization Details</p>
              <div className="space-y-3">
                <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className="border rounded-md px-3 py-2 w-full text-[13px]">
                  {['Birthday', 'Wedding', 'Anniversary', 'Graduation', 'Baby Shower', 'Other'].map((occ) => (
                    <option key={occ} value={occ}>{occ}</option>
                  ))}
                </select>
                <input value={customTheme} onChange={(e) => setCustomTheme(e.target.value)} placeholder="Theme / Design" className="border rounded-md px-3 py-2 w-full text-[13px]" />
                <input value={cakeColor} onChange={(e) => setCakeColor(e.target.value)} placeholder="Preferred Cake Color(s)" className="border rounded-md px-3 py-2 w-full text-[13px]" />
                <input value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} placeholder="Custom Message on Cake" className="border rounded-md px-3 py-2 w-full text-[13px]" />
                <textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} placeholder="Special Instructions / Notes" rows={3} className="w-full border rounded-md px-3 py-2 text-[13px]" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-[13px] font-semibold mb-3 text-slate-900">Add-ons</p>
              <div className="grid grid-cols-2 gap-3">
                {['Candles', 'Cake Topper', 'Fresh Flowers', 'Extra Decorations', 'Number Candles'].map((addon) => (
                  <button
                    key={addon}
                    type="button"
                    onClick={() => handleAddonChange(addon)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold border ${addons.includes(addon) ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300'}`}
                  >
                    {addon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[13px] font-semibold mb-3 text-slate-900">Order Summary</p>
              <div className="space-y-3">
                <input value={estimatedPrice} onChange={(e) => setEstimatedPrice(e.target.value)} placeholder="Estimated Price" type="number" min={0} className="border rounded-md px-3 py-2 w-full text-[13px]" />
                <input value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} placeholder="Quantity" type="number" min={1} className="border rounded-md px-3 py-2 w-full text-[13px]" />
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Estimated Price</span>
                    <span>₱{Number(estimatedPrice || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 mt-2">
                    <span>Quantity</span>
                    <span>{quantity}</span>
                  </div>
                  <div className="border-t border-gray-200 mt-3 pt-3 flex justify-between text-sm font-semibold">
                    <span>Total Amount</span>
                    <span>₱{Number(totalAmount).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[13px] font-semibold mb-1 block text-slate-900">Reference Image Upload</label>
            <input type="file" multiple accept="image/*" onChange={handleFiles} />
            {files.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {files.map((f, i) => (
                  <div key={i} className="border rounded overflow-hidden">
                    <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-20 object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button disabled={loading} type="submit" className="px-4 py-2 bg-black text-white rounded-md">{loading ? 'Sending…' : 'Send Request'}</button>
            <button type="button" onClick={() => {
              setName(''); setEmail(''); setContactNumber(''); setPickupDate(''); setPickupTime(''); setDeliveryMethod('Pickup'); setDeliveryAddress(''); setCakeSize('6 inches'); setCustomCakeSize(''); setServings('1'); setCakeFlavor('Chocolate'); setFillingFlavor('Chocolate Ganache'); setFrostingType('Buttercream'); setOccasion('Birthday'); setCustomTheme(''); setCakeColor(''); setCustomMessage(''); setSpecialInstructions(''); setAddons([]); setEstimatedPrice(''); setQuantity(1); setDetails(''); setFiles([]);
            }} className="px-4 py-2 border rounded-md">Reset</button>
            {message && <div className="text-[13px] text-gray-600 ml-3">{message}</div>}
          </div>
        </form>
    </PageShell>
  );
}