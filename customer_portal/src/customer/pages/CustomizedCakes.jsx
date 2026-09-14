import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { CUSTOMER_BASE, LARAVEL_BASE } from '../../services/config';
import { safeParseJson } from '../../services/api';
import { buildCustomizedCakeSubmissionPayload } from './customizedCakePayload';
import {
  Baby,
  CakeSlice,
  Flower2,
  Gift,
  Heart,
  Sparkles,
} from 'lucide-react';

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
  const referenceStorageKey = 'customCakeReferenceImages';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('Pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryService, setDeliveryService] = useState('Lalamove');
  const [riderName, setRiderName] = useState('');
  const [riderContact, setRiderContact] = useState('');
  const [riderBookingReference, setRiderBookingReference] = useState('');
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
  const [referenceImage, setReferenceImage] = useState(null);
  const [filePreviewUrls, setFilePreviewUrls] = useState([]);
  const [isReferencePreviewOpen, setIsReferencePreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState(0);
  const [flavorCatalog, setFlavorCatalog] = useState([]);
  const [sizeCatalog, setSizeCatalog] = useState([]);

  useEffect(() => {
    const previews = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setFilePreviewUrls(previews);
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [files]);

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

  const featuredImagePositions = {
    'Wedding Cakes': 'center 62%',
    'Floral Designs': 'center 28%',
    Valentines: 'center 64%',
    'Mothers Day': 'center 46%',
    'Kids Themes': 'center 48%',
    'Debut Birthday': 'center 34%',
  };

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

  const handleFiles = (event) => {
    const nextFiles = Array.from(event.target.files || []).slice(0, 5);
    if (nextFiles.length === 0) return;
    window.sessionStorage.removeItem('customCakeReferenceImage');
    window.sessionStorage.removeItem(referenceStorageKey);
    const existingFiles = referenceImage?.type === 'upload' ? files : [];
    const mergedFiles = [...existingFiles, ...nextFiles].filter((file, index, allFiles) => (
      allFiles.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size) === index
    )).slice(0, 5);
    const file = mergedFiles[0];
    setFiles(mergedFiles);
    setReferenceImage({
      type: 'upload',
      id: `${file.name}-${file.size}-${file.lastModified}`,
      url: URL.createObjectURL(file),
      name: file.name,
      file,
    });
  };
  const handleAddonChange = (addon) => setAddons((current) => current.includes(addon)
    ? current.filter((item) => item !== addon)
    : [...current, addon]);

  const handleRemoveReference = (referenceId) => {
    if (referenceImage?.type === 'example' && referenceImage.id === referenceId) {
      setReferenceImage(null);
      window.sessionStorage.removeItem('customCakeReferenceImage');
      return;
    }

    const remainingFiles = files.filter((file) => `${file.name}-${file.size}-${file.lastModified}` !== referenceId);
    setFiles(remainingFiles);
    if (remainingFiles.length === 0) {
      setReferenceImage(null);
      return;
    }

    const nextFile = remainingFiles[0];
    setReferenceImage({
      type: 'upload',
      id: `${nextFile.name}-${nextFile.size}-${nextFile.lastModified}`,
      url: URL.createObjectURL(nextFile),
      name: nextFile.name,
      file: nextFile,
    });
  };

  const addGalleryReferenceImage = async (selectedReference) => {
    if (selectedReference?.type === 'example') {
      setFiles([]);
      setReferenceImage({ ...selectedReference });
      return;
    }

    try {
      const response = await fetch(selectedReference.url);
      if (!response.ok) return;

      const blob = await response.blob();
      const fileName = `${(selectedReference.name || 'reference-image').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'reference-image'}.jpg`;
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
      setFiles([file]);
      setReferenceImage({ ...selectedReference, file });
    } catch (error) {
      console.warn('Could not import gallery reference image:', error);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = window.sessionStorage.getItem('customCakeReferenceImage') || window.sessionStorage.getItem(referenceStorageKey);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const selectedReference = items[0];
      if (!selectedReference?.url && !selectedReference?.src) return;

      const hydrate = async () => {
        await addGalleryReferenceImage({
          type: 'example',
          id: selectedReference.id || selectedReference.src,
          url: selectedReference.url || selectedReference.src,
          name: selectedReference.name || selectedReference.label || 'Reference image',
        });
      };

      hydrate();
    } catch (error) {
      console.warn('Could not load gallery reference images:', error);
      window.sessionStorage.removeItem(referenceStorageKey);
    }
  }, [referenceStorageKey]);

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
          referenceImage,
        },
        flavorCatalog,
        sizeCatalog
      );

      const orderNotes = `${cakeType === 'single' ? 'Single Tier' : selectedTwoTierPreset.label}: ${selectedTiers.map((tier) => {
        const flavor = flavorCatalog.find((item) => Number(item.id) === Number(tier.flavor_id));
        const size = sizeCatalog.find((item) => Number(item.id) === Number(tier.size_id));
        return `${flavor?.name || 'Unknown flavor'} (${size?.label || 'Unknown size'})`;
      }).join(' / ')} | Budget: ${budget || 'Not specified'}${deliveryMethod === 'Delivery' ? ` | Delivery: ${deliveryService} | Rider: ${riderName || 'Not specified'} | Rider contact: ${riderContact || 'Not specified'} | Booking reference: ${riderBookingReference || 'Not specified'} | Address: ${deliveryAddress || 'Not specified'}` : ''}`;
      const laravelForm = new FormData();
      laravelForm.append('cake_type', payload.cake_type);
      laravelForm.append('user_id', String(payload.user_id || userId || 0));
      laravelForm.append('tiers', JSON.stringify(payload.tiers));
      laravelForm.append('order_id', '');
      laravelForm.append('notes', orderNotes);
      laravelForm.append('reference_image', JSON.stringify(referenceImage ? {
        type: referenceImage.type,
        id: referenceImage.id,
        url: referenceImage.url,
        name: referenceImage.name,
      } : null));
      laravelForm.append('delivery_service', deliveryService);
      laravelForm.append('rider_name', riderName);
      laravelForm.append('rider_contact', riderContact);
      laravelForm.append('rider_booking_reference', riderBookingReference);
      files.forEach((file, index) => laravelForm.append('files[]', file, file.name || `file${index}`));

      const laravelRes = await fetch(`${LARAVEL_BASE}/api/customized-cakes/order`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: laravelForm,
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
        setFiles([]);
        setReferenceImage(null);
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
      fd.append('delivery_service', deliveryService);
      fd.append('rider_name', riderName);
      fd.append('rider_contact', riderContact);
      fd.append('rider_booking_reference', riderBookingReference);
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
      fd.append('reference_image', JSON.stringify(referenceImage ? {
        type: referenceImage.type,
        id: referenceImage.id,
        url: referenceImage.url,
        name: referenceImage.name,
      } : null));
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
        setFiles([]);
        setReferenceImage(null);
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
    <PageShell background="bg-[#fbfaf5]" padding="px-4 md:px-7 lg:px-10 py-6" innerClassName="max-w-5xl">
        <section className="relative mb-5 min-h-[230px] overflow-hidden rounded-2xl border border-[#eadfd8] bg-[#fffaf0] shadow-[0_8px_22px_rgba(91,64,39,0.05)] sm:min-h-[260px]">
          <div className="absolute inset-y-0 right-0 w-full sm:w-[56%]"><img src="/assets/customize/customize_1.jpg" alt="Floral custom cake" className="h-full w-full object-cover opacity-90" /><div className="absolute inset-0 bg-gradient-to-r from-[#fffaf0] via-[#fffaf0]/75 to-transparent" /></div>
          <div className="relative z-10 flex min-h-[230px] max-w-[430px] flex-col justify-center px-6 py-8 sm:min-h-[260px] sm:px-8">
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#9b7b3d]">Customize</p>
            <h1 className="mt-2 font-serif text-3xl font-bold leading-[0.98] tracking-tight text-[#33251e] sm:text-4xl">Customize Your <span className="text-[#c9972d]">Dream Cake</span></h1>
            <p className="mt-3 max-w-[300px] text-xs leading-5 text-[#765f3d]">Tell us what you have in mind, and our bakers will turn your idea into reality.</p>
            <button type="button" onClick={() => document.getElementById('custom-cake-request-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-[#e7c875] px-5 py-2.5 text-[10px] font-bold text-[#33251e] transition hover:bg-[#d9b354]">Start Customizing <span aria-hidden="true">→</span></button>
          </div>
        </section>

        <div className="mb-8 grid grid-cols-2 gap-2 rounded-2xl border border-[#eadfd8] bg-white p-2 shadow-[0_5px_18px_rgba(91,64,39,0.04)] sm:grid-cols-3 md:grid-cols-6 md:gap-3">
          {[
            ['Birthday', CakeSlice, '/customer/birthday-designs'],
            ['Cutesy', Sparkles, '/customer/cutesy-designs'],
            ['Holidays', Gift, '/customer/holiday-designs'],
            ['Kids Themes', Baby, '/customer/kids-designs'],
            ['Wedding', Heart, '/customer/wedding-designs'],
            ['Floral Designs', Flower2, '/customer/floral-designs'],
          ].map(([label, Icon, path]) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(path)}
              className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-[#eee4de] bg-white px-2 py-3 text-center text-[#5f514a] transition hover:-translate-y-0.5 hover:border-[#e7c875] hover:bg-[#fff8df] hover:text-[#8d6a2e]"
            >
              <Icon size={22} strokeWidth={1.6} className="shrink-0" />
              <span className="w-full text-[10px] font-semibold leading-tight break-words">{label}</span>
            </button>
          ))}
        </div>

        <div className="mb-10">
          <div className="mb-4 flex items-end justify-between px-1"><div><p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#9b7b3d]">Get inspired</p><h2 className="mt-1 font-serif text-2xl font-bold text-[#33251e]">Featured Designs</h2><p className="mt-1 text-xs text-[#9b8c83]">Get inspired by our most loved cake designs.</p></div><span className="hidden rounded-full border border-[#e7c875] px-4 py-2 text-[10px] font-bold text-[#8d6a2e] sm:inline-flex">View All <span className="ml-1">→</span></span></div>
          <div className="mx-auto grid w-full max-w-[880px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sampleImages.map((item, index) => (
              <article key={index} className="group relative h-44 overflow-hidden rounded-[14px] border border-[#eadfd8] bg-[#f8eee8] shadow-[0_6px_16px_rgba(91,64,39,0.06)] sm:h-48">
                <img src={item.src} alt={item.label} style={{ objectPosition: featuredImagePositions[item.label] }} className="block h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <span className="absolute bottom-2.5 left-2.5 rounded-md bg-white px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#8d6a2e]">{item.label}</span>
                <button type="button" onClick={() => addGalleryReferenceImage({ type: 'example', id: `featured-${index + 1}`, url: item.src, name: item.label })} className={`absolute bottom-2.5 right-2.5 rounded-md px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.08em] transition ${referenceImage?.id === `featured-${index + 1}` ? 'bg-[#6f9d67] text-white opacity-100' : 'bg-[#fff8df] text-[#8d6a2e] opacity-0 group-hover:opacity-100 focus:opacity-100'}`}>{referenceImage?.id === `featured-${index + 1}` ? '✓ Using as Reference' : 'Use as Reference'}</button>
              </article>
            ))}
          </div>
        </div>

        <form id="custom-cake-request-form" onSubmit={handleSubmit} className="rounded-[14px] border border-[#eadfd8] bg-white p-4 space-y-5 shadow-[0_8px_22px_rgba(91,64,39,0.05)] sm:p-5">
          <div className="border-b border-[#f0e6dc] pb-3">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#9b7b3d]">Your custom order</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-[#33251e]">Cake Customization Details</h2>
            <p className="mt-1 text-[11px] text-[#9b8c83]">Tell us what you have in mind and we’ll make it happen.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:block lg:columns-2 lg:[column-gap:1rem]">
          <div className="grid grid-cols-1 items-start gap-4 lg:contents">
            <div className="self-start break-inside-avoid rounded-xl border border-[#f0e6dc] bg-[#fffdf9] p-4 lg:mb-4">
              <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#6b4f1d]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff3c8] text-[11px]">1</span> Customer Information</p>
              <div className="space-y-3">
                <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Full Name" className="w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-[13px] text-[#6b4f1d] outline-none transition focus:border-[#e5bd45] focus:ring-2 focus:ring-[#fff1bd]" />
                <input required value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} placeholder="Contact Number" className="w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-[13px] text-[#6b4f1d] outline-none transition focus:border-[#e5bd45] focus:ring-2 focus:ring-[#fff1bd]" />
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email Address (optional)" type="email" className="w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-[13px] text-[#6b4f1d] outline-none transition focus:border-[#e5bd45] focus:ring-2 focus:ring-[#fff1bd]" />
              </div>
            </div>
            <div className="break-inside-avoid rounded-xl border border-[#f0e6dc] bg-[#fffdf9] p-4 lg:mb-4">
              <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#6b4f1d]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff3c8] text-[11px]">2</span> Order Information</p>
              <div className="space-y-3">
                <label className="block text-[11px] font-semibold text-[#6b4f1d]">Pickup date<input required value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} type="date" className="mt-1 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-[13px] text-[#6b4f1d] outline-none transition focus:border-[#e5bd45] focus:ring-2 focus:ring-[#fff1bd]" /></label>
                <label className="block text-[11px] font-semibold text-[#6b4f1d]">Pickup time<input required value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} type="time" className="mt-1 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-[13px] text-[#6b4f1d] outline-none transition focus:border-[#e5bd45] focus:ring-2 focus:ring-[#fff1bd]" /></label>
                <div className="grid grid-cols-2 gap-3">
                  {['Pickup', 'Delivery'].map((option) => <button key={option} type="button" onClick={() => setDeliveryMethod(option)} className={`rounded-xl px-3 py-2 text-sm font-semibold border ${deliveryMethod === option ? 'bg-[#ffe89a] text-[#6b4f1d] border-[#e5bd45]' : 'bg-white text-[#6b4f1d] border-[#f0d98a] hover:border-[#e5bd45]'}`}>{option}</button>)}
                </div>
                {deliveryMethod === 'Delivery' && <div className="space-y-3 rounded-lg border border-[#f0e6dc] bg-[#fffaf0] p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="text-[11px] font-semibold text-[#6b4f1d]">Rider service<select value={deliveryService} onChange={(event) => setDeliveryService(event.target.value)} className="mt-1 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-[12px] font-normal text-[#6b4f1d] outline-none focus:border-[#e5bd45]"><option value="Lalamove">Lalamove</option><option value="GrabCar">GrabCar</option></select></label>
                    <label className="text-[11px] font-semibold text-[#6b4f1d]">Rider name<input required value={riderName} onChange={(event) => setRiderName(event.target.value)} placeholder="Enter rider name" className="mt-1 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-[12px] font-normal text-[#6b4f1d] outline-none focus:border-[#e5bd45]" /></label>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="text-[11px] font-semibold text-[#6b4f1d]">Rider contact<input required value={riderContact} onChange={(event) => setRiderContact(event.target.value)} placeholder="09XX XXX XXXX" className="mt-1 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-[12px] font-normal text-[#6b4f1d] outline-none focus:border-[#e5bd45]" /></label>
                    <label className="text-[11px] font-semibold text-[#6b4f1d]">Booking/reference no. <input value={riderBookingReference} onChange={(event) => setRiderBookingReference(event.target.value)} placeholder="Optional booking number" className="mt-1 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-[12px] font-normal text-[#6b4f1d] outline-none focus:border-[#e5bd45]" /></label>
                  </div>
                  <textarea required value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Delivery Address" rows={2} className="w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-[12px] text-[#6b4f1d] outline-none focus:border-[#e5bd45]" />
                </div>}
              </div>
            </div>
            <div className="break-inside-avoid rounded-xl border border-[#f0e6dc] bg-[#fffdf9] p-4 lg:mb-4">
              <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#6b4f1d]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff3c8] text-[11px]">5</span> Add-ons</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{['Candles', 'Cake Topper', 'Fresh Flowers', 'Extra Decorations', 'Number Candles'].map((addon) => <button key={addon} type="button" onClick={() => handleAddonChange(addon)} className={`flex h-10 items-center justify-start overflow-hidden rounded-xl border px-3 text-left text-[11px] font-semibold leading-tight transition ${addons.includes(addon) ? 'bg-[#ffe89a] text-[#6b4f1d] border-[#e5bd45]' : 'bg-white text-[#6b4f1d] border-[#f0d98a] hover:border-[#e5bd45] hover:bg-[#fffaf0]'}`}>{addon}</button>)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:contents">
            <div className="break-inside-avoid rounded-xl border border-[#f0e6dc] bg-[#fffdf9] p-4 lg:mb-4">
              <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#6b4f1d]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff3c8] text-[11px]">3</span> Cake Details</p>
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
            <div className="break-inside-avoid rounded-xl border border-[#f0e6dc] bg-[#fffdf9] p-4 lg:mb-4">
              <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#6b4f1d]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff3c8] text-[11px]">4</span> Customization Details</p>
              <div className="space-y-3">
                <select value={occasion} onChange={(event) => setOccasion(event.target.value)} className="border border-[#f0d98a] rounded-xl bg-white px-3 py-2 w-full text-[13px] text-[#6b4f1d] focus:border-[#e5bd45] focus:outline-none"><option>Birthday</option><option>Wedding</option><option>Anniversary</option><option>Graduation</option><option>Baby Shower</option><option>Other</option></select>
                <input value={customTheme} onChange={(event) => setCustomTheme(event.target.value)} placeholder="Theme / Design" className="border border-[#f0d98a] rounded-xl bg-white px-3 py-2 w-full text-[13px] focus:border-[#e5bd45] focus:outline-none" />
                <input value={cakeColor} onChange={(event) => setCakeColor(event.target.value)} placeholder="Preferred Cake Color(s)" className="border border-[#f0d98a] rounded-xl bg-white px-3 py-2 w-full text-[13px] focus:border-[#e5bd45] focus:outline-none" />
                <input value={customMessage} onChange={(event) => setCustomMessage(event.target.value)} placeholder="Custom Message on Cake" className="border border-[#f0d98a] rounded-xl bg-white px-3 py-2 w-full text-[13px] focus:border-[#e5bd45] focus:outline-none" />
                <textarea value={specialInstructions} onChange={(event) => setSpecialInstructions(event.target.value)} placeholder="Special Instructions / Notes" rows={5} className="w-full border border-[#f0d98a] rounded-xl bg-white px-3 py-2 text-[13px] focus:border-[#e5bd45] focus:outline-none" />
              </div>
            </div>
          </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-xl border border-[#f0e6dc] bg-[#fffdf9] p-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1"><label className="mb-1 block text-[13px] font-bold text-[#6b4f1d]">Reference Images</label><p className="mb-2 text-[11px] text-[#9b8c83]">Add an example or upload up to 5 images.</p><input id="custom-cake-reference-files" type="file" multiple accept="image/*" onChange={handleFiles} className="sr-only" /><div className="flex flex-wrap items-center gap-2"><label htmlFor="custom-cake-reference-files" className="inline-flex cursor-pointer rounded-lg border border-[#e5bd45] bg-[#ffe89a] px-4 py-2 text-[12px] font-bold text-[#6b4f1d] transition hover:bg-[#ffedb5]">Choose Images</label>{!referenceImage && <div className="w-fit min-w-[180px] rounded-lg border border-dashed border-[#eadfd8] bg-white px-3 py-2 text-xs text-[#9b8060]">No reference selected</div>}</div>{referenceImage && (
                <div className="mt-3 space-y-2">
                  <div className="inline-flex rounded-full border border-[#e5bd45] bg-[#fff8df] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8d6a2e]">
                    {referenceImage.type === 'example' ? 'Example reference' : `${files.length} uploaded reference${files.length === 1 ? '' : 's'}`}: {referenceImage.name}
                  </div>
                  <div className="grid max-w-sm grid-cols-3 gap-2">{(filePreviewUrls.length > 0 ? filePreviewUrls : [{ id: referenceImage.id, name: referenceImage.name, url: referenceImage.url }]).map((preview) => <div key={preview.id} className="group relative overflow-hidden rounded-lg border border-[#eadfd8] bg-white"><button type="button" onClick={() => { const file = files.find((item) => `${item.name}-${item.size}-${item.lastModified}` === preview.id); setReferenceImage({ type: file ? 'upload' : 'example', id: preview.id, url: preview.url, name: preview.name, file }); setIsReferencePreviewOpen(true); }} className="block w-full"><img src={preview.url} alt={preview.name} className="h-20 w-full object-cover transition group-hover:opacity-80" /><span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-1 text-[8px] text-white">View full</span></button><button type="button" onClick={() => handleRemoveReference(preview.id)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-[#6b4f1d] shadow" aria-label={`Remove ${preview.name}`}>×</button></div>)}</div>
                  <div className="flex flex-wrap gap-3"><button type="button" onClick={() => { setFiles([]); setReferenceImage(null); window.sessionStorage.removeItem('customCakeReferenceImage'); }} className="text-xs font-bold text-[#8d6a2e] underline">Change Reference</button><button type="button" onClick={() => navigate('/customer/birthday-designs')} className="text-xs font-bold text-[#8d6a2e] underline">Browse Examples</button></div>
                </div>
              )}{!userId && <button type="button" onClick={() => navigate('/customer/login')} className="mt-3 rounded-xl border border-[#e5bd45] bg-[#ffe89a] px-4 py-2 text-sm font-semibold text-[#6b4f1d] transition hover:bg-[#ffedb5]">Log in to Send Request</button>}<button type="button" onClick={() => { setCakeType('single'); setSingleSizeId(sizeCatalog[0] ? String(sizeCatalog[0].id) : ''); setTwoTierPreset('standard'); setTopFlavorId(flavorCatalog[0] ? String(flavorCatalog[0].id) : ''); setBottomFlavorId(flavorCatalog[0] ? String(flavorCatalog[0].id) : ''); setAddons([]); setBudget(''); setFiles([]); setReferenceImage(null); setMessage(''); }} className="mt-3 ml-2 px-4 py-2 border border-[#f0d98a] bg-white text-[#6b4f1d] rounded-xl font-semibold hover:border-[#e5bd45]">Reset</button></div>
              <div className="flex shrink-0 gap-2">{userId > 0 && <button disabled={loading} type="submit" className="px-4 py-2 bg-[#ffe89a] text-[#6b4f1d] border border-[#e5bd45] rounded-xl font-semibold transition hover:bg-[#ffedb5] disabled:opacity-50">{loading ? 'Sending...' : 'Send Request'}</button>}</div>
              {message && <div className="text-[13px] text-[#7b5b3a]">{message}</div>}
            </div>
            <div className="rounded-xl border border-[#f0e6dc] bg-[#fffdf9] p-4"><p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#6b4f1d]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff3c8] text-[11px]">6</span> Order Summary</p><label className="mb-1 block text-xs font-semibold text-[#6b4f1d]" htmlFor="custom-cake-budget">Budget</label><input id="custom-cake-budget" value={budget} onChange={(event) => setBudget(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter budget (up to 6 digits)" type="text" inputMode="numeric" maxLength={6} pattern="[0-9]{0,6}" className="mb-3 block w-full max-w-[320px] rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-[13px] text-[#6b4f1d] outline-none focus:border-[#e5bd45] focus:ring-2 focus:ring-[#fff1bd]" /><label className="mb-1 block text-xs font-semibold text-[#6b4f1d]" htmlFor="custom-cake-quantity">Quantity</label><input id="custom-cake-quantity" value={quantity} onChange={(event) => setQuantity(Number(event.target.value) || 1)} placeholder="Enter quantity" type="number" min={1} className="block w-full max-w-[320px] rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-[13px] text-[#6b4f1d] outline-none focus:border-[#e5bd45] focus:ring-2 focus:ring-[#fff1bd]" /></div>
          </div>
        </form>
        {isReferencePreviewOpen && referenceImage && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#1f1a17]/75 px-4 pb-20 pt-20 backdrop-blur-sm md:pt-24" role="dialog" aria-modal="true" aria-label="Reference image preview" onClick={() => setIsReferencePreviewOpen(false)}>
            <div className="w-full max-w-2xl rounded-2xl border border-[#eadfd8] bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between px-1 pb-2">
                <p className="truncate pr-3 text-xs font-semibold text-[#6b4f1d]">{referenceImage.name}</p>
                <button type="button" onClick={() => setIsReferencePreviewOpen(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff8df] text-xl font-bold leading-none text-[#6b4f1d] hover:bg-[#ffe89a]" aria-label="Close image preview">×</button>
              </div>
              <img src={referenceImage.url} alt={referenceImage.name} className="max-h-[65vh] w-full rounded-xl border border-[#f0d98a] bg-[#fbfaf5] object-contain" />
            </div>
          </div>
        )}
    </PageShell>
  );
}