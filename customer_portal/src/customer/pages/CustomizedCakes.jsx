import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { CUSTOMER_BASE, LARAVEL_BASE, ROOT_BASE } from '../../services/config';
import { getAuthHeaders, safeParseJson } from '../../services/api';
import { buildCustomizedCakeSubmissionPayload, buildTierSelections } from './customizedCakePayload';
import {
  Baby,
  CakeSlice,
  CalendarDays,
  Flower2,
  Gift,
  Heart,
  Sparkles,
} from 'lucide-react';

const MAX_REFERENCE_IMAGES = 5;
const CUSTOM_CAKE_DRAFT_KEY = 'customCakeRequestDraft';
const FULFILLMENT_TIME_SLOTS = Array.from({ length: 29 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 || 12;

  return {
    value: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    label: `${displayHour}:${String(minute).padStart(2, '0')} ${period}`,
  };
});

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (dateString) => {
  if (!dateString) return 'mm/dd/yyyy';
  const [year, month, day] = dateString.split('-');
  return `${month}/${day}/${year}`;
};

const readCustomCakeDraft = () => {
  if (typeof window === 'undefined') return null;
  try {
    const storedUser = JSON.parse(window.localStorage.getItem('user') || 'null');
    const draftKey = `${CUSTOM_CAKE_DRAFT_KEY}:${storedUser?.id || 'guest'}`;
    const draft = JSON.parse(window.sessionStorage.getItem(draftKey) || 'null');
    window.sessionStorage.removeItem(CUSTOM_CAKE_DRAFT_KEY);
    return draft;
  } catch (error) {
    console.warn('Could not restore custom cake form details:', error);
    return null;
  }
};

const readStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const formatSavedAddress = (address) => [
  address.house_no,
  address.street,
  address.barangay,
  address.city,
  address.province,
  address.zip_code,
].filter(Boolean).join(', ');

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
  const location = useLocation();
  const referenceStorageKey = 'customCakeReferenceImages';
  const [storedUser] = useState(readStoredUser);
  const [formDraft] = useState(readCustomCakeDraft);
  const [name, setName] = useState(() => storedUser?.name || storedUser?.full_name || '');
  const [email, setEmail] = useState(() => storedUser?.email || '');
  const [contactNumber, setContactNumber] = useState(() => storedUser?.phone || storedUser?.phone_number || storedUser?.contact_number || '');
  const [pickupDate, setPickupDate] = useState(() => formDraft?.pickupDate || '');
  const [pickupTime, setPickupTime] = useState(() => formDraft?.pickupTime || '');
  const [deliveryMethod, setDeliveryMethod] = useState(() => formDraft?.deliveryMethod || 'Pickup');
  const [deliveryService, setDeliveryService] = useState(() => formDraft?.deliveryService || '');
  const [deliveryAddress, setDeliveryAddress] = useState(() => formDraft?.deliveryAddress || '');
  const [cakeType, setCakeType] = useState(() => formDraft?.cakeType || 'single');
  const [singleSizeId, setSingleSizeId] = useState(() => formDraft?.singleSizeId || '');
  const [twoTierPreset, setTwoTierPreset] = useState(() => formDraft?.twoTierPreset || 'standard');
  const [flavorId, setFlavorId] = useState(() => formDraft?.flavorId || '');
  const [occasion, setOccasion] = useState(() => formDraft?.occasion || 'Birthday');
  const [customOccasion, setCustomOccasion] = useState(() => formDraft?.customOccasion || '');
  const [cakeStyle, setCakeStyle] = useState(() => formDraft?.cakeStyle || '');
  const [packaging, setPackaging] = useState(() => formDraft?.packaging || 'Standard');
  const [customTheme, setCustomTheme] = useState(() => formDraft?.customTheme || '');
  const [cakeColor, setCakeColor] = useState(() => formDraft?.cakeColor || '');
  const [customMessage, setCustomMessage] = useState(() => formDraft?.customMessage || '');
  const [specialInstructions, setSpecialInstructions] = useState(() => formDraft?.specialInstructions || '');
  const [addons, setAddons] = useState(() => formDraft?.addons || []);
  const [cupcakeQuantity, setCupcakeQuantity] = useState(() => formDraft?.cupcakeQuantity || 12);
  const [budget, setBudget] = useState(() => formDraft?.budget || '');
  const [quantity, setQuantity] = useState(() => formDraft?.quantity || 1);
  const [files, setFiles] = useState([]);
  const [referenceImage, setReferenceImage] = useState(null);
  const [featuredPreview, setFeaturedPreview] = useState(null);
  const [filePreviewUrls, setFilePreviewUrls] = useState([]);
  const [isReferencePreviewOpen, setIsReferencePreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState(0);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [showSavedAddressSuggestions, setShowSavedAddressSuggestions] = useState(false);
  const [flavorCatalog, setFlavorCatalog] = useState([]);
  const [sizeCatalog, setSizeCatalog] = useState([]);

  useEffect(() => {
    if (!location.state?.scrollToRequestForm) return undefined;

    const timer = window.setTimeout(() => {
      document.getElementById('custom-cake-request-form')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      navigate(location.pathname, { replace: true, state: null });
    }, 200);

    return () => window.clearTimeout(timer);
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    try {
      const draftKey = `${CUSTOM_CAKE_DRAFT_KEY}:${storedUser?.id || 'guest'}`;
      window.sessionStorage.setItem(draftKey, JSON.stringify({
        pickupDate,
        pickupTime,
        deliveryMethod,
        deliveryService,
        deliveryAddress,
        cakeType,
        singleSizeId,
        twoTierPreset,
        flavorId,
        occasion,
        customOccasion,
        cakeStyle,
        packaging,
        customTheme,
        cakeColor,
        customMessage,
        specialInstructions,
        addons,
        cupcakeQuantity,
        budget,
        quantity,
      }));
    } catch (error) {
      console.warn('Could not save custom cake form details:', error);
    }
  }, [
    storedUser?.id, pickupDate, pickupTime, deliveryMethod,
    deliveryService, deliveryAddress, cakeType, singleSizeId, twoTierPreset,
    flavorId, occasion, customOccasion, cakeStyle, packaging, customTheme,
    cakeColor, customMessage, specialInstructions, addons, cupcakeQuantity,
    budget, quantity,
  ]);

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
    if (!flavorId && flavorCatalog.length > 0) setFlavorId(String(flavorCatalog[0].id));
  }, [sizeCatalog, flavorCatalog, singleSizeId, flavorId]);

  const sampleImages = [
    { src: `${ROOT_BASE}/uploads/birthday(1).jpg?v=birthday-featured-1`, label: 'Birthday' },
    { src: `${ROOT_BASE}/uploads/floral(1).jpg?v=floral-featured-1`, label: 'Floral' },
    { src: `${ROOT_BASE}/uploads/wedding(1).jpg?v=wedding-featured-1`, label: 'Wedding' },
    { src: `${ROOT_BASE}/uploads/holiday(1).jpg?v=holiday-featured-1`, label: 'Holiday' },
    { src: `${ROOT_BASE}/uploads/kids(8).jpg?v=kids-featured-8`, label: 'Kids' },
    { src: `${ROOT_BASE}/uploads/cutesy(5).jpg?v=cutesy-featured-5`, label: 'Cutesy' },
  ];

  const featuredImagePositions = {
    Birthday: 'center 60%',
    Floral: 'center 28%',
    Wedding: 'center 55%',
    Holiday: 'center 64%',
    Kids: 'center 48%',
    Cutesy: 'center 42%',
  };

  const twoTierPresets = {
    mini: { label: 'Mini two tier cake', top: '4x2', bottom: '6x3' },
    standard: { label: 'Standard two tier cake', top: '6x5', bottom: '8x5' },
    large: { label: 'Large two tier cake', top: '8x5', bottom: '10x5' },
  };

  const sizeByCode = (code) => sizeCatalog.find((size) => size.code === code);
  const selectedTwoTierPreset = twoTierPresets[twoTierPreset];
  const selectedTiers = buildTierSelections(
    cakeType,
    flavorId,
    singleSizeId,
    sizeByCode(selectedTwoTierPreset.top)?.id,
    sizeByCode(selectedTwoTierPreset.bottom)?.id
  );
  const addressQuery = deliveryAddress.trim().toLowerCase();
  const matchingSavedAddresses = savedAddresses.filter((address) => {
    const searchableAddress = `${address.address_label || ''} ${formatSavedAddress(address)}`.toLowerCase();
    return !addressQuery || searchableAddress.includes(addressQuery);
  });

  useEffect(() => {
    let isActive = true;

    try {
      if (storedUser?.id) {
        setUserId(Number(storedUser.id));

        setAddressesLoading(true);
        fetch(`${CUSTOMER_BASE}/api/addresses`, {
          credentials: 'include',
          headers: { Accept: 'application/json', ...getAuthHeaders() },
        })
          .then(safeParseJson)
          .then((data) => {
            if (!isActive || data?.status !== 'success') return;
            const addresses = Array.isArray(data.addresses) ? data.addresses : [];
            setSavedAddresses(addresses);
          })
          .catch((error) => console.warn('Could not load saved addresses:', error))
          .finally(() => {
            if (isActive) setAddressesLoading(false);
          });
      }
    } catch {
      setUserId(0);
    }

    fetch(`${LARAVEL_BASE}/api/user`, {
      credentials: 'include',
      headers: { Accept: 'application/json', ...getAuthHeaders() },
    })
      .then(safeParseJson)
      .then((profile) => {
        if (!isActive || !profile?.id) return;
        setUserId(Number(profile.id));
        setName(profile.name || profile.full_name || '');
        setEmail(profile.email || '');
        setContactNumber(profile.phone || profile.phone_number || profile.contact_number || '');
      })
      .catch((error) => console.warn('Could not load the saved customer profile:', error));

    return () => {
      isActive = false;
    };
  }, []);

  const handleFiles = (event) => {
    const nextFiles = Array.from(event.target.files || []).slice(0, MAX_REFERENCE_IMAGES);
    if (nextFiles.length === 0) return;
    window.sessionStorage.removeItem('customCakeReferenceImage');
    window.sessionStorage.removeItem(referenceStorageKey);
    const existingFiles = referenceImage?.type === 'upload' ? files : [];
    const mergedFiles = [...existingFiles, ...nextFiles].filter((file, index, allFiles) => (
      allFiles.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size) === index
    )).slice(0, MAX_REFERENCE_IMAGES);
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
    if (pickupDate && pickupDate < getLocalDateString()) {
      setMessage('Please choose today or a future date.');
      return;
    }
    if (!userId) {
      setMessage('Please log in to your customer account before sending a custom cake request.');
      navigate('/customer/login');
      return;
    }
    if (deliveryMethod === 'Delivery' && !deliveryService) {
      setMessage('Choose Lalamove or GrabCar for delivery.');
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

      const tierDetails = selectedTiers.map((tier, index) => {
        const flavor = flavorCatalog.find((item) => Number(item.id) === Number(tier.flavor_id));
        const size = sizeCatalog.find((item) => Number(item.id) === Number(tier.size_id));
        const tierLabel = cakeType === 'single' ? 'Single tier' : index === 0 ? 'Top tier' : 'Bottom tier';
        return `${tierLabel}: ${flavor?.name || 'Unknown flavor'} (${size?.label || 'Unknown size'})`;
      });
      const customizationDetails = {
        customer_name: name,
        email,
        phone: contactNumber,
        delivery_method: deliveryMethod,
        delivery_address: deliveryMethod === 'Delivery' ? deliveryAddress : '',
        delivery_service: deliveryMethod === 'Delivery' ? deliveryService : '',
        pickup_date: pickupDate,
        pickup_time: pickupTime,
        cake_type: cakeType === 'single' ? 'Single Tier' : selectedTwoTierPreset.label,
        cake_size: selectedTiers.map((tier) => sizeCatalog.find((item) => Number(item.id) === Number(tier.size_id))?.label || '').filter(Boolean).join(' / '),
        cake_flavor: [...new Set(selectedTiers.map((tier) => flavorCatalog.find((item) => Number(item.id) === Number(tier.flavor_id))?.name).filter(Boolean))].join(', '),
        tier_details: tierDetails.join(' | '),
        servings: quantity,
        occasion: occasion === 'Other' ? customOccasion.trim() : occasion,
        cake_style: cakeStyle,
        packaging,
        theme: customTheme,
        cake_color: cakeColor,
        custom_message: customMessage,
        special_instructions: specialInstructions,
        addons,
        cupcake_quantity: addons.includes('Cupcakes') ? Number(cupcakeQuantity) : 0,
        budget,
        estimated_price: budget,
        quantity,
        reference_image: referenceImage ? {
          type: referenceImage.type,
          id: referenceImage.id,
          url: referenceImage.url,
          name: referenceImage.name,
        } : null,
      };
      const orderNotes = JSON.stringify(customizationDetails);
      const laravelForm = new FormData();
      laravelForm.append('cake_type', payload.cake_type);
      laravelForm.append('user_id', String(payload.user_id || userId || 0));
      laravelForm.append('tiers', JSON.stringify(payload.tiers));
      laravelForm.append('order_id', '');
      laravelForm.append('notes', orderNotes);
      laravelForm.append('delivery_service', deliveryMethod === 'Delivery' ? deliveryService : '');
      laravelForm.append('reference_image', JSON.stringify(referenceImage ? {
        type: referenceImage.type,
        id: referenceImage.id,
        url: referenceImage.url,
        name: referenceImage.name,
      } : null));
      files.forEach((file, index) => laravelForm.append('files[]', file, file.name || `file${index}`));

      const laravelRes = await fetch(`${LARAVEL_BASE}/api/customized-cakes/order`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', ...getAuthHeaders() },
        body: laravelForm,
      });

      const laravelData = await safeParseJson(laravelRes);
      if (laravelRes.ok && laravelData?.success) {
        setMessage('Request submitted. Admin will review it within 24 hours, then send the final price and inform you whether it is accepted or declined.');
        window.sessionStorage.removeItem(CUSTOM_CAKE_DRAFT_KEY);
        window.sessionStorage.removeItem('customCakeReferenceImage');
        window.sessionStorage.removeItem(referenceStorageKey);
        return;
      }
      if (![404, 405].includes(laravelRes.status)) {
        throw new Error(laravelData?.message || `Server returned ${laravelRes.status}`);
      }

      const fd = new FormData();
      fd.append('name', name);
      fd.append('email', email);
      fd.append('phone', contactNumber);
      fd.append('pickup_date', pickupDate);
      fd.append('pickup_time', pickupTime);
      fd.append('delivery_method', deliveryMethod);
      fd.append('delivery_address', deliveryMethod === 'Delivery' ? deliveryAddress : '');
      fd.append('delivery_service', deliveryMethod === 'Delivery' ? deliveryService : '');
      fd.append('user_id', String(userId || 0));
      fd.append('cake_type', cakeType);
      fd.append('cake_size', customizationDetails.cake_size);
      fd.append('cake_flavor', customizationDetails.cake_flavor);
      fd.append('servings', String(quantity));
      fd.append('occasion', customizationDetails.occasion);
      fd.append('cake_style', cakeStyle);
      fd.append('packaging', packaging);
      fd.append('theme', [cakeStyle, customTheme].filter(Boolean).join(' - '));
      fd.append('cake_color', cakeColor);
      fd.append('custom_message', customMessage);
      fd.append('special_instructions', specialInstructions);
      fd.append('addons', JSON.stringify(addons));
      fd.append('cupcake_quantity', String(customizationDetails.cupcake_quantity));
      fd.append('budget', budget);
      fd.append('estimated_price', budget);
      fd.append('total_amount', budget);
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
        credentials: 'include',
        headers: { ...getAuthHeaders() },
        body: fd,
      });

      const data = await safeParseJson(res);
      if (!res.ok) {
        throw new Error(data?.message || `Server returned ${res.status}`);
      }

      if (data && data.success) {
        setMessage('Request submitted. Admin will review it within 24 hours, then send the final price and inform you whether it is accepted or declined.');
        window.sessionStorage.removeItem(CUSTOM_CAKE_DRAFT_KEY);
        window.sessionStorage.removeItem('customCakeReferenceImage');
        window.sessionStorage.removeItem(referenceStorageKey);
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
    <PageShell background="bg-[#fffaf3]" padding="px-4 md:px-7 lg:px-10 py-4" innerClassName="max-w-[1180px]">
      <section className="relative mb-4 min-h-[230px] overflow-hidden rounded-[18px] border border-[#eadfd8] bg-[#fffaf0] shadow-[0_8px_22px_rgba(91,64,39,0.05)] sm:min-h-[260px]">
        <div className="absolute inset-y-0 right-0 w-[58%] sm:w-[56%]">
          <img
            src={process.env.NODE_ENV === 'production'
              ? `${ROOT_BASE}/customer_portal/build/assets/customize/customize_1.jpg`
              : '/assets/customize/customize_1.jpg'}
            alt="Floral custom cake"
            className="h-full w-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#fffaf0] via-[#fffaf0]/80 to-transparent" />
        </div>
        <div className="relative z-10 flex min-h-[230px] max-w-[430px] flex-col justify-center px-5 py-8 sm:min-h-[260px] sm:px-8">
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#9b7b3d]">Customize</p>
          <h1 className="mt-2 font-serif text-3xl font-bold leading-[0.98] tracking-tight text-[#33251e] sm:text-4xl">
            Customize Your <span className="text-[#c9972d]">Dream Cake</span>
          </h1>
          <p className="mt-3 max-w-[300px] text-xs leading-5 text-[#765f3d]">
            Create a cake that’s uniquely yours. Choose from our designs or bring your own idea.
          </p>
          <button
            type="button"
            onClick={() => document.getElementById('custom-cake-request-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-[#e7c875] px-5 py-2.5 text-[10px] font-bold text-[#33251e] transition hover:bg-[#d9b354]"
          >
            Start Customizing <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <div aria-label="Cake design categories" className="mb-5 grid grid-cols-6 gap-1 rounded-[18px] border border-[#eadfd8] bg-white p-1.5 shadow-[0_5px_18px_rgba(91,64,39,0.04)] md:gap-3 md:p-2">
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
            className="flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#eee4de] bg-white px-0.5 py-1.5 text-center text-[#5f514a] transition hover:-translate-y-0.5 hover:border-[#e7c875] hover:bg-[#fff8df] hover:text-[#8d6a2e] md:min-h-[68px] md:gap-2 md:px-2 md:py-3"
          >
            <Icon size={18} strokeWidth={1.6} className="h-3.5 w-3.5 shrink-0 md:h-[18px] md:w-[18px]" />
            <span className="w-full break-words text-[8px] font-semibold leading-tight md:text-[10px]">{label}</span>
          </button>
        ))}
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-end justify-between px-1">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#9b7b3d]">Featured designs</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-[#33251e]">Featured Designs</h2>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {sampleImages.map((item, index) => {
            const isWedding = item.label === 'Wedding';
            const isKids = item.label === 'Kids';
            const isCutesy = item.label === 'Cutesy';

            return (
              <article key={index} className="group relative aspect-[3/4] min-h-[180px] overflow-hidden rounded-[14px] border border-[#eadfd8] bg-[#f8eee8] shadow-[0_6px_16px_rgba(91,64,39,0.06)] lg:aspect-auto lg:h-52">
                <button
                  type="button"
                  onClick={() => setFeaturedPreview({ type: 'example', id: `featured-${index + 1}`, url: item.src, name: item.label })}
                  aria-label={`Preview ${item.label} featured design`}
                  className="absolute inset-0 z-0 h-full w-full"
                >
                  <img
                    src={item.src}
                    alt=""
                    style={{ objectPosition: featuredImagePositions[item.label] }}
                    className={`block h-full w-full object-cover transition-transform duration-300 ${
                      isWedding ? 'scale-[1.5] group-hover:scale-[1.6]' : isKids ? 'scale-[1.5] group-hover:scale-[1.55]' : isCutesy ? 'scale-[1.85] group-hover:scale-[1.9]' : 'group-hover:scale-[1.02]'
                    }`}
                  />
                </button>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-start px-3 pt-3">
                  <button
                    type="button"
                    onClick={() => addGalleryReferenceImage({ type: 'example', id: `featured-${index + 1}`, url: item.src, name: item.label })}
                    className={`inline-flex max-w-full items-center justify-center rounded-md border border-white/60 px-2 py-1 text-[7px] font-bold uppercase tracking-[0.08em] whitespace-nowrap transition ${
                      referenceImage?.id === `featured-${index + 1}`
                        ? 'bg-[#6f9d67] text-white opacity-100'
                        : 'bg-[#fff8df]/90 text-[#8d6a2e] opacity-100 group-hover:opacity-100 focus:opacity-100'
                    }`}
                  >
                    {referenceImage?.id === `featured-${index + 1}` ? '✓ Using as Reference' : 'Use as Reference'}
                  </button>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3 pb-3">
                  <span className="inline-block rounded-md bg-white/90 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#8d6a2e]">
                    {item.label}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {featuredPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f1a17]/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Featured design preview"
          onClick={() => setFeaturedPreview(null)}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#eadfd8] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.18)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#f2e8dc] px-4 py-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b7b3d]">Reference preview</span>
              <button type="button" onClick={() => setFeaturedPreview(null)} aria-label="Close preview" className="text-lg font-semibold text-[#6b4f1d]">×</button>
            </div>
            <div className="p-4">
              <div className="h-72 overflow-hidden rounded-xl border border-[#f0d98a]">
                <img src={featuredPreview.url} alt={featuredPreview.name} className="h-full w-full object-cover" />
              </div>
              <p className="mt-3 text-center text-sm font-semibold text-[#4b3b33]">{featuredPreview.name}</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setFeaturedPreview(null)} className="flex-1 rounded-xl border border-[#f0d98a] bg-white px-3 py-2 text-sm font-semibold text-[#6b4f1d]">Cancel</button>
                <button type="button" onClick={() => { void addGalleryReferenceImage(featuredPreview); setFeaturedPreview(null); }} className="flex-1 rounded-xl border border-[#e5bd45] bg-[#ffe89a] px-3 py-2 text-sm font-semibold text-[#6b4f1d]">Use this image</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form
        id="custom-cake-request-form"
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[#eadfd8] bg-[#fffdf9] p-4 shadow-[0_8px_22px_rgba(91,64,39,0.05)] sm:rounded-3xl sm:p-6"
      >
        <div className="mb-4 border-b border-[#f0e6dc] pb-3 sm:mb-5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#9b7b3d]">Your custom order</p>
            <h2 className="mt-1 font-serif text-xl font-bold text-[#33251e] sm:text-2xl">Cake Customization Details</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#8d7a6e]">Tell us about your cake and how you would like to receive it.</p>
            <p className="mt-1 text-[11px] text-[#8d7a6e]"><span className="font-bold text-red-600">*</span> Required information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start lg:gap-4">
          <div className="contents lg:flex lg:flex-col lg:gap-3">
            <div data-custom-card="1" style={{ order: 1 }} className="rounded-2xl border border-[#eee4de] bg-white p-4 shadow-[0_3px_12px_rgba(91,64,39,0.04)] sm:p-5">
              <p className="mb-4 flex items-center gap-2 border-b border-[#f3ece6] pb-3 text-sm font-bold text-[#6b4f1d]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff3c8] text-[11px]">1</span>
                Customer Information
              </p>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[#6b4f1d]">
                  Full Name <span aria-hidden="true" className="text-red-600">*</span>
                  <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter full name" className="mt-1.5 min-h-11 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-sm font-normal text-[#33251e] outline-none transition placeholder:text-[#a99a8e] focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd]" />
                </label>
                <label className="block text-xs font-semibold text-[#6b4f1d]">
                  Contact Number <span aria-hidden="true" className="text-red-600">*</span>
                  <input required value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} placeholder="Enter contact number" className="mt-1.5 min-h-11 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-sm font-normal text-[#33251e] outline-none transition placeholder:text-[#a99a8e] focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd]" />
                </label>
                <label className="block text-xs font-semibold text-[#6b4f1d] sm:col-span-2">
                  Email Address <span aria-hidden="true" className="text-red-600">*</span>
                  <input required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter email address" type="email" className="mt-1.5 min-h-11 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-sm font-normal text-[#33251e] outline-none transition placeholder:text-[#a99a8e] focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd]" />
                </label>
              </div>
            </div>

            <div data-custom-card="2" style={{ order: 2 }} className="rounded-2xl border border-[#eee4de] bg-white p-4 shadow-[0_3px_12px_rgba(91,64,39,0.04)] sm:p-5">
              <p className="mb-4 flex items-center gap-2 border-b border-[#f3ece6] pb-3 text-sm font-bold text-[#6b4f1d]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff3c8] text-[11px]">2</span>
                Order Information
              </p>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                  {['Pickup', 'Delivery'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setDeliveryMethod(option);
                        if (option === 'Pickup') setDeliveryService('');
                      }}
                      aria-pressed={deliveryMethod === option}
                      className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        deliveryMethod === option
                          ? 'border-[#c9972d] bg-[#fff1bd] text-[#5f4715] shadow-sm'
                          : 'border-[#eadfd8] bg-white text-[#5f514a] hover:border-[#d4af37] hover:bg-[#fffaf0]'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                {deliveryMethod === 'Delivery' && (
                  <div className="space-y-3 sm:col-span-2">
                    <div className="text-sm text-[#6b4f1d]">
                      <p className="font-semibold">You will book the delivery rider yourself.</p>
                      <p className="mt-0.5 text-xs leading-5 text-[#8d7a6e]">Choose a service and arrange the booking directly.</p>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8f8076]">Delivery service <span className="text-red-600">*</span></p>
                      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Delivery service">
                        {['Lalamove', 'GrabCar'].map((service) => (
                          <button
                            key={service}
                            type="button"
                            aria-pressed={deliveryService === service}
                            onClick={() => setDeliveryService(service)}
                            className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition ${deliveryService === service ? 'border-[#c9972d] bg-[#fff1bd] text-[#5f4715] shadow-sm' : 'border-[#eadfd8] bg-white text-[#5f514a] hover:border-[#d4af37] hover:bg-[#fffaf0]'}`}
                          >
                            {service}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <label className="block min-w-0 text-xs font-semibold text-[#6b4f1d]">
                  {deliveryMethod === 'Delivery' ? 'Delivery date' : 'Pickup date'} <span aria-hidden="true" className="text-red-600">*</span>
                  <span className="relative mt-1.5 flex h-11 min-w-0 w-full max-w-full items-center rounded-lg border border-[#eadfd8] bg-white px-3 text-sm text-[#33251e] transition focus-within:border-[#c9972d] focus-within:ring-2 focus-within:ring-[#fff1bd]">
                    <span aria-hidden="true" className={`font-bold ${pickupDate ? 'text-[#33251e]' : 'text-black'}`}>
                      {formatDateForDisplay(pickupDate)}
                    </span>
                    <CalendarDays aria-hidden="true" size={16} className="ml-auto shrink-0 text-[#8d7a6e]" />
                    <input
                      required
                      min={getLocalDateString()}
                      value={pickupDate}
                      onChange={(event) => setPickupDate(event.target.value)}
                      type="date"
                      aria-label={deliveryMethod === 'Delivery' ? 'Delivery date' : 'Pickup date'}
                      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                    />
                  </span>
                </label>
                <label className="block min-w-0 text-xs font-semibold text-[#6b4f1d]">
                  {deliveryMethod === 'Delivery' ? 'Delivery time' : 'Pickup time'} <span aria-hidden="true" className="text-red-600">*</span>
                  <select required value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} className="mt-1.5 box-border min-h-11 w-full min-w-0 max-w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-sm text-[#33251e] outline-none transition focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd]">
                    <option value="" disabled>Select a {deliveryMethod === 'Delivery' ? 'delivery' : 'pickup'} time</option>
                    {FULFILLMENT_TIME_SLOTS.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
                  </select>
                </label>
                {deliveryMethod === 'Delivery' && (
                  <label className="block text-xs font-semibold text-[#6b4f1d] sm:col-span-2">
                  Delivery Address <span aria-hidden="true" className="text-red-600">*</span>
                  {addressesLoading && <span className="ml-1 font-normal text-[#8d7a6e]">Loading saved suggestions...</span>}
                  <div className="relative mt-1.5">
                    <textarea
                      required
                      value={deliveryAddress}
                      onFocus={() => setShowSavedAddressSuggestions(savedAddresses.length > 0)}
                      onBlur={() => window.setTimeout(() => setShowSavedAddressSuggestions(false), 120)}
                      onChange={(event) => {
                        setDeliveryAddress(event.target.value);
                        setShowSavedAddressSuggestions(true);
                      }}
                      placeholder="Type an address or choose a saved suggestion"
                      rows={2}
                      className="w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-sm font-normal text-[#33251e] outline-none transition placeholder:text-[#a99a8e] focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd]"
                    />
                    {showSavedAddressSuggestions && savedAddresses.length > 0 && (
                      <div role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-[#eadfd8] bg-white p-1 shadow-lg">
                        {matchingSavedAddresses.length > 0 ? matchingSavedAddresses.map((address) => (
                          <button
                            key={address.address_id}
                            type="button"
                            role="option"
                            aria-selected={deliveryAddress === formatSavedAddress(address)}
                            onPointerDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setDeliveryAddress(formatSavedAddress(address));
                              setShowSavedAddressSuggestions(false);
                            }}
                            className="block w-full rounded-md px-3 py-2 text-left transition hover:bg-[#fff8df]"
                          >
                            <span className="block text-xs font-semibold text-[#6b4f1d]">{address.address_label || 'Saved address'}</span>
                            <span className="mt-0.5 block text-[11px] font-normal leading-relaxed text-[#8d7a6e]">{formatSavedAddress(address)}</span>
                          </button>
                        )) : (
                          <p className="px-3 py-2 text-xs font-normal text-[#8d7a6e]">No saved address matches. You can keep typing.</p>
                        )}
                      </div>
                    )}
                  </div>
                  </label>
                )}
              </div>
            </div>

            <div data-custom-card="3" style={{ order: 3 }} className="rounded-2xl border border-[#eee4de] bg-white p-4 shadow-[0_3px_12px_rgba(91,64,39,0.04)] sm:p-5">
              <p className="mb-4 flex items-center gap-2 border-b border-[#f3ece6] pb-3 text-sm font-bold text-[#6b4f1d]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff3c8] text-[11px]">3</span>
                Cake Details
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {['single', 'two-tier'].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCakeType(value)}
                      className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        cakeType === value
                          ? 'border-[#c9972d] bg-[#fff1bd] text-[#5f4715] shadow-sm'
                          : 'border-[#eadfd8] bg-white text-[#5f514a] hover:border-[#d4af37] hover:bg-[#fffaf0]'
                      }`}
                    >
                      {value === 'single' ? 'Single Tier' : 'Two Tier'}
                    </button>
                  ))}
                </div>

                {cakeType === 'single' ? (
                  <>
                    <p className="text-xs font-semibold text-[#7b5b3a]">Flavor</p>
                    <div className="grid grid-cols-3 gap-2">
                      {flavorCatalog.map((flavor) => (
                        <button key={flavor.id} type="button" onClick={() => setFlavorId(String(flavor.id))} aria-pressed={flavorId === String(flavor.id)} className={`min-h-10 rounded-xl border px-2 py-2 text-xs font-semibold transition ${flavorId === String(flavor.id) ? 'border-[#c9972d] bg-[#fff1bd] text-[#5f4715]' : 'border-[#eadfd8] bg-white text-[#5f514a] hover:border-[#d4af37] hover:bg-[#fffaf0]'}`}>
                          {flavor.name}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs font-semibold text-[#7b5b3a]">Size</p>
                    <div className="grid grid-cols-3 gap-2">
                      {sizeCatalog.map((size) => (
                        <button key={size.id} type="button" onClick={() => setSingleSizeId(String(size.id))} aria-pressed={singleSizeId === String(size.id)} className={`min-h-10 rounded-xl border px-2 py-2 text-xs font-semibold transition ${singleSizeId === String(size.id) ? 'border-[#c9972d] bg-[#fff1bd] text-[#5f4715]' : 'border-[#eadfd8] bg-white text-[#5f514a] hover:border-[#d4af37] hover:bg-[#fffaf0]'}`}>
                          {size.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-[#7b5b3a]">Two tier configuration</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {Object.entries(twoTierPresets).map(([value, preset]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTwoTierPreset(value)}
                          aria-pressed={twoTierPreset === value}
                          className={`min-h-16 rounded-xl border px-3 py-3 text-left transition ${twoTierPreset === value ? 'border-[#c9972d] bg-[#fff1bd] text-[#5f4715]' : 'border-[#eadfd8] bg-white text-[#5f514a] hover:border-[#d4af37] hover:bg-[#fffaf0]'}`}
                        >
                          <span className="block text-xs font-bold">{preset.label}</span>
                          <span className="block mt-1 text-[11px] opacity-80">{sizeByCode(preset.top)?.label || preset.top} / {sizeByCode(preset.bottom)?.label || preset.bottom}</span>
                        </button>
                      ))}
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold text-[#7b5b3a]">Flavor for both tiers</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {flavorCatalog.map((flavor) => (
                          <button key={flavor.id} type="button" onClick={() => setFlavorId(String(flavor.id))} aria-pressed={flavorId === String(flavor.id)} className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-semibold transition ${flavorId === String(flavor.id) ? 'border-[#c9972d] bg-[#fff1bd] text-[#5f4715]' : 'border-[#eadfd8] bg-white text-[#5f514a] hover:border-[#d4af37] hover:bg-[#fffaf0]'}`}>
                            {flavor.name}
                          </button>
                        ))}
                      </div>
                    </div>

                  </>
                )}
              </div>
            </div>

            <div data-custom-card="4" style={{ order: 4 }} className="rounded-2xl border border-[#eee4de] bg-white p-4 shadow-[0_3px_12px_rgba(91,64,39,0.04)] sm:p-5">
              <p className="mb-4 flex items-center gap-2 border-b border-[#f3ece6] pb-3 text-sm font-bold text-[#6b4f1d]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff3c8] text-[11px]">4</span>
                Reference Images
              </p>
              <p className="mb-2 text-[11px] text-[#9b8c83]">Add an example or upload up to 5 images.</p>
              <input id="custom-cake-reference-files" type="file" multiple accept="image/*" onChange={handleFiles} disabled={files.length >= MAX_REFERENCE_IMAGES} className="sr-only" />
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="custom-cake-reference-files" className={`inline-flex rounded-lg border border-[#e5bd45] bg-[#ffe89a] px-4 py-2 text-[12px] font-bold text-[#6b4f1d] transition ${files.length >= MAX_REFERENCE_IMAGES ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-[#ffedb5]'}`}>
                  {files.length >= MAX_REFERENCE_IMAGES ? '5 Images Selected' : files.length > 0 ? `Add Images (${files.length}/${MAX_REFERENCE_IMAGES})` : 'Choose Images'}
                </label>
                {!referenceImage && <div className="grid min-h-28 flex-1 place-items-center rounded-lg border border-dashed border-[#eadfd8] bg-white px-3 py-4 text-center text-xs text-[#9b8060]">No reference selected</div>}
              </div>

              {referenceImage && (
                <div className="mt-3 space-y-2">
                  <div className="inline-flex rounded-full border border-[#e5bd45] bg-[#fff8df] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8d6a2e]">
                    {referenceImage.type === 'example' ? 'Example reference' : `${files.length} uploaded reference${files.length === 1 ? '' : 's'}`}: {referenceImage.name}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(filePreviewUrls.length > 0 ? filePreviewUrls : [{ id: referenceImage.id, name: referenceImage.name, url: referenceImage.url }]).map((preview) => (
                      <div key={preview.id} className="group relative overflow-hidden rounded-lg border border-[#eadfd8] bg-white">
                        <button
                          type="button"
                          onClick={() => {
                            const file = files.find((item) => `${item.name}-${item.size}-${item.lastModified}` === preview.id);
                            setReferenceImage({ type: file ? 'upload' : 'example', id: preview.id, url: preview.url, name: preview.name, file });
                            setIsReferencePreviewOpen(true);
                          }}
                          className="block w-full"
                        >
                          <img src={preview.url} alt={preview.name} className="h-20 w-full object-cover transition group-hover:opacity-80" />
                          <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-1 text-[8px] text-white">View full</span>
                        </button>
                        <button type="button" onClick={() => handleRemoveReference(preview.id)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-[#6b4f1d] shadow" aria-label={`Remove ${preview.name}`}>×</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => { setFiles([]); setReferenceImage(null); window.sessionStorage.removeItem('customCakeReferenceImage'); }} className="text-xs font-bold text-[#8d6a2e] underline">Change Reference</button>
                    <button type="button" onClick={() => navigate('/customer/birthday-designs')} className="text-xs font-bold text-[#8d6a2e] underline">Browse Examples</button>
                  </div>
                </div>
              )}
            </div>

          </div>
          <div className="contents lg:flex lg:flex-col lg:gap-3">
            <section data-custom-card="7" style={{ order: 7 }} className="rounded-2xl border border-[#eee4de] bg-white p-4 shadow-[0_3px_12px_rgba(91,64,39,0.04)] sm:p-5">
              <p className="mb-4 flex items-center gap-2 border-b border-[#f3ece6] pb-3 text-sm font-bold text-[#6b4f1d]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff3c8] text-[11px]">7</span>
                Add-ons <span className="font-normal text-[#9b8c83]">(optional)</span>
              </p>
              <fieldset>
                <legend className="mb-2 text-xs font-semibold text-[#6b4f1d]">Choose add-ons</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-sm text-[#33251e]">
                    <input type="checkbox" checked={addons.includes('Cake topper')} onChange={() => handleAddonChange('Cake topper')} className="accent-[#c9972d]" />
                    Cake topper
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-sm text-[#33251e]">
                    <input type="checkbox" checked={addons.includes('Cupcakes')} onChange={() => handleAddonChange('Cupcakes')} className="accent-[#c9972d]" />
                    Cupcakes
                  </label>
                </div>
                {addons.includes('Cupcakes') && (
                  <label className="mt-2 block text-xs font-semibold text-[#6b4f1d]">
                    Number of cupcakes
                    <input type="number" min={1} max={100} value={cupcakeQuantity} onChange={(event) => setCupcakeQuantity(Math.min(100, Math.max(1, Number(event.target.value) || 1)))} className="mt-1.5 min-h-11 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-sm font-normal text-[#33251e] outline-none focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd] sm:max-w-40" />
                  </label>
                )}
              </fieldset>
            </section>
            <div data-custom-card="5" style={{ order: 5 }} className="rounded-2xl border border-[#eee4de] bg-white p-4 shadow-[0_3px_12px_rgba(91,64,39,0.04)] sm:p-5">
              <p className="mb-4 flex items-center gap-2 border-b border-[#f3ece6] pb-3 text-sm font-bold text-[#6b4f1d]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff3c8] text-[11px]">5</span>
                Customization Details
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="block text-xs font-semibold text-[#6b4f1d]">
                  <label htmlFor="custom-cake-occasion">Occasion</label>
                  <select id="custom-cake-occasion" value={occasion} onChange={(event) => setOccasion(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-sm text-[#33251e] outline-none focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd]">
                    <option>Birthday</option>
                    <option>Wedding</option>
                    <option>Anniversary</option>
                    <option>Graduation</option>
                    <option>Baby Shower</option>
                    <option value="Other">Other</option>
                  </select>
                  {occasion === 'Other' && (
                    <input
                      aria-label="Other occasion"
                      required
                      value={customOccasion}
                      onChange={(event) => setCustomOccasion(event.target.value)}
                      placeholder="Type the occasion"
                      className="mt-2 min-h-11 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-sm font-normal text-[#33251e] outline-none placeholder:text-[#a99a8e] focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd]"
                    />
                  )}
                </div>
                <label className="block text-xs font-semibold text-[#6b4f1d]">
                  Cake Style <span className="font-normal text-[#9b8c83]">(optional)</span>
                  <select value={cakeStyle} onChange={(event) => setCakeStyle(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-sm font-normal text-[#33251e] outline-none focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd]">
                    <option value="">Choose a style</option>
                    <option value="Bento">Bento</option>
                    <option value="Vintage">Vintage</option>
                    <option value="Floral">Floral</option>
                    <option value="Character / themed">Character / themed</option>
                    <option value="Minimalist">Minimalist</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label className="block h-full min-h-[90px] text-xs font-semibold text-[#6b4f1d] sm:col-start-2 sm:row-start-3">
                  Packaging <span className="font-normal text-[#9b8c83]">(optional)</span>
                  <select value={packaging} onChange={(event) => setPackaging(event.target.value)} className="mt-1.5 h-16 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-sm font-normal text-[#33251e] outline-none focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd]">
                    <option value="Standard">Standard</option>
                    <option value="Clamshell">Clamshell box</option>
                    <option value="Acetate box">Acetate box</option>
                  </select>
                </label>
                <label className="block h-full min-h-[90px] text-xs font-semibold text-[#6b4f1d]">Preferred Cake Color <span className="font-normal text-[#9b8c83]">(optional)</span>
                  <textarea rows={2} value={cakeColor} onChange={(event) => setCakeColor(event.target.value)} placeholder="e.g. blush pink and white" className="mt-1.5 min-h-16 w-full resize-y rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-sm font-normal text-[#33251e] outline-none placeholder:text-[#a99a8e] focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd]" />
                </label>
                <label className="block h-full min-h-[90px] text-xs font-semibold text-[#6b4f1d] sm:col-start-1 sm:row-start-3">Cake Message <span className="font-normal text-[#9b8c83]">(optional)</span>
                  <textarea rows={2} value={customMessage} onChange={(event) => setCustomMessage(event.target.value)} placeholder="Message to write on the cake" className="mt-1.5 min-h-16 w-full resize-y rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-sm font-normal text-[#33251e] outline-none placeholder:text-[#a99a8e] focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd]" />
                </label>
                <label className="block h-full min-h-[90px] text-xs font-semibold text-[#6b4f1d]">
                  Specific Design or Theme <span className="font-normal text-[#9b8c83]">(optional)</span>
                  <input value={customTheme} onChange={(event) => setCustomTheme(event.target.value)} placeholder="e.g. Kuromi, daisy flowers, or a name" className="mt-1.5 h-16 w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-sm font-normal text-[#33251e] outline-none placeholder:text-[#a99a8e] focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd]" />
                </label>
              </div>
            </div>

            <div data-custom-card="8" style={{ order: 8 }} className="rounded-2xl border border-[#eee4de] bg-white p-4 shadow-[0_3px_12px_rgba(91,64,39,0.04)] sm:p-5">
              <p className="mb-4 flex items-center gap-2 border-b border-[#f3ece6] pb-3 text-sm font-bold text-[#6b4f1d]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff3c8] text-[11px]">8</span>
                Order Summary
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6b4f1d]" htmlFor="custom-cake-budget">Your Budget (₱)</label>
                  <input id="custom-cake-budget" value={budget} onChange={(event) => setBudget(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter budget" type="text" inputMode="numeric" maxLength={6} pattern="[0-9]{0,6}" className="w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-[13px] text-[#6b4f1d] outline-none focus:border-[#e5bd45] focus:ring-2 focus:ring-[#fff1bd]" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6b4f1d]" htmlFor="custom-cake-quantity">Quantity</label>
                  <input id="custom-cake-quantity" value={quantity} onChange={(event) => setQuantity(Number(event.target.value) || 1)} placeholder="Enter quantity" type="number" min={1} className="w-full rounded-lg border border-[#eadfd8] bg-white px-3 py-2.5 text-[13px] text-[#6b4f1d] outline-none focus:border-[#e5bd45] focus:ring-2 focus:ring-[#fff1bd]" />
                </div>
                <div className="rounded-lg border border-[#eadfd8] bg-[#fffaf0] p-3">
                  <div className="flex items-center justify-between text-[12px] text-[#6b4f1d]">
                    <span>Your budget</span>
                    <span className="text-base font-black text-[#33251e]">₱{Number(budget || 0).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[#8d7a6e]">Final price will be confirmed after we review your design and add-ons.</p>
                </div>
              </div>
              {message && (
                <div className="mt-3 text-right text-[13px] text-[#7b5b3a]" role="status" aria-live="polite">
                  {message}
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2 border-t border-[#f3ece6] pt-3">
                <button type="button" onClick={() => { setCakeType('single'); setSingleSizeId(sizeCatalog[0] ? String(sizeCatalog[0].id) : ''); setTwoTierPreset('standard'); setFlavorId(flavorCatalog[0] ? String(flavorCatalog[0].id) : ''); setCakeStyle(''); setPackaging('Standard'); setAddons([]); setCupcakeQuantity(12); setBudget(''); setFiles([]); setReferenceImage(null); setMessage(''); }} className="rounded-xl border border-[#f0d98a] bg-white px-4 py-2 text-sm font-semibold text-[#6b4f1d] hover:border-[#e5bd45]">
                  Reset
                </button>
                {userId > 0 ? (
                  <button disabled={loading} type="submit" className="rounded-xl border border-[#e5bd45] bg-[#ffe89a] px-4 py-2 text-sm font-semibold text-[#6b4f1d] transition hover:bg-[#ffedb5] disabled:opacity-50">
                    {loading ? 'Sending...' : 'Send Request'}
                  </button>
                ) : (
                  <button type="button" onClick={() => navigate('/customer/login')} className="rounded-xl border border-[#e5bd45] bg-[#ffe89a] px-4 py-2 text-sm font-semibold text-[#6b4f1d] transition hover:bg-[#ffedb5]">
                    Log in to Send Request
                  </button>
                )}
              </div>
            </div>

            <section data-custom-card="6" style={{ order: 6 }} className="rounded-2xl border border-[#eee4de] bg-white p-4 shadow-[0_3px_12px_rgba(91,64,39,0.04)] sm:p-5">
              <p className="mb-4 flex items-center gap-2 border-b border-[#f3ece6] pb-3 text-sm font-bold text-[#6b4f1d]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff3c8] text-[11px]">6</span>
                Special Instructions <span className="font-normal text-[#9b8c83]">(optional)</span>
              </p>
              <textarea aria-label="Special Instructions" value={specialInstructions} onChange={(event) => setSpecialInstructions(event.target.value)} placeholder="Share any other details" rows={5} className="min-h-28 w-full resize-y rounded-lg border border-[#eadfd8] bg-white px-3 py-2 text-sm font-normal text-[#33251e] outline-none placeholder:text-[#a99a8e] focus:border-[#c9972d] focus:ring-2 focus:ring-[#fff1bd]" />
            </section>
          </div>

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
