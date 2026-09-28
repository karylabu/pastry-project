import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, SearchX } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BASE, CUSTOMER_BASE, LARAVEL_BASE } from '../../services/config';
import { getAuthHeaders } from '../../services/api';
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import useLocationValidation from '../hooks/useLocationValidation';
import useAddressGeocoding from '../hooks/useAddressGeocoding';
import OutOfCoverageModal from '../components/OutOfCoverageModal';
import { isLocationWithinCoverage, TANAUAN_CITY_BOUNDS } from '../utils/locationBoundaryUtils';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const SHOP_OPEN_MINUTES = 8 * 60;
const SHOP_CLOSE_MINUTES = 20 * 60;
const SHOP_HOURS_LABEL = '8:00 AM to 8:00 PM';
const PICKUP_LOCATION = {
  name: 'Pastry Project Bakeshop & Cafe',
  lat: 14.0753416,
  lng: 121.1377943,
  address: '30 Bagumbayan Road, Tanauan, Calabarzon 4232',
};

const isBerMonth = () => {
  const manilaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return manilaDate.getMonth() >= 8;
};

export default function CheckoutModal({
  isOpen,
  onClose,
  cartItems = [],
  setCartItems,
  onOrderPlaced,
}) {
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [shopOpen, setShopOpen] = useState(true);
  const modalScrollRef = useRef(null);
  const addressInputRef = useRef(null);

  const refreshShopStatus = () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    setShopOpen(currentMinutes >= SHOP_OPEN_MINUTES && currentMinutes < SHOP_CLOSE_MINUTES);
  };

  const [checkoutData, setCheckoutData] = useState({
    method: "Deliver",
    payment: "GCash",
    orderType: "Standard",
    address: "",
    phone: "",
    lat: null,
    lng: null,
  });

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressFetchError, setAddressFetchError] = useState('');
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const pickupMapElementRef = useRef(null);

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

  // Location boundary validation (hook must live inside the component)
  const locationValidation = useLocationValidation();

  // Address-search-to-pin geocoding. Biased toward Tanauan so local street
  // and barangay names resolve accurately, but not hard-restricted, so we
  // can still detect (and reject) addresses outside the delivery area.
  const {
    setSearchTerm: setGeocodeSearchTerm,
    geocodeNow,
    result: geocodeResult,
    isSearching: isGeocoding,
    errorMessage: geocodeErrorMessage,
    reset: resetGeocode,
  } = useAddressGeocoding({ biasBounds: TANAUAN_CITY_BOUNDS, debounceMs: 700 });

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
  const userId = savedUser.id || 0;

  useEffect(() => {
    refreshShopStatus();
    const timer = window.setInterval(refreshShopStatus, 60000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && modalScrollRef.current) {
      modalScrollRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

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

  const savedPhoneNumbers = [...new Set([
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

  const safeParseJson = async (response) => {
    const text = await response.text();
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`Invalid JSON response: ${err.message} - ${text}`);
    }
  };

  const loadSavedAddresses = async () => {
    if (userId <= 0) return;
    setAddressesLoading(true);
    setAddressFetchError('');

    try {
      const res = await fetch(`${CUSTOMER_BASE}/api_addresses.php`, {
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
  };

  const handleSelectSavedAddress = (address) => {
    resetGeocode();
    setShowAddressSuggestions(false);

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

  const applyDefaultSavedAddress = () => {
    if (savedAddresses.length === 0) return;
    if (selectedAddressId !== null) return;
    const defaultAddress = savedAddresses.find((address) => address.is_default) || savedAddresses[0];
    if (!defaultAddress) return;

    setSelectedAddressId(defaultAddress.address_id);
    const formattedAddress = formatSavedAddress(defaultAddress);
    setCheckoutData((prev) => ({
      ...prev,
      method: 'Deliver',
      address: formattedAddress,
      phone: prev.phone || defaultAddress.contact_number,
      lat: null,
      lng: null,
    }));
    geocodeNow(formattedAddress);
  };

  useEffect(() => {
    if (!isOpen) return;
    loadSavedAddresses();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    applyDefaultSavedAddress();
  }, [isOpen, savedAddresses]);

  const validatePoint = (lat, lng, address) => {
    const isValid = locationValidation.validateLocation(lat, lng, address);

    setLocationError(
      isValid ? '' : 'Delivery location must be within Tanauan city.'
    );

    return isValid;
  };

  const handleEditAddress = () => {
    locationValidation.clearValidation();
    setLocationError('');
    addressInputRef.current?.focus();
  };

  const applyResolvedLocation = (lat, lng, address) => {
    const isValid = validatePoint(lat, lng, address);

    if (!isValid) {
      setCheckoutData((prev) => ({
        ...prev,
        lat: null,
        lng: null,
      }));
      return;
    }

    setCheckoutData((prev) => ({
      ...prev,
      lat,
      lng,
    }));
  };

  useEffect(() => {
    if (!geocodeResult) return;
    applyResolvedLocation(geocodeResult.lat, geocodeResult.lon, checkoutData.address);
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

  const deliveryFee =
    checkoutData.method === "Deliver" && cartItems.length > 0
      ? 45
      : 0;

  const rushFee = checkoutData.orderType === "Urgent" ? 100 : 0;
  const discountAmount = 0;
  const taxAmount = 0;

  const total = subtotal + deliveryFee + rushFee + taxAmount - discountAmount;
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

    if (!shopOpen) {
      alert(`The shop is currently closed. Checkout is available from ${SHOP_HOURS_LABEL}.`);
      return;
    }

    if (berMonths && checkoutData.orderType === 'Urgent') {
      alert('Rush orders are not available during ber months (September to December).');
      setCheckoutData((current) => ({ ...current, orderType: 'Standard' }));
      return;
    }

    if (!checkoutData.phone) {
      alert("Please enter your phone number.");
      return;
    }

    if (!checkoutData.address && checkoutData.method === "Deliver") {
      alert("Please enter your delivery address.");
      return;
    }

    if (
      checkoutData.method === 'Deliver' &&
      (!checkoutData.lat || !checkoutData.lng || !isLocationWithinCoverage(checkoutData.lat, checkoutData.lng))
    ) {
      alert('Delivery is only available within Tanauan city. Please move the pin or enter a Tanauan address.');
      return;
    }

    setLoading(true);

    try {

      const savedUser = (() => {
        try {
          return JSON.parse(localStorage.getItem("user") || "{}") || {};
        } catch {
          return {};
        }
      })();

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
        payment: checkoutData.payment,
        order_type: checkoutData.orderType || "Standard",
        address: checkoutData.address,
        phone: checkoutData.phone,

        latitude: checkoutData.lat,
        longitude: checkoutData.lng,
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

      const response = await fetch(orderUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
          ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
        },
        body: JSON.stringify(payload),
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

      /* =========================
         PAYMONGO FLOW
      ========================= */

      if (checkoutData.payment === "GCash") {

        const paymentResponse = await fetch(
          `${CUSTOMER_BASE}/create_payment.php`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
            },
            body: JSON.stringify({
              order_id: result.order_id,
              amount: total,
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
          alert(errMsg);
          return;
        }

        let paymentData;
        try {
          paymentData = await safeParseJson(paymentResponse);
        } catch (parseErr) {
          console.error('Failed to parse PayMongo JSON:', parseErr.message);
          alert(`Payment provider returned invalid response: ${parseErr.message}`);
          return;
        }

        console.log('PayMongo response:', paymentData);

        const checkoutUrl = paymentData?.data?.attributes?.checkout_url;
        if (!checkoutUrl) {
          alert("Payment URL not returned by PayMongo.");
          return;
        }

        // FIX: Clear cart AFTER we have a valid checkout URL, right before redirect.
        // Previously the cart was cleared before the URL check, so a missing URL
        // would wipe the cart with no payment made.
        setCartItems([]);

        // REDIRECT TO PAYMONGO
        window.location.href = checkoutUrl;

        return;
      }

      /* =========================
         COD FLOW
      ========================= */

      setCartItems([]);

      onOrderPlaced(result.order_id, checkoutData);

      onClose();

    } catch (err) {

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
            className="absolute right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-[#eee5db] bg-white text-gray-500 shadow-sm transition hover:border-[#e7c875] hover:bg-[#fff8df] hover:text-[#8d6a2e]"
          >
            <X size={18} />
          </button>

          {/* LEFT SIDE */}
          <div className="relative z-50 min-w-0 flex-1 p-5 pb-8 pointer-events-auto sm:p-7 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:p-8 md:pb-10">

            <div className="mb-6 border-b border-[#eee5db] pb-4 pr-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a77b26]">Checkout</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#33251e]">Delivery Details</h2>
              <p className="mt-1 text-sm text-[#8d7a6e]">Choose how you want to receive and pay for your order.</p>
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
                          ? { payment: "GCash" }
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

            {/* PAYMENT */}
            <div className="mb-6 space-y-2">

              <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">
                Payment Method
              </p>

              <div className={`grid gap-2 ${checkoutData.method === "Deliver" ? "grid-cols-1" : "sm:grid-cols-2"}`}>
                {[
                  { value: "GCash", label: "Pay thru QR" },
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

            {/* CONTACT INFO */}
            <div className="space-y-3 relative z-50 pointer-events-auto">

              <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">
                Contact Info
              </p>

              {/* PHONE */}
              <div className="relative">
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="Phone Number"
                  aria-label="Phone Number"
                  aria-expanded={showPhoneSuggestions && matchingPhoneSuggestions.length > 0}
                  className="relative z-[9999] box-border w-full rounded-xl border border-[#e8e1d8] bg-[#fffdfa] p-3 text-sm text-[#33251e] outline-none transition placeholder:text-gray-400 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 pointer-events-auto"
                  value={checkoutData.phone}
                  onFocus={() => setShowPhoneSuggestions(true)}
                  onBlur={() => setShowPhoneSuggestions(false)}
                  onChange={(e) =>
                    setCheckoutData((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                />
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
                        Saved Delivery Address
                      </p>
                      {addressesLoading && (
                        <span className="text-xs text-gray-500">Loading…</span>
                      )}
                    </div>
                    {addressFetchError && (
                      <p className="text-xs text-red-700">{addressFetchError}</p>
                    )}
                  </div>

                  {/* ADDRESS */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Address"
                      autoComplete="street-address"
                      aria-label="Delivery address"
                      aria-expanded={showAddressSuggestions && matchingAddressSuggestions.length > 0}
                      className="relative z-[9999] w-full rounded-xl border border-[#e8e1d8] bg-[#fffdfa] p-3 pr-9 text-sm text-[#33251e] outline-none transition placeholder:text-gray-400 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 pointer-events-auto"
                      value={checkoutData.address}
                      onClick={(e) => e.currentTarget.focus()}
                      onFocus={() => setShowAddressSuggestions(true)}
                      onBlur={() => {
                        setShowAddressSuggestions(false);
                        geocodeNow();
                      }}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedAddressId(null);
                        setCheckoutData((prev) => ({
                          ...prev,
                          address: value,
                        }));
                        // Debounced geocode: finds the pin as the user types.
                        setGeocodeSearchTerm(value);
                        setShowAddressSuggestions(true);
                      }}
                    />
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
                      <span>{geocodeErrorMessage}</span>
                    </div>
                  )}

                  {locationError && (
                    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 mt-2">
                      {locationError}
                    </div>
                  )}

                </>
              )}

            </div>

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
                      src={`${BASE}/uploads/${item.image}`}
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

              <div className={`rounded-2xl border px-4 py-3 text-sm ${shopOpen ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                <span className="font-semibold">{shopOpen ? 'Shop is open' : 'Shop is closed'}</span>
                <span className="ml-2">{shopOpen ? 'You can place your order now.' : `Checkout is available daily from ${SHOP_HOURS_LABEL}.`}</span>
              </div>

              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>₱{subtotal}</span>
              </div>

              <div className="flex justify-between text-sm text-gray-500">
                <span>Shipping</span>
                <span>₱{deliveryFee}</span>
              </div>

              {rushFee > 0 && (
                <div className="flex justify-between text-sm text-[#b45309]">
                  <span>Rush priority fee</span>
                  <span>₱{rushFee}</span>
                </div>
              )}

              <div className="flex justify-between text-sm text-gray-500">
                <span>Discount</span>
                <span>-₱{discountAmount}</span>
              </div>

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
                disabled={loading || !shopOpen}
                className="mt-3 w-full rounded-xl border border-[#eadfca] bg-[#fff8e9] py-3.5 text-sm font-bold uppercase tracking-[0.16em] text-[#33251e] shadow-sm transition hover:border-[#e7c875] hover:bg-[#fff8df] hover:text-[#8d6a2e] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-500"
              >
                {loading
                  ? checkoutData.payment === "GCash"
                    ? "REDIRECTING..."
                    : "SAVING..."
                  : shopOpen ? "PLACE ORDER" : "SHOP CLOSED"}
              </button>

            </div>

          </div>

        </motion.div>

      </motion.div>

      {/* OUT OF COVERAGE MODAL */}
      <OutOfCoverageModal
        isOpen={locationValidation.showOutOfCoverageModal}
        errorMessage={locationValidation.errorMessage}
        distanceFromCenter={locationValidation.validationState?.distanceFromCenter}
        onClose={locationValidation.clearValidation}
        onEditAddress={handleEditAddress}
      />

    </AnimatePresence>
  );
}