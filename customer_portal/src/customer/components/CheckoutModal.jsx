import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, SearchX } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CUSTOMER_BASE, LARAVEL_BASE } from '../../services/config';
import { getAuthHeaders } from '../../services/api';
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import useAddressGeocoding from '../hooks/useAddressGeocoding';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const SHOP_HOURS_LABEL = '8:00 AM to 8:00 PM';
const FULFILLMENT_TIME_SLOTS = Array.from({ length: 25 }, (_, index) => {
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
const PICKUP_LOCATION = {
  name: 'Pastry Project Bakeshop & Cafe',
  lat: 14.0753416,
  lng: 121.1377943,
  address: '30 Bagumbayan Road, Tanauan, Calabarzon 4232',
};
const PENDING_PAYMONGO_CHECKOUT_KEY = 'pendingPaymongoCheckout';

const isBerMonth = () => {
  const manilaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return manilaDate.getMonth() >= 8;
};

const formatSavedAddress = (address) => {
  if (!address) return '';
  const parts = [];
  if (address.house_no) parts.push(address.house_no);
  if (address.street) parts.push(address.street);
  const locality = [address.barangay, address.city].filter(Boolean).join(', ');
  if (locality) parts.push(locality);
  if (address.province) parts.push(address.province);
  if (address.zip_code) parts.push(address.zip_code);
  return parts.join(', ');
};

const safeParseJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON response: ${err.message} - ${text}`);
  }
};

export default function CheckoutModal({
  isOpen,
  onClose,
  cartItems = [],
  fullCartItems = [],
  onOrderPlaced,
}) {
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [shopOpen, setShopOpen] = useState(null);
  const [shopStatusError, setShopStatusError] = useState(false);
  const [discountType, setDiscountType] = useState('none');
  const [rewardCodeInput, setRewardCodeInput] = useState('');
  const [firstOrderEligibility, setFirstOrderEligibility] = useState({ status: 'unknown' });
  const [discountIdFile, setDiscountIdFile] = useState(null);
  const [discountIdPreview, setDiscountIdPreview] = useState('');
  const modalScrollRef = useRef(null);

  const refreshShopStatus = useCallback(async (signal) => {
    try {
      const response = await fetch(`${CUSTOMER_BASE}/api/shop/status`, { signal });
      const data = await safeParseJson(response);
      if (!response.ok || typeof data?.is_open !== 'boolean') {
        throw new Error(data?.message || `Shop status request failed (${response.status}).`);
      }
      setShopOpen(data.is_open);
      setShopStatusError(false);
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Unable to verify shop hours:', error);
      setShopOpen(null);
      setShopStatusError(true);
    }
  }, []);

  const [checkoutData, setCheckoutData] = useState({
    method: "Deliver",
    deliveryService: "",
    deliveryTime: "",
    payment: "QRPh",
    orderType: "Standard",
    address: "",
    phone: "",
    lat: null,
    lng: null,
  });

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [accountProfile, setAccountProfile] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const defaultAddressAppliedRef = useRef(false);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressFetchError, setAddressFetchError] = useState('');
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const pickupMapElementRef = useRef(null);

  useEffect(() => {
    if (!discountIdFile) {
      setDiscountIdPreview('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(discountIdFile);
    setDiscountIdPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [discountIdFile]);

  useEffect(() => {
    if (!isOpen || checkoutData.method !== 'Pickup' || !pickupMapElementRef.current) return undefined;

    const pickupMap = L.map(pickupMapElementRef.current, {
      dragging: false,
      touchZoom: true,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false,
      zoomControl: true,
    }).setView([PICKUP_LOCATION.lat, PICKUP_LOCATION.lng], 18);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(pickupMap);

    const pickupMarker = L.marker([PICKUP_LOCATION.lat, PICKUP_LOCATION.lng], {
      draggable: false,
      interactive: false,
      keyboard: false,
    }).addTo(pickupMap);
    pickupMarker.bindTooltip(PICKUP_LOCATION.name, {
      permanent: true,
      direction: 'top',
      offset: [0, -28],
      className: 'pickup-location-tooltip',
    }).openTooltip();

    const resizeTimer = window.setTimeout(() => pickupMap.invalidateSize(), 100);

    return () => {
      window.clearTimeout(resizeTimer);
      pickupMap.remove();
    };
  }, [isOpen, checkoutData.method]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Geocoding is only used to populate optional coordinates; it never limits
  // which delivery addresses customers can enter.
  const {
    setSearchTerm: setGeocodeSearchTerm,
    geocodeNow,
    result: geocodeResult,
    isSearching: isGeocoding,
    errorMessage: geocodeErrorMessage,
    reset: resetGeocode,
  } = useAddressGeocoding({ countryCodes: '', debounceMs: 700 });

  useEffect(() => {
    if (!isOpen) resetGeocode();
  }, [isOpen, resetGeocode]);

  const savedUser = typeof window !== 'undefined'
    ? (() => {
        try {
          return JSON.parse(localStorage.getItem('user') || '{}') || {};
        } catch {
          return {};
        }
      })()
    : {};
  const savedAccountPhone = String(accountProfile?.phone || accountProfile?.phone_number || accountProfile?.contact_number || savedUser.phone || savedUser.phone_number || savedUser.contact_number || '').trim();
  const savedAccountAddress = String(accountProfile?.address || accountProfile?.default_address || savedUser.address || savedUser.default_address || '').trim();
  const userId = savedUser.id || 0;

  useEffect(() => {
    if (!isOpen) return undefined;

    if (!userId) {
      setFirstOrderEligibility({ status: 'unavailable' });
      return undefined;
    }

    let isCurrent = true;
    setFirstOrderEligibility({ status: 'checking' });

    fetch(`${LARAVEL_BASE}/api/orders/first-order-discount`, {
      credentials: 'include',
      headers: getAuthHeaders(),
    })
      .then(async (response) => {
        const data = await safeParseJson(response);
        if (!response.ok || !data?.success || typeof data.eligible !== 'boolean') {
          throw new Error(data?.message || 'Could not verify first-order discount eligibility.');
        }
        if (isCurrent) {
          setFirstOrderEligibility({ status: data.eligible ? 'eligible' : 'used' });
        }
      })
      .catch((error) => {
        console.error('Could not verify first-order discount eligibility:', error);
        if (isCurrent) setFirstOrderEligibility({ status: 'error' });
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const controller = new AbortController();
    setShopOpen(null);
    setShopStatusError(false);
    refreshShopStatus(controller.signal);
    const timer = window.setInterval(() => refreshShopStatus(controller.signal), 60000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [isOpen, refreshShopStatus]);

  useEffect(() => {
    if (isOpen && modalScrollRef.current) {
      modalScrollRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  const savedPhoneNumbers = [...new Set([
    accountProfile?.phone,
    accountProfile?.phone_number,
    accountProfile?.contact_number,
    savedUser.phone,
    savedUser.phone_number,
    savedUser.contact_number,
    ...savedAddresses.map((address) => address.contact_number),
  ].map((phone) => String(phone || '').trim()).filter(Boolean))];
  const matchingPhoneSuggestions = savedPhoneNumbers.filter((phone) =>
    phone.toLowerCase().includes(checkoutData.phone.trim().toLowerCase())
  );
  const matchingAddressSuggestions = savedAddresses.filter((address) => {
    const query = checkoutData.address.trim().toLowerCase();
    return !query || `${address.address_label || ''} ${formatSavedAddress(address)}`.toLowerCase().includes(query);
  });

  const loadSavedAddresses = useCallback(async () => {
    if (userId <= 0) return;
    setAddressesLoading(true);
    setAddressFetchError('');

    try {
      const res = await fetch(`${CUSTOMER_BASE}/api/addresses`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Failed to load addresses: ${res.status}`);
      }
      const data = (await safeParseJson(res)) || {};
      if (data.status !== 'success') {
        throw new Error(data.message || 'Failed to load addresses');
      }
      setSavedAddresses(data.addresses || []);
    } catch (err) {
      console.error('Failed to load addresses', err);
      setAddressFetchError('Unable to fetch saved addresses.');
      setSavedAddresses([]);
    } finally {
      setAddressesLoading(false);
    }
  }, [userId]);

  const loadAccountProfile = useCallback(async () => {
    if (userId <= 0) return;

    try {
      const res = await fetch(`${CUSTOMER_BASE}/api/user`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;

      const profile = (await safeParseJson(res)) || {};
      if (profile.id) setAccountProfile(profile);
    } catch (err) {
      console.error('Failed to load account contact info', err);
    }
  }, [userId]);

  const handleSelectSavedAddress = (address) => {
    resetGeocode();
    setShowAddressSuggestions(false);
    setFieldErrors((prev) => ({ ...prev, address: '' }));
    defaultAddressAppliedRef.current = true;

    if (!address) {
      setSelectedAddressId(null);
      setCheckoutData((prev) => ({
        ...prev,
        address: '',
        phone: prev.phone,
        lat: null,
        lng: null,
      }));
      return;
    }

    setSelectedAddressId(address.address_id);
    const formattedAddress = formatSavedAddress(address);
    setCheckoutData((prev) => ({
      ...prev,
      method: 'Deliver',
      address: formattedAddress,
      phone: address.contact_number || prev.phone,
      lat: null,
      lng: null,
    }));
    geocodeNow(formattedAddress);
  };

  const applyDefaultSavedAddress = useCallback(() => {
    if (defaultAddressAppliedRef.current || addressesLoading) return;

    if (selectedAddressId !== null) {
      defaultAddressAppliedRef.current = true;
      setCheckoutData((prev) => ({
        ...prev,
        phone: prev.phone || savedAccountPhone,
      }));
      return;
    }

    const defaultAddress = savedAddresses.find((address) => address.is_default) || savedAddresses[0];
    if (!defaultAddress) {
      if (!savedAccountAddress && !savedAccountPhone) return;
      defaultAddressAppliedRef.current = true;
      setCheckoutData((prev) => ({
        ...prev,
        address: prev.address || savedAccountAddress,
        phone: prev.phone || savedAccountPhone,
      }));
      if (!checkoutData.address && savedAccountAddress) geocodeNow(savedAccountAddress);
      return;
    }

    defaultAddressAppliedRef.current = true;
    setSelectedAddressId(defaultAddress.address_id);
    const formattedAddress = formatSavedAddress(defaultAddress);
    setCheckoutData((prev) => ({
      ...prev,
      method: 'Deliver',
      address: formattedAddress,
      phone: prev.phone || savedAccountPhone || defaultAddress.contact_number,
      lat: null,
      lng: null,
    }));
    geocodeNow(formattedAddress);
  }, [addressesLoading, selectedAddressId, savedAddresses, savedAccountPhone, savedAccountAddress, geocodeNow]);

  useEffect(() => {
    if (!isOpen) return;
    loadAccountProfile();
    loadSavedAddresses();
  }, [isOpen, loadAccountProfile, loadSavedAddresses]);

  useEffect(() => {
    if (!isOpen) {
      defaultAddressAppliedRef.current = false;
      return;
    }
    applyDefaultSavedAddress();
  }, [isOpen, applyDefaultSavedAddress]);

  const applyResolvedLocation = (lat, lng) => {
    setCheckoutData((prev) => ({
      ...prev,
      lat,
      lng,
    }));
  };

  useEffect(() => {
    if (!geocodeResult) return;
    applyResolvedLocation(geocodeResult.lat, geocodeResult.lon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocodeResult]);

  /* =========================
     GROUP ITEMS
  ========================= */
  const groupedItems = useMemo(() => {
    const grouped = {};

    cartItems.forEach((item) => {
      const key = JSON.stringify({
        name: item.name,
        variant: item.variant,
        selectionDetails: item.selectionDetails || {},
      });

      if (!grouped[key]) {
        grouped[key] = { ...item, qty: 1 };
      } else {
        grouped[key].qty += 1;
      }
    });

    return Object.values(grouped);
  }, [cartItems]);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price || 0),
    0
  );

  const rushFee = checkoutData.orderType === "Urgent" ? 100 : 0;
  const rewardCode = rewardCodeInput.trim().toUpperCase();
  const seniorDiscountAmount = discountType === 'none' || !discountIdFile
    ? 0
    : Number((subtotal * 0.05).toFixed(2));
  const rewardDiscountAmount = discountType === 'none' && rewardCode
    ? Number(Math.min(subtotal * 0.05, 100).toFixed(2))
    : 0;
  const firstOrderDiscountAmount = firstOrderEligibility.status === 'eligible' &&
    discountType === 'none' &&
    !rewardCode
    ? Number((subtotal * 0.05).toFixed(2))
    : 0;
  const discountAmount = seniorDiscountAmount || rewardDiscountAmount || firstOrderDiscountAmount;
  const taxAmount = 0;

  const total = subtotal + rushFee + taxAmount - discountAmount;
  const berMonths = isBerMonth();

  useEffect(() => {
    if (berMonths && checkoutData.orderType === 'Urgent') {
      setCheckoutData((current) => ({ ...current, orderType: 'Standard' }));
    }
  }, [berMonths, checkoutData.orderType]);

  /* =========================
     PLACE ORDER
  ========================= */
  const handlePlaceOrder = async () => {

    if (shopOpen !== true) {
      if (shopOpen === null && shopStatusError) {
        alert('Unable to verify shop hours. Please check your connection and try again.');
        return;
      }
      if (shopOpen === null) {
        alert('Checking shop hours. Please try again in a moment.');
        return;
      }
      alert(`The shop is currently closed. Checkout is available from ${SHOP_HOURS_LABEL}.`);
      return;
    }

    if (berMonths && checkoutData.orderType === 'Urgent') {
      alert('Rush orders are not available during ber months (September to December).');
      setCheckoutData((current) => ({ ...current, orderType: 'Standard' }));
      return;
    }

    const missingFields = {
      phone: checkoutData.phone.trim() ? '' : 'Fill up this field',
      address: checkoutData.method !== 'Deliver' || checkoutData.address.trim() ? '' : 'Fill up this field',
      deliveryTime: checkoutData.deliveryTime ? '' : 'Fill up this field',
      deliveryService: checkoutData.method !== 'Deliver' || checkoutData.deliveryService ? '' : 'Fill up this field',
      discountId: discountType === 'none' || discountIdFile ? '' : 'Fill up this field',
    };
    setFieldErrors(missingFields);
    const firstMissingField = Object.keys(missingFields).find((field) => missingFields[field]);
    if (firstMissingField) {
      const fieldIds = {
        phone: 'checkout-phone',
        address: 'checkout-address',
        deliveryTime: 'checkout-fulfillment-time',
        deliveryService: 'checkout-delivery-service',
        discountId: 'discount-id-image',
      };
      const field = document.getElementById(fieldIds[firstMissingField]);
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field?.focus();
      return;
    }

    if (discountType !== 'none' && rewardCode) {
      alert('A reward code cannot be combined with a Senior Citizen or PWD discount.');
      return;
    }

    const quantitiesByProduct = new Map();
    groupedItems.forEach((item) => {
      const productId = Number(item.product_id);
      if (Number.isInteger(productId)) {
        quantitiesByProduct.set(productId, (quantitiesByProduct.get(productId) || 0) + item.qty);
      }
    });
    if ([...quantitiesByProduct.values()].some((quantity) => quantity > 20)) {
      alert('A maximum of 20 units of each product can be ordered per checkout.');
      return;
    }

    setLoading(true);
    let paymentOrderId = null;
    let paymentSetupStarted = false;
    let paymentLinkReady = false;

    const markPaymentSetupFailed = async () => {
      if (!paymentOrderId) return;
      try {
        await fetch(`${LARAVEL_BASE}/api/orders/${paymentOrderId}/payment-failure`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json', ...getAuthHeaders() },
        });
      } catch (error) {
        console.error('Could not mark failed payment setup:', error);
      }
    };

    try {
      const payload = {
        items: groupedItems.map((item) => ({
          product_id: item.product_id,
          product_size_id: item.product_size_id,
          name: item.name,
          product: item.name,
          qty: item.qty,
          image: item.image || item.photo || item.thumbnail || item.img || '',
          selectionDetails: item.selectionDetails || {},
          variant: item.variant || '',
        })),

        method: checkoutData.method,
        delivery_service: checkoutData.method === "Deliver" ? checkoutData.deliveryService : "",
        delivery_time: checkoutData.deliveryTime,
        payment: checkoutData.payment,
        order_type: checkoutData.orderType || "Standard",
        discount_type: discountType,
        reward_code: rewardCode,
        address: checkoutData.address,
        phone: checkoutData.phone,

        lat: checkoutData.lat,
        lng: checkoutData.lng,
      };

      /* =========================
        SAVE ORDER
      ========================= */

      const orderUrl = `${LARAVEL_BASE}/api/orders`;
      console.log("Placing order to", orderUrl, payload);
      const getCookie = (name) => {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : null;
      };

      const xsrf = getCookie('XSRF-TOKEN');
      const formData = new FormData();
      const appendFormData = (value, key) => {
        if (Array.isArray(value)) {
          value.forEach((entry, index) => appendFormData(entry, `${key}[${index}]`));
        } else if (value && typeof value === 'object') {
          Object.entries(value).forEach(([childKey, childValue]) => {
            appendFormData(childValue, `${key}[${childKey}]`);
          });
        } else if (value !== null && value !== undefined) {
          formData.append(key, String(value));
        }
      };
      Object.entries(payload).forEach(([key, value]) => appendFormData(value, key));
      if (discountIdFile) formData.append('discount_id_image', discountIdFile);

      const response = await fetch(orderUrl, {
        method: "POST",
        credentials: "include",
        headers: {
          ...getAuthHeaders(),
          ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
        },
        body: formData,
      });

      let result;
      if (!response.ok) {
        const text = await response.text();
        console.error('Order API returned non-OK:', response.status, text);
        alert(`Order failed: ${response.status} - ${text}`);
        return;
      }

      try {
        result = await safeParseJson(response);
      } catch (parseErr) {
        console.error('Failed to parse JSON from order API:', parseErr.message);
        alert(`Server returned invalid response: ${parseErr.message}`);
        return;
      }

      console.log('Order API result:', result);

      if (result.status !== "success" && result.success !== true) {
        alert(result.message || "Order failed.");
        return;
      }
      paymentOrderId = result.order_id;
      setRewardCodeInput('');

      /* =========================
         PAYMONGO FLOW
      ========================= */

      if (checkoutData.payment === "QRPh") {
        paymentSetupStarted = true;

        const paymentResponse = await fetch(
          `${CUSTOMER_BASE}/api/customer/payments`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
              ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
            },
            body: JSON.stringify({
              order_id: result.order_id,
              amount: Number(result.total ?? total),
              payment_method: checkoutData.payment,
            }),
          }
        );

        if (!paymentResponse.ok) {
          let errMsg = "PayMongo payment creation failed.";
          try {
            const err = await safeParseJson(paymentResponse);
            errMsg =
              err?.errors?.[0]?.detail ||
              err?.error ||
              err?.message ||
              JSON.stringify(err);
          } catch (e) {
            errMsg = e.message || errMsg;
          }
          await markPaymentSetupFailed();
          alert(errMsg);
          return;
        }

        let paymentData;
        try {
          paymentData = await safeParseJson(paymentResponse);
        } catch (parseErr) {
          await markPaymentSetupFailed();
          console.error('Failed to parse PayMongo JSON:', parseErr.message);
          alert(`Payment provider returned invalid response: ${parseErr.message}`);
          return;
        }

        console.log('PayMongo response:', paymentData);

        const checkoutUrl = paymentData?.data?.url || paymentData?.data?.attributes?.checkout_url;
        if (!checkoutUrl) {
          await markPaymentSetupFailed();
          alert("Payment URL not returned by PayMongo.");
          return;
        }

        paymentLinkReady = true;

        try {
          window.sessionStorage.setItem(PENDING_PAYMONGO_CHECKOUT_KEY, JSON.stringify({
            orderId: result.order_id,
            cartItems: fullCartItems,
            checkoutItems: cartItems,
            startedAt: Date.now(),
          }));
        } catch (storageError) {
          console.error('Could not save the pending PayMongo checkout state:', storageError);
        }

        // REDIRECT TO PAYMONGO
        window.location.href = checkoutUrl;

        return;
      }

      /* =========================
         COD FLOW
      ========================= */

      onOrderPlaced(result.order_id, checkoutData, cartItems);

      onClose();

    } catch (err) {

      if (paymentSetupStarted && !paymentLinkReady) {
        await markPaymentSetupFailed();
      }

      console.error('Place order error:', err);
      const msg = (err && err.message) ? err.message : String(err);
      alert(`Server error: ${msg}`);

    } finally {

      setLoading(false);

    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>

      <motion.div
        className="fixed inset-0 z-[60000] flex min-h-dvh items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >

        <motion.div
          ref={modalScrollRef}
          className="relative my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-[960px] flex-col overflow-y-auto overscroll-contain overflow-x-hidden rounded-[24px] bg-white font-['DM_Sans'] shadow-2xl md:h-[calc(100dvh-2rem)] md:min-h-0 md:overflow-hidden md:flex-row"
          initial={{ scale: 0.98 }}
          animate={{ scale: 1 }}
        >

          {/* CLOSE BUTTON */}
          <button
            onClick={onClose}
            type="button"
            aria-label="Close checkout"
            className="absolute right-2 top-2 z-[10001] flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-[#eee5db] bg-white text-gray-500 shadow-sm transition hover:border-[#e7c875] hover:bg-[#fff8df] hover:text-[#8d6a2e] sm:right-4 sm:top-4"
          >
            <X size={18} />
          </button>

          {/* LEFT SIDE */}
          <div className="relative min-w-0 flex-1 p-5 pb-8 pointer-events-auto sm:p-7 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:p-8 md:pb-10">

            <div className="mb-6 border-b border-[#eee5db] pb-4 pr-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a77b26]">Checkout</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#33251e]">Delivery Details</h2>
              <p className="mt-1 text-sm text-[#8d7a6e]">Choose how you want to receive and pay for your order.</p>
            </div>

            {/* CONTACT INFO */}
            <div className="relative z-10 mb-6 space-y-3 pointer-events-auto">
              <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">
                Contact Info
              </p>

              <div className="relative">
                <label htmlFor="checkout-phone" className="mb-1 block text-xs font-medium text-gray-600">
                  Phone Number <span className="text-red-600" aria-hidden="true">*</span>
                </label>
                <input
                  id="checkout-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="Phone Number"
                  aria-label="Phone Number"
                  required
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-expanded={showPhoneSuggestions && matchingPhoneSuggestions.length > 0}
                  className={`relative z-[9999] box-border w-full rounded-xl border ${fieldErrors.phone ? 'border-red-500' : 'border-[#e8e1d8]'} bg-[#fffdfa] p-3 text-sm text-[#33251e] outline-none transition placeholder:text-gray-400 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 pointer-events-auto`}
                  value={checkoutData.phone}
                  onFocus={() => setShowPhoneSuggestions(true)}
                  onBlur={() => setShowPhoneSuggestions(false)}
                  onChange={(e) => {
                    setFieldErrors((prev) => ({ ...prev, phone: '' }));
                    setCheckoutData((prev) => ({ ...prev, phone: e.target.value }));
                  }}
                />
                {fieldErrors.phone && (
                  <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.phone}</p>
                )}
                {showPhoneSuggestions && matchingPhoneSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-[10000] mt-1 overflow-hidden rounded-xl border border-[#eadfca] bg-white py-1 shadow-lg">
                    {matchingPhoneSuggestions.map((phone) => (
                      <button
                        key={phone}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setCheckoutData((prev) => ({ ...prev, phone }));
                          setShowPhoneSuggestions(false);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-[#493a30] transition hover:bg-[#fff8df]"
                      >
                        {phone}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {checkoutData.method === "Deliver" && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">
                        Delivery Address <span className="text-red-600" aria-hidden="true">*</span>
                      </p>
                      {addressesLoading && (
                        <span className="text-xs text-gray-500">Loading…</span>
                      )}
                    </div>
                    {addressFetchError && (
                      <p className="text-xs text-red-700">{addressFetchError}</p>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      id="checkout-address"
                      type="text"
                      placeholder="Address"
                      autoComplete="street-address"
                      aria-label="Delivery address"
                      required
                      aria-invalid={Boolean(fieldErrors.address)}
                      aria-expanded={showAddressSuggestions && matchingAddressSuggestions.length > 0}
                      className={`relative z-[9999] w-full rounded-xl border ${fieldErrors.address ? 'border-red-500' : 'border-[#e8e1d8]'} bg-[#fffdfa] p-3 pr-9 text-sm text-[#33251e] outline-none transition placeholder:text-gray-400 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 pointer-events-auto`}
                      value={checkoutData.address}
                      onClick={(e) => e.currentTarget.focus()}
                      onFocus={(e) => {
                        if (selectedAddressId !== null) {
                          e.currentTarget.select();
                          setSelectedAddressId(null);
                        }
                        setShowAddressSuggestions(true);
                      }}
                      onBlur={() => {
                        setShowAddressSuggestions(false);
                        geocodeNow();
                      }}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedAddressId(null);
                        defaultAddressAppliedRef.current = true;
                        setFieldErrors((prev) => ({ ...prev, address: '' }));
                        setCheckoutData((prev) => ({
                          ...prev,
                          address: value,
                          lat: null,
                          lng: null,
                        }));
                        setGeocodeSearchTerm(value);
                        setShowAddressSuggestions(true);
                      }}
                    />
                    {fieldErrors.address && (
                      <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.address}</p>
                    )}
                    {isGeocoding && (
                      <Loader2
                        size={16}
                        className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400 z-[9999]"
                      />
                    )}
                    {showAddressSuggestions && matchingAddressSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-[10000] mt-1 max-h-56 overflow-y-auto rounded-xl border border-[#eadfca] bg-white py-1 shadow-lg">
                        {matchingAddressSuggestions.map((address) => (
                          <button
                            key={address.address_id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSelectSavedAddress(address)}
                            className="block w-full px-3 py-2 text-left transition hover:bg-[#fff8df]"
                          >
                            <span className="block text-xs font-semibold text-[#493a30]">
                              {address.address_label || 'Saved address'}
                              {address.is_default ? ' · Default' : ''}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-[#8d7a6e]">
                              {formatSavedAddress(address)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {geocodeErrorMessage && !isGeocoding && (
                    <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <SearchX size={16} className="mt-0.5 shrink-0" />
                      <span>Address lookup is unavailable right now. You can still use the address you entered.</span>
                    </div>
                  )}

                </>
              )}
            </div>

            {/* METHOD */}
            <div className="mb-6 space-y-2">

              <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">
                Order Method
              </p>

              <div className="grid grid-cols-2 gap-2">

                {["Deliver", "Pickup"].map((m) => (

                  <button
                    key={m}
                    onClick={() =>
                      setCheckoutData({
                        ...checkoutData,
                        method: m,
                        ...(m === "Deliver" && checkoutData.payment === "Counter"
                          ? { payment: "QRPh" }
                          : {}),
                      })
                    }
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7c875]
                    ${
                      checkoutData.method === m
                        ? "border-[#e7c875] bg-[#fff8df] text-[#8d6a2e]"
                        : "border-[#eee5db] bg-white text-[#765d50] hover:border-[#e7c875] hover:bg-[#fffaf0]"
                    }`}
                  >
                    {m}
                  </button>

                ))}

              </div>

            </div>

            <div className="mb-6">
              <label htmlFor="checkout-fulfillment-time" className="mb-1 block text-xs font-medium text-gray-600">
                {checkoutData.method === "Pickup" ? "Pickup time" : "Delivery time"} <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <select
                id="checkout-fulfillment-time"
                required
                aria-invalid={Boolean(fieldErrors.deliveryTime)}
                value={checkoutData.deliveryTime}
                onChange={(event) => {
                  setFieldErrors((prev) => ({ ...prev, deliveryTime: '' }));
                  setCheckoutData((current) => ({ ...current, deliveryTime: event.target.value }));
                }}
                className={`w-full rounded-xl border ${fieldErrors.deliveryTime ? 'border-red-500' : 'border-[#e8e1d8]'} bg-[#fffdfa] p-3 text-sm text-[#33251e] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20`}
              >
                <option value="" disabled>Select a time</option>
                {FULFILLMENT_TIME_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value}>{slot.label}</option>
                ))}
              </select>
              {fieldErrors.deliveryTime && (
                <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.deliveryTime}</p>
              )}
            </div>

            {checkoutData.method === "Deliver" && (
              <section className="mb-6 space-y-3" aria-labelledby="delivery-service-heading">
                <div className="rounded-xl border border-[#e9d8ae] bg-[#fffaf0] px-3.5 py-3 text-sm text-[#6b4f1d]">
                  <p className="font-semibold">You will book the delivery rider yourself.</p>
                  <p className="mt-0.5 text-xs leading-5 text-[#8d7a6e]">Pastry Project does not arrange the rider booking.</p>
                </div>
                <div>
                  <p id="delivery-service-heading" className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Choose a delivery service</p>
                  <div id="checkout-delivery-service" tabIndex={-1} className="grid grid-cols-2 gap-2 rounded-lg" role="group" aria-labelledby="delivery-service-heading" aria-invalid={Boolean(fieldErrors.deliveryService)}>
                    {["Lalamove", "GrabCar"].map((service) => (
                      <button
                        key={service}
                        type="button"
                        aria-pressed={checkoutData.deliveryService === service}
                        onClick={() => {
                          setFieldErrors((prev) => ({ ...prev, deliveryService: '' }));
                          setCheckoutData((current) => ({ ...current, deliveryService: service }));
                        }}
                        className={`min-h-11 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7c875] ${
                          checkoutData.deliveryService === service
                            ? "border-[#c9972d] bg-[#fff1bd] text-[#5f4715] shadow-sm"
                            : "border-[#eee5db] bg-white text-[#765d50] hover:border-[#e7c875] hover:bg-[#fffaf0]"
                        }`}
                      >
                        {service}
                      </button>
                    ))}
                  </div>
                  {fieldErrors.deliveryService && (
                    <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.deliveryService}</p>
                  )}
                </div>
              </section>
            )}

            {/* PAYMENT */}
            <div className="mb-6 space-y-2">

              <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">
                Payment Method
              </p>

              <div className={`grid gap-2 ${checkoutData.method === "Deliver" ? "grid-cols-1" : "sm:grid-cols-2"}`}>
                {[
                  { value: "QRPh", label: "QRPh" },
                  { value: "Counter", label: "Pay at the Counter" },
                ]
                  .filter((paymentOption) => checkoutData.method !== "Deliver" || paymentOption.value !== "Counter")
                  .map((paymentOption) => (
                  <button
                    key={paymentOption.value}
                    type="button"
                    onClick={() =>
                      setCheckoutData({
                        ...checkoutData,
                        payment: paymentOption.value,
                      })
                    }
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7c875]
                    ${
                      checkoutData.payment === paymentOption.value
                        ? "border-[#e7c875] bg-[#fff8df] text-[#8d6a2e]"
                        : "border-[#eee5db] bg-white text-[#765d50] hover:border-[#e7c875] hover:bg-[#fffaf0]"
                    }`}
                  >
                    {paymentOption.label}
                  </button>
                ))}
              </div>

            </div>

            {/* ORDER TYPE */}
            <div className="mb-6 space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">
                Order Type
              </p>

              <div className="grid gap-2">
                {[
                  { value: "Standard", label: "Standard Pre-order", note: "Regular order timing" },
                  ...(!berMonths ? [{ value: "Urgent", label: "Urgent Rush Order", note: "Priority handling" }] : []),
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setCheckoutData({
                        ...checkoutData,
                        orderType: option.value,
                      })
                    }
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      checkoutData.orderType === option.value
                        ? "border-[#e7c875] bg-[#fff8df] text-[#8d6a2e]"
                        : "border-[#eee5db] bg-white text-[#765d50] hover:border-[#e7c875] hover:bg-[#fffaf0]"
                    }`}
                  >
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div className={`mt-1 text-xs ${checkoutData.orderType === option.value ? "text-slate-600" : "text-gray-500"}`}>
                      {option.note}
                    </div>
                  </button>
                ))}
              </div>
              {berMonths && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Rush orders are unavailable during ber months (September to December).
                </p>
              )}
            </div>

            {checkoutData.method === 'Pickup' && (
              <section className="mb-6 overflow-hidden rounded-2xl border border-[#eee5db] bg-[#fffdfa]">
                <div className="grid sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                  <div className="flex flex-col justify-center border-b border-[#eee5db] px-4 py-4 sm:border-b-0 sm:border-r">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a77b26]">Pickup Location</p>
                    <h3 className="mt-1.5 text-base font-bold leading-tight text-[#33251e]">{PICKUP_LOCATION.name}</h3>
                    <p className="mt-2 text-xs leading-5 text-[#6f6258]">{PICKUP_LOCATION.address}</p>
                    <p className="mt-3 inline-flex w-fit rounded-full bg-[#fff4c7] px-2.5 py-1 text-[10px] font-semibold text-[#8d6a2e]">Pickup point</p>
                  </div>
                  <div
                    ref={pickupMapElementRef}
                    aria-label="Fixed pickup location map"
                    className="w-full bg-[#f5f1e9]"
                    style={{ height: 240, minHeight: 240 }}
                  />
                </div>
              </section>
            )}

          </div>

          {/* RIGHT SIDE */}
          <div className="flex w-full shrink-0 flex-col border-t border-[#eee5db] bg-[#faf8f2] p-5 sm:p-6 md:min-h-0 md:w-[340px] md:overflow-y-auto md:overscroll-contain md:border-l md:border-t-0 md:p-7">

            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a77b26]">Order Summary</p>
                <p className="mt-1 text-xs text-[#8d7a6e]">{cartItems.length} {cartItems.length === 1 ? "item" : "items"}</p>
              </div>
              <span className="rounded-full bg-[#fff0c2] px-3 py-1 text-xs font-bold text-[#8d6a2e]">₱{total.toLocaleString()}</span>
            </div>

            {/* ITEMS */}
            <div className="overflow-y-auto space-y-3 max-h-[200px]">

              {groupedItems.map((item, idx) => {

                const sel =
                  Array.isArray(item.selectionDetails) ||
                  !item.selectionDetails
                    ? {}
                    : item.selectionDetails;

                return (

                  <div key={idx} className="flex gap-3">

                    <img
                      src={`${CUSTOMER_BASE}/uploads/${item.image}`}
                      className="h-11 w-11 rounded-lg border border-[#eee5db] bg-white object-contain p-1"
                      alt=""
                    />

                    <div className="flex-1">

                      <p className="text-sm font-semibold leading-tight">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Qty {item.qty} • ₱{Number(item.price).toLocaleString()} each
                      </p>

                      {sel.drink && (
                        <p className="text-xs text-blue-500">
                          {sel.drink}
                        </p>
                      )}

                      {sel.cake && (
                        <p className="text-xs text-yellow-600">
                          {sel.cake}
                        </p>
                      )}

                      {sel.extras?.length > 0 && (
                        <p className="text-xs text-green-600">
                          +{sel.extras
                            .map((e) => e.name)
                            .join(", ")}
                        </p>
                      )}

                    </div>

                    <span className="text-sm font-semibold">
                      ₱{item.price * item.qty}
                    </span>

                  </div>

                );
              })}

            </div>

            {/* TOTALS */}
            <div className="mt-5 space-y-2 border-t border-[#e9dfd2] pt-5">

              <div className={`rounded-2xl border px-4 py-3 text-sm ${shopOpen === true ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                <span className="font-semibold">{shopOpen === true ? 'Shop is open' : shopOpen === false ? 'Shop is closed' : 'Checking shop hours'}</span>
                <span className="ml-2">{shopOpen === true ? 'You can place your order now.' : shopOpen === false ? `Checkout is available daily from ${SHOP_HOURS_LABEL}.` : shopStatusError ? 'Shop hours could not be verified. Please try again.' : 'Please wait while we verify the current time.'}</span>
              </div>

              {firstOrderEligibility.status === 'checking' && (
                <p className="rounded-xl border border-[#eadfca] bg-[#fff8e9] px-4 py-3 text-xs text-[#765d50]">
                  Checking your first-order special offer…
                </p>
              )}
              {firstOrderEligibility.status === 'eligible' && (
                <p className="rounded-xl border border-[#eadfca] bg-[#fff8e9] px-4 py-3 text-xs leading-5 text-[#765d50]">
                  <span className="font-bold text-[#8d6a2e]">First order special offer: 5% off your subtotal.</span>{' '}
                  {firstOrderDiscountAmount > 0
                    ? 'It has been applied to your total below.'
                    : 'This offer cannot be combined with a reward code or Senior Citizen / PWD discount.'}
                </p>
              )}
              {firstOrderEligibility.status === 'used' && (
                <p className="rounded-xl border border-[#eee5db] bg-white px-4 py-3 text-xs text-[#8d7a6e]">
                  The first-order special offer has already been used on this account.
                </p>
              )}
              {firstOrderEligibility.status === 'error' && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                  We couldn’t verify your first-order offer. Refresh checkout to check your eligibility.
                </p>
              )}

              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>₱{subtotal}</span>
              </div>

              <div className="space-y-2 rounded-xl border border-[#eee5db] bg-white p-3">
                <label htmlFor="checkout-discount-type" className="block text-xs font-semibold text-[#765d50]">
                  Senior Citizen / PWD Discount
                </label>
                <select
                  id="checkout-discount-type"
                  value={discountType}
                  onChange={(event) => {
                    const nextType = event.target.value;
                    setDiscountType(nextType);
                    if (nextType === 'none') {
                      setDiscountIdFile(null);
                    } else {
                      setRewardCodeInput('');
                    }
                  }}
                  className="w-full rounded-lg border border-[#e8e1d8] bg-[#fffdfa] p-2.5 text-sm text-[#33251e] outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"
                >
                  <option value="none">Regular</option>
                  <option value="senior_citizen">Senior Citizen - 5%</option>
                  <option value="pwd">PWD - 5%</option>
                </select>
                {discountType === 'none' && (
                  <div className="space-y-2 rounded-xl border border-[#eee5db] bg-white p-3">
                    <label htmlFor="checkout-reward-code" className="block text-xs font-semibold text-[#765d50]">
                      Pastry Project reward code
                    </label>
                    <input
                      id="checkout-reward-code"
                      type="text"
                      value={rewardCodeInput}
                      onChange={(event) => setRewardCodeInput(event.target.value.toUpperCase())}
                      maxLength={32}
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="PPR-XXXXXXXX"
                      className="w-full rounded-lg border border-[#e8e1d8] bg-[#fffdfa] p-2.5 text-sm uppercase text-[#33251e] outline-none placeholder:normal-case placeholder:text-gray-400 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"
                    />
                    <p className="text-[11px] leading-4 text-[#8d7a6e]">
                      Redeem 5% off your subtotal, up to ₱100. Reward codes cannot be combined with Senior Citizen or PWD discounts.
                    </p>
                  </div>
                )}
                {discountType !== 'none' && (
                  <div className="space-y-2">
                    <label htmlFor="discount-id-image" className="block text-xs leading-relaxed text-[#765d50]">
                      Upload a clear photo of the valid ID. The 5% discount applies automatically after upload; only authorized admin can view it.
                    </label>
                    <input
                      id="discount-id-image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      required
                      aria-invalid={Boolean(fieldErrors.discountId)}
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        event.target.value = '';
                        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
                        if (file && (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024)) {
                          alert('Choose a JPG, PNG, or WEBP image no larger than 5 MB.');
                          event.target.value = '';
                          setDiscountIdFile(null);
                          return;
                        }
                        setDiscountIdFile(file);
                        setFieldErrors((prev) => ({ ...prev, discountId: file ? '' : prev.discountId }));
                      }}
                      className="block w-full text-xs text-[#765d50] file:mr-3 file:rounded-lg file:border-0 file:bg-[#fff0c2] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#6f5523]"
                    />
                    {fieldErrors.discountId && (
                      <p role="alert" className="text-xs font-medium text-red-600">{fieldErrors.discountId}</p>
                    )}
                    {discountIdPreview && (
                      <img
                        src={discountIdPreview}
                        alt="Preview of uploaded discount ID"
                        className="max-h-48 w-full rounded-lg border border-[#e8e1d8] bg-white object-contain"
                      />
                    )}
                  </div>
                )}
              </div>

              {rushFee > 0 && (
                <div className="flex justify-between text-sm text-[#b45309]">
                  <span>Rush priority fee</span>
                  <span>₱{rushFee}</span>
                </div>
              )}

              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>
                    {rewardDiscountAmount > 0
                      ? 'Rewards discount (5%)'
                      : firstOrderDiscountAmount > 0
                        ? 'First order discount (5%)'
                        : discountType === 'pwd'
                          ? 'PWD discount (5%)'
                          : 'Senior Citizen discount (5%)'}
                  </span>
                  <span>-₱{discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax</span>
                <span>₱{taxAmount}</span>
              </div>

              <div className="flex justify-between rounded-xl border border-[#eadfca] bg-[#fff8e9] px-4 py-3 text-base font-bold text-[#33251e]">
                <span>Total</span>
                <span>₱{total.toLocaleString()}</span>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={loading || shopOpen !== true}
                className="mt-3 w-full rounded-xl border border-[#eadfca] bg-[#fff8e9] py-3.5 text-sm font-bold uppercase tracking-[0.16em] text-[#33251e] shadow-sm transition hover:border-[#e7c875] hover:bg-[#fff8df] hover:text-[#8d6a2e] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-500"
              >
                {loading
                  ? checkoutData.payment === "QRPh"
                    ? "REDIRECTING..."
                    : "SAVING..."
                  : shopOpen === true ? "PLACE ORDER" : shopOpen === false ? "SHOP CLOSED" : "CHECKING HOURS"}
              </button>

            </div>

          </div>

        </motion.div>

      </motion.div>

    </AnimatePresence>
  );
}