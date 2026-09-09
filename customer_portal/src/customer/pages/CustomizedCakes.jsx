import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { CUSTOMER_BASE, LARAVEL_BASE } from '../../services/config';
import { safeParseJson } from '../../services/api';
import { buildCustomizedCakeSubmissionPayload } from './customizedCakePayload';

export { buildCustomizedCakeSubmissionPayload };

const fallbackCakeSizes = [
  { id: 'fallback-4x2', code: '4x2', label: '4×2"', active: true },
  { id: 'fallback-6x3', code: '6x3', label: '6×3"', active: true },
  { id: 'fallback-6x5', code: '6x5', label: '6×5"', active: true },
  { id: 'fallback-8x5', code: '8x5', label: '8×5"', active: true },
  { id: 'fallback-10x5', code: '10x5', label: '10×5"', active: true },
];

const fallbackCakeFlavors = [
  { id: 'fallback-moist-chocolate', slug: 'moist-chocolate', name: 'Moist Chocolate', active: true },
  { id: 'fallback-carrot', slug: 'carrot', name: 'Carrot', active: true },
  { id: 'fallback-red-velvet', slug: 'red-velvet', name: 'Red Velvet', active: true },
];

export default function CustomizedCakes() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('Pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [cakeType, setCakeType] = useState('single');
  const [singleSizeId, setSingleSizeId] = useState('');
  const [twoTierPreset, setTwoTierPreset] = useState('standard');
  const [topFlavorId, setTopFlavorId] = useState('');
  const [bottomFlavorId, setBottomFlavorId] = useState('');
  const [occasion, setOccasion] = useState('Birthday');
  const [customTheme, setCustomTheme] = useState('');
  const [cakeColor, setCakeColor] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [addons, setAddons] = useState([]);
  const [budget, setBudget] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState(0);
  const [flavorCatalog, setFlavorCatalog] = useState([]);
  const [sizeCatalog, setSizeCatalog] = useState([]);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const [flavorsRes, sizesRes] = await Promise.all([
          fetch(`${LARAVEL_BASE}/api/customized-cakes/flavors`, { headers: { Accept: 'application/json' } }),
          fetch(`${LARAVEL_BASE}/api/customized-cakes/sizes`, { headers: { Accept: 'application/json' } }),
        ]);

        const flavorsJson = await safeParseJson(flavorsRes);
        const sizesJson = await safeParseJson(sizesRes);

        if (Array.isArray(flavorsJson?.flavors) && flavorsJson.flavors.length > 0) {
          setFlavorCatalog(flavorsJson.flavors);
        } else {
          setFlavorCatalog(fallbackCakeFlavors);
        }
        if (Array.isArray(sizesJson?.sizes) && sizesJson.sizes.length > 0) {
          setSizeCatalog(sizesJson.sizes);
        } else {
          setSizeCatalog(fallbackCakeSizes);
        }
      } catch (error) {
        console.warn('Could not load custom cake catalog:', error);
        setFlavorCatalog(fallbackCakeFlavors);
        setSizeCatalog(fallbackCakeSizes);
      }
    };

    loadCatalog();
  }, []);

  useEffect(() => {
    if (!singleSizeId && sizeCatalog.length > 0) setSingleSizeId(String(sizeCatalog[0].id));
    if (!topFlavorId && flavorCatalog.length > 0) setTopFlavorId(String(flavorCatalog[0].id));
    if (!bottomFlavorId && flavorCatalog.length > 0) setBottomFlavorId(String(flavorCatalog[0].id));
  }, [sizeCatalog, flavorCatalog, singleSizeId, topFlavorId, bottomFlavorId]);

  const sampleImages = [
    { src: '/assets/customize/customize_1.jpg', label: 'Wedding Cakes' },
    { src: '/assets/customize/customized_2.jpg', label: 'Floral Designs' },
    { src: '/assets/customize/customized_3.jpg', label: 'Valentines' },
    { src: '/assets/customize/customized_4.jpg', label: 'Mothers Day' },
    { src: '/assets/customize/cuztomized_5.jpg', label: 'Kids Themes' },
    { src: '/assets/customize/customized_6.jpg', label: 'Debut Birthday' },
  ];

  const twoTierPresets = {
    mini: { label: 'Mini two tier cake', top: '4x2', bottom: '6x3' },
    standard: { label: 'Standard two tier cake', top: '6x5', bottom: '8x5' },
    large: { label: 'Large two tier cake', top: '8x5', bottom: '10x5' },
  };

  const sizeByCode = (code) => sizeCatalog.find((size) => size.code === code);
  const selectedTwoTierPreset = twoTierPresets[twoTierPreset];
  const selectedTiers = cakeType === 'single'
    ? [{ flavor_id: topFlavorId, size_id: singleSizeId }]
    : [
        { flavor_id: topFlavorId, size_id: sizeByCode(selectedTwoTierPreset.top)?.id },
        { flavor_id: bottomFlavorId, size_id: sizeByCode(selectedTwoTierPreset.bottom)?.id },
      ];

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      if (storedUser?.id) {
        setUserId(Number(storedUser.id));
        setName(storedUser.name || storedUser.full_name || '');
        setEmail(storedUser.email || '');
        setContactNumber(storedUser.phone || storedUser.phone_number || storedUser.contact_number || '');
      }
    } catch {
      setUserId(0);
    }
  }, []);

  const handleFiles = (event) => setFiles(Array.from(event.target.files || []));
  const handleAddonChange = (addon) => setAddons((current) => current.includes(addon)
    ? current.filter((item) => item !== addon)
    : [...current, addon]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) {
      setMessage('Please log in to your customer account before sending a custom cake request.');
      navigate('/customer/login');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const payload = buildCustomizedCakeSubmissionPayload(
        {
          cakeType,
          tiers: selectedTiers,
          userId,
        },
        flavorCatalog,
        sizeCatalog
      );

      const laravelRes = await fetch(`${LARAVEL_BASE}/api/customized-cakes/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          order_id: null,
          notes: `${cakeType === 'single' ? 'Single Tier' : selectedTwoTierPreset.label}: ${selectedTiers.map((tier) => {
            const flavor = flavorCatalog.find((item) => Number(item.id) === Number(tier.flavor_id));
            const size = sizeCatalog.find((item) => Number(item.id) === Number(tier.size_id));
            return `${flavor?.name || 'Unknown flavor'} (${size?.label || 'Unknown size'})`;
          }).join(' / ')} | Budget: ${budget || 'Not specified'}`,
        }),
      });

      const laravelData = await safeParseJson(laravelRes);
      if (laravelRes.ok && laravelData?.success) {
        setMessage('Request submitted. Admin will review it within 24 hours, then send the final price and inform you whether it is accepted or declined.');
        setCakeType('single');
        setSingleSizeId(sizeCatalog[0] ? String(sizeCatalog[0].id) : '');
        setTwoTierPreset('standard');
        setTopFlavorId(flavorCatalog[0] ? String(flavorCatalog[0].id) : '');
        setBottomFlavorId(flavorCatalog[0] ? String(flavorCatalog[0].id) : '');
        setBudget('');
        return;
      }

      const fd = new FormData();
      fd.append('name', name);
      fd.append('email', email);
      fd.append('phone', contactNumber);
      fd.append('pickup_date', pickupDate);
      fd.append('pickup_time', pickupTime);
      fd.append('delivery_method', deliveryMethod);
      fd.append('delivery_address', deliveryAddress);
      fd.append('user_id', String(userId || 0));
      fd.append('cake_type', cakeType);
      fd.append('tiers', JSON.stringify(selectedTiers));
      fd.append('occasion', occasion);
      fd.append('theme', customTheme);
      fd.append('cake_color', cakeColor);
      fd.append('custom_message', customMessage);
      fd.append('special_instructions', specialInstructions);
      fd.append('addons', JSON.stringify(addons));
      fd.append('budget', budget);
      fd.append('quantity', String(quantity));
      files.forEach((file, index) => fd.append('files[]', file, file.name || `file${index}`));

      const res = await fetch(`${CUSTOMER_BASE}/api_custom_cake.php`, {
        method: 'POST',
        body: fd,
      });

      const data = await safeParseJson(res);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server returned ${res.status}`);
      }

      if (data && data.success) {
        setMessage('Request submitted. Admin will review it within 24 hours, then send the final price and inform you whether it is accepted or declined.');
        setCakeType('single');
        setSingleSizeId(sizeCatalog[0] ? String(sizeCatalog[0].id) : '');
        setTwoTierPreset('standard');
        setTopFlavorId(flavorCatalog[0] ? String(flavorCatalog[0].id) : '');
        setBottomFlavorId(flavorCatalog[0] ? String(flavorCatalog[0].id) : '');
        setBudget('');
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
    <PageShell background="bg-white" padding="px-6 md:px-10 py-8" innerClassName="max-w-5xl">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.35em] text-gray-400 mb-2">Customize</p>
          <h1 className="text-[26px] font-bold tracking-tight text-[#6b4f1d]">Customized Cakes</h1>
          <p className="mt-2 text-sm text-gray-400">Describe your cake idea and attach reference images. We'll get back with a quote.</p>
        </div>

        <div className="mb-10">
          <p className="text-[13px] font-semibold mb-3 text-[#6b4f1d]">Examples</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {sampleImages.map((item, index) => (
              <div key={index} className="relative rounded-2xl overflow-hidden group cursor-pointer shadow-sm">
                <img src={item.src} alt={item.label} className="w-full h-48 sm:h-56 object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <span className="absolute left-3 bottom-3 bg-[#ffe89a] text-[#6b4f1d] text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-md shadow">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#fffef5] border border-[#f0d98a] rounded-[20px] p-6 space-y-6 shadow-[0_18px_40px_rgba(158,116,25,0.10)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-[13px] font-semibold mb-3 text-[#6b4f1d]">Customer Information</p>
              <div className="space-y-3">
                <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Full Name" className="border border-[#f0d98a] rounded-xl bg-white px-3 py-2 w-full text-[13px] text-[#6b4f1d] focus:border-[#e5bd45] focus:outline-none" />
                <input required value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} placeholder="Contact Number" className="border border-[#f0d98a] rounded-xl bg-white px-3 py-2 w-full text-[13px] text-[#6b4f1d] focus:border-[#e5bd45] focus:outline-none" />
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email Address (optional)" type="email" className="border border-[#f0d98a] rounded-xl bg-white px-3 py-2 w-full text-[13px] text-[#6b4f1d] focus:border-[#e5bd45] focus:outline-none" />
              </div>
            </div>
            <div>
              <p className="text-[13px] font-semibold mb-3 text-[#6b4f1d]">Order Information</p>
              <div className="space-y-3">
                <input required value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} type="date" className="border rounded-md px-3 py-2 w-full text-[13px]" />
                <input required value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} type="time" className="border rounded-md px-3 py-2 w-full text-[13px]" />
                <div className="grid grid-cols-2 gap-3">
                  {['Pickup', 'Delivery'].map((option) => <button key={option} type="button" onClick={() => setDeliveryMethod(option)} className={`rounded-xl px-3 py-2 text-sm font-semibold border ${deliveryMethod === option ? 'bg-[#ffe89a] text-[#6b4f1d] border-[#e5bd45]' : 'bg-white text-[#6b4f1d] border-[#f0d98a] hover:border-[#e5bd45]'}`}>{option}</button>)}
                </div>
                {deliveryMethod === 'Delivery' && <textarea required value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Delivery Address" rows={3} className="w-full border rounded-md px-3 py-2 text-[13px]" />}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-[13px] font-semibold mb-3 text-[#6b4f1d]">Cake Details</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {['single', 'two-tier'].map((value) => <button key={value} type="button" onClick={() => setCakeType(value)} className={`rounded-xl px-3 py-2 text-sm font-semibold border ${cakeType === value ? 'bg-[#ffe89a] text-[#6b4f1d] border-[#e5bd45]' : 'bg-white text-[#6b4f1d] border-[#f0d98a] hover:border-[#e5bd45]'}`}>{value === 'single' ? 'Single Tier' : 'Two Tier'}</button>)}
                </div>
                {cakeType === 'single' ? <>
                  <p className="text-xs font-semibold text-[#7b5b3a]">Customized cake flavors</p>
                  <div className="grid grid-cols-3 gap-2">{flavorCatalog.map((flavor) => <button key={flavor.id} type="button" onClick={() => setTopFlavorId(String(flavor.id))} className={`rounded-xl border px-2 py-2 text-xs font-semibold ${topFlavorId === String(flavor.id) ? 'bg-[#ffe89a] text-[#6b4f1d] border-[#e5bd45]' : 'bg-white text-[#6b4f1d] border-[#f0d98a] hover:border-[#e5bd45]'}`}>{flavor.name}</button>)}</div>
                  <p className="text-xs font-semibold text-[#7b5b3a]">Bento cake</p>
                  <div className="grid grid-cols-2 gap-2">{sizeCatalog.map((size) => <button key={size.id} type="button" onClick={() => setSingleSizeId(String(size.id))} className={`rounded-xl px-3 py-2 text-sm font-semibold border ${singleSizeId === String(size.id) ? 'bg-[#ffe89a] text-[#6b4f1d] border-[#e5bd45]' : 'bg-white text-[#6b4f1d] border-[#f0d98a] hover:border-[#e5bd45]'}`}>{size.label}</button>)}</div>
                </> : <>
                  <p className="text-xs font-semibold text-[#7b5b3a]">Two tier cake configuration</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {Object.entries(twoTierPresets).map(([value, preset]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTwoTierPreset(value)}
                        className={`rounded-xl border px-3 py-3 text-left ${twoTierPreset === value ? 'bg-[#ffe89a] text-[#6b4f1d] border-[#e5bd45]' : 'bg-white text-[#6b4f1d] border-[#f0d98a] hover:border-[#e5bd45]'}`}
                      >
                        <span className="block text-xs font-bold">{preset.label}</span>
                        <span className={`block mt-1 text-[11px] ${twoTierPreset === value ? 'text-gray-200' : 'text-gray-500'}`}>
                          <span className="text-black">{sizeByCode(preset.top)?.label || preset.top} top / {sizeByCode(preset.bottom)?.label || preset.bottom} bottom</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#f0d98a] bg-[#fffbea] p-3">
                      <p className="text-sm font-bold text-[#6b4f1d]">Top Tier</p>
                      <p className="mt-1 mb-3 text-xs text-black">Size: {sizeByCode(selectedTwoTierPreset.top)?.label || selectedTwoTierPreset.top}</p>
                      <p className="mb-2 text-xs font-semibold text-[#7b5b3a]">Flavor</p>
                      <div className="space-y-2">
                        {flavorCatalog.map((flavor) => <button key={flavor.id} type="button" onClick={() => setTopFlavorId(String(flavor.id))} className={`w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold ${topFlavorId === String(flavor.id) ? 'bg-[#ffe89a] text-[#6b4f1d] border-[#e5bd45]' : 'bg-white text-[#6b4f1d] border-[#f0d98a] hover:border-[#e5bd45]'}`}>{flavor.name}</button>)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#f0d98a] bg-[#fffbea] p-3">
                      <p className="text-sm font-bold text-[#6b4f1d]">Bottom Tier</p>
                      <p className="mt-1 mb-3 text-xs text-black">Size: {sizeByCode(selectedTwoTierPreset.bottom)?.label || selectedTwoTierPreset.bottom}</p>
                      <p className="mb-2 text-xs font-semibold text-[#7b5b3a]">Flavor</p>
                      <div className="space-y-2">
                        {flavorCatalog.map((flavor) => <button key={flavor.id} type="button" onClick={() => setBottomFlavorId(String(flavor.id))} className={`w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold ${bottomFlavorId === String(flavor.id) ? 'bg-[#ffe89a] text-[#6b4f1d] border-[#e5bd45]' : 'bg-white text-[#6b4f1d] border-[#f0d98a] hover:border-[#e5bd45]'}`}>{flavor.name}</button>)}
                      </div>
                    </div>
                  </div>
                </>}
              </div>
            </div>
            <div>
              <p className="text-[13px] font-semibold mb-3 text-[#6b4f1d]">Customization Details</p>
              <div className="space-y-3">
                <select value={occasion} onChange={(event) => setOccasion(event.target.value)} className="border border-[#f0d98a] rounded-xl bg-white px-3 py-2 w-full text-[13px] text-[#6b4f1d] focus:border-[#e5bd45] focus:outline-none"><option>Birthday</option><option>Wedding</option><option>Anniversary</option><option>Graduation</option><option>Baby Shower</option><option>Other</option></select>
                <input value={customTheme} onChange={(event) => setCustomTheme(event.target.value)} placeholder="Theme / Design" className="border border-[#f0d98a] rounded-xl bg-white px-3 py-2 w-full text-[13px] focus:border-[#e5bd45] focus:outline-none" />
                <input value={cakeColor} onChange={(event) => setCakeColor(event.target.value)} placeholder="Preferred Cake Color(s)" className="border border-[#f0d98a] rounded-xl bg-white px-3 py-2 w-full text-[13px] focus:border-[#e5bd45] focus:outline-none" />
                <input value={customMessage} onChange={(event) => setCustomMessage(event.target.value)} placeholder="Custom Message on Cake" className="border border-[#f0d98a] rounded-xl bg-white px-3 py-2 w-full text-[13px] focus:border-[#e5bd45] focus:outline-none" />
                <textarea value={specialInstructions} onChange={(event) => setSpecialInstructions(event.target.value)} placeholder="Special Instructions / Notes" rows={5} className="w-full border border-[#f0d98a] rounded-xl bg-white px-3 py-2 text-[13px] focus:border-[#e5bd45] focus:outline-none" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-[13px] font-semibold mb-3 text-[#6b4f1d]">Add-ons</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">{['Candles', 'Cake Topper', 'Fresh Flowers', 'Extra Decorations', 'Number Candles'].map((addon) => <button key={addon} type="button" onClick={() => handleAddonChange(addon)} className={`rounded-xl px-3 py-2 text-sm font-semibold border ${addons.includes(addon) ? 'bg-[#ffe89a] text-[#6b4f1d] border-[#e5bd45]' : 'bg-white text-[#6b4f1d] border-[#f0d98a] hover:border-[#e5bd45]'}`}>{addon}</button>)}</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="min-w-0 flex-1"><label className="text-[13px] font-semibold mb-1 block text-[#6b4f1d]">Reference Image Upload</label><input type="file" multiple accept="image/*" onChange={handleFiles} className="max-w-full text-sm text-[#7b5b3a] file:mr-3 file:rounded-xl file:border-0 file:bg-[#ffe89a] file:px-4 file:py-2 file:font-semibold file:text-[#6b4f1d]" />{files.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{files.map((file, index) => <img key={index} src={URL.createObjectURL(file)} alt={file.name} className="w-full h-20 object-cover rounded-xl border border-[#f0d98a]" />)}</div>}</div>
              <div className="flex shrink-0 gap-2"><button disabled={loading || !userId} type="submit" className="px-4 py-2 bg-[#ffe89a] text-[#6b4f1d] border border-[#e5bd45] rounded-xl font-semibold transition hover:bg-[#ffedb5] disabled:opacity-50">{loading ? 'Sending...' : userId ? 'Send Request' : 'Log in to Send Request'}</button><button type="button" onClick={() => { setCakeType('single'); setSingleSizeId(sizeCatalog[0] ? String(sizeCatalog[0].id) : ''); setTwoTierPreset('standard'); setTopFlavorId(flavorCatalog[0] ? String(flavorCatalog[0].id) : ''); setBottomFlavorId(flavorCatalog[0] ? String(flavorCatalog[0].id) : ''); setAddons([]); setBudget(''); setFiles([]); setMessage(''); }} className="px-4 py-2 border border-[#f0d98a] bg-white text-[#6b4f1d] rounded-xl font-semibold hover:border-[#e5bd45]">Reset</button></div>
              {message && <div className="text-[13px] text-[#7b5b3a]">{message}</div>}
            </div>
            <div><p className="text-[13px] font-semibold mb-3 text-[#6b4f1d]">Order Summary</p><label className="block text-xs font-semibold text-[#6b4f1d] mb-1" htmlFor="custom-cake-budget">Budget</label><input id="custom-cake-budget" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Enter your budget" inputMode="decimal" className="border border-[#f0d98a] rounded-xl bg-white px-3 py-2 w-full text-[13px] mb-3 text-[#6b4f1d] focus:border-[#e5bd45] focus:outline-none" /><label className="block text-xs font-semibold text-[#6b4f1d] mb-1" htmlFor="custom-cake-quantity">Quantity</label><input id="custom-cake-quantity" value={quantity} onChange={(event) => setQuantity(Number(event.target.value) || 1)} placeholder="Enter quantity" type="number" min={1} className="border border-[#f0d98a] rounded-xl bg-white px-3 py-2 w-full text-[13px] text-[#6b4f1d] focus:border-[#e5bd45] focus:outline-none" /></div>
          </div>
        </form>
    </PageShell>
  );
}