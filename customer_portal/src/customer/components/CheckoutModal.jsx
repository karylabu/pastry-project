import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, SearchX } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BASE, CUSTOMER_BASE } from '../../services/config';

// Import marker icon images
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import useLocationValidation from '../hooks/useLocationValidation';
import useAddressGeocoding from '../hooks/useAddressGeocoding';
import OutOfCoverageModal from '../components/OutOfCoverageModal';
import { addBoundaryVisualization, highlightLocation } from '../utils/mapBoundaryHelper';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const TANAUAN_BOUNDS = {
  minLat: 13.90,
  maxLat: 14.20,
  minLng: 120.95,
  maxLng: 121.17,
};

const TANAUAN_CENTER = {
  lat: 14.0735,
  lng: 121.0743,
};

const SHOP_OPEN_MINUTES = 8 * 60;
const SHOP_CLOSE_MINUTES = 20 * 60;
const SHOP_HOURS_LABEL = '8:00 AM to 8:00 PM';

const isWithinTanauan = (lat, lng) => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= TANAUAN_BOUNDS.minLat &&
    lat <= TANAUAN_BOUNDS.maxLat &&
    lng >= TANAUAN_BOUNDS.minLng &&
    lng <= TANAUAN_BOUNDS.maxLng
  );
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
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoMessage, setPromoMessage] = useState('');
  const modalScrollRef = useRef(null);

  const refreshShopStatus = () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    setShopOpen(currentMinutes >= SHOP_OPEN_MINUTES && currentMinutes < SHOP_CLOSE_MINUTES);
  };

  const [checkoutData, setCheckoutData] = useState({
    method: "Deliver",
    payment: "COD",
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

  // Location boundary validation (hook must live inside the component)
  const locationValidation = useLocationValidation();
  const boundaryLayersRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

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
  } = useAddressGeocoding({ biasBounds: TANAUAN_BOUNDS, debounceMs: 700 });

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

  useEffect(() => {
    if (checkoutData.method === 'Pickup' && appliedPromo?.code === 'WELCOME') {
      setAppliedPromo(null);
      setPromoMessage('WELCOME is only available for delivery orders.');
    }
  }, [checkoutData.method, appliedPromo?.code]);

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
      const res = await fetch(`${CUSTOMER_BASE}/api_addresses.php?user_id=${userId}`);
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
    // Saved addresses already carry trusted coordinates from the profile
    // flow, so this path intentionally does NOT trigger geocoding.
    resetGeocode();

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
    setCheckoutData((prev) => ({
      ...prev,
      method: 'Deliver',
      address: formatSavedAddress(address),
      phone: address.contact_number || prev.phone,
      lat: null,
      lng: null,
    }));
  };

  const applyDefaultSavedAddress = () => {
    if (savedAddresses.length === 0) return;
    if (selectedAddressId !== null) return;
    const defaultAddress = savedAddresses.find((address) => address.is_default) || savedAddresses[0];
    if (!defaultAddress) return;

    setSelectedAddressId(defaultAddress.address_id);
    setCheckoutData((prev) => ({
      ...prev,
      method: 'Deliver',
      address: formatSavedAddress(defaultAddress),
      phone: prev.phone || defaultAddress.contact_number,
      lat: null,
      lng: null,
    }));
  };

  useEffect(() => {
    if (!isOpen) return;
    loadSavedAddresses();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    applyDefaultSavedAddress();
  }, [isOpen, savedAddresses]);

  // Runs full boundary validation for a candidate point + address, updates
  // both the local inline error text and the shared out-of-coverage modal state.
  const validatePoint = (lat, lng, address) => {
    const isValid = locationValidation.validateLocation(lat, lng, address);

    setLocationError(
      isValid || isWithinTanauan(lat, lng)
        ? ''
        : 'Delivery location must be within Tanauan city.'
    );

    if (mapRef.current) {
      highlightLocation(mapRef.current, lat, lng, isValid);
    }

    return isValid;
  };

  // Retry handler for the OutOfCoverageModal: re-centers the map on Tanauan
  // and clears the invalid pin so the user can try again.
  const handleOutOfCoverageRetry = () => {
    locationValidation.clearValidation();
    setLocationError('');

    if (mapRef.current && markerRef.current) {
      mapRef.current.setView([TANAUAN_CENTER.lat, TANAUAN_CENTER.lng], 13);
      markerRef.current.setLatLng([TANAUAN_CENTER.lat, TANAUAN_CENTER.lng]);
      setCheckoutData((prev) => ({
        ...prev,
        lat: TANAUAN_CENTER.lat,
        lng: TANAUAN_CENTER.lng,
      }));
    }
  };

  /* =========================
     APPLY A GEOCODED (OR ANY EXTERNALLY-RESOLVED) LAT/LNG TO THE MAP
     Shared by: address search, marker drag, and geolocation flows.
  ========================= */
  const applyResolvedLocation = (lat, lng, address, { flyTo = false } = {}) => {
    if (!mapRef.current || !markerRef.current) return;

    const isValid = validatePoint(lat, lng, address);

    if (!isValid) {
      // Don't let an out-of-coverage point get saved onto the order.
      // Briefly show the offending pin (highlightLocation already marks it
      // red), then reset the map back to the Tanauan view so nothing
      // invalid is left selected. The OutOfCoverageModal (triggered inside
      // validatePoint -> locationValidation.validateLocation) prompts the
      // user to try again.
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.setView([lat, lng], 15);

      setCheckoutData((prev) => ({
        ...prev,
        lat: null,
        lng: null,
      }));

      setTimeout(() => {
        if (!mapRef.current || !markerRef.current) return;
        mapRef.current.setView([TANAUAN_CENTER.lat, TANAUAN_CENTER.lng], 13);
        markerRef.current.setLatLng([TANAUAN_CENTER.lat, TANAUAN_CENTER.lng]);
      }, 900);

      return;
    }

    markerRef.current.setLatLng([lat, lng]);

    if (flyTo) {
      mapRef.current.flyTo([lat, lng], 17, { duration: 1.1 });
    } else {
      mapRef.current.setView([lat, lng], 16);
    }

    setCheckoutData((prev) => ({
      ...prev,
      lat,
      lng,
    }));
  };

  // React to a successful geocode result: pan/pin the map and run it
  // through the Tanauan coverage check.
  useEffect(() => {
    if (!geocodeResult) return;
    applyResolvedLocation(geocodeResult.lat, geocodeResult.lon, checkoutData.address, {
      flyTo: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocodeResult]);

  /* =========================
     MAP INITIALIZATION
  ========================= */
  useEffect(() => {
    if (!isOpen) return;

    if (checkoutData.method === "Deliver") {
      let isMounted = true;
      let mapInstance = mapRef.current;

      // CREATE MAP IF NOT EXISTS
      if (!mapInstance) {
        // Default location (Tagaytay, Philippines)
        const defaultLat = TANAUAN_CENTER.lat;
        const defaultLng = TANAUAN_CENTER.lng;
        let initialLat = defaultLat;
        let initialLng = defaultLng;

        mapInstance = L.map("checkout-map").setView(
          [initialLat, initialLng],
          12
        );

        L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution: "&copy; OpenStreetMap contributors",
          }
        ).addTo(mapInstance);

        const marker = L.marker([initialLat, initialLng], {
          draggable: true,
        }).addTo(mapInstance);
        markerRef.current = marker;

        // Draw the Tanauan coverage boundary on the map
        boundaryLayersRef.current = addBoundaryVisualization(mapInstance, TANAUAN_BOUNDS);

        // REVERSE GEOCODING FUNCTION
        const reverseGeocode = async (lat, lng) => {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
              {
                headers: {
                  'User-Agent': 'PastryShop/1.0'
                }
              }
            );

            if (response.ok) {
              const text = await response.text();
              if (text) {
                try {
                  const data = JSON.parse(text);
                  return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                } catch (jsonError) {
                  console.warn('Reverse geocode returned invalid JSON:', jsonError, text);
                }
              }
            }
          } catch (error) {
            console.error('Reverse geocoding failed:', error);
          }
          return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        };

        // Request user's device location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (!isMounted || !mapRef.current) return;

              const userLat = position.coords.latitude;
              const userLng = position.coords.longitude;

              // Update map center and marker to user location
              mapInstance.setView([userLat, userLng], 16);
              marker.setLatLng([userLat, userLng]);

              // Update address via reverse geocoding
              reverseGeocode(userLat, userLng).then((address) => {
                if (!isMounted) return;

                validatePoint(userLat, userLng, address);

                setCheckoutData((prev) => ({
                  ...prev,
                  lat: userLat,
                  lng: userLng,
                  address: prev.address && selectedAddressId !== null ? prev.address : address,
                }));
              });
            },
            (error) => {
              // Geolocation failed or denied, use default location
              console.log('Geolocation error:', error.message);
            }
          );
        }

        marker.on("dragend", async () => {
          if (!isMounted || !mapRef.current) return;

          const pos = marker.getLatLng();
          const lat = pos.lat;
          const lng = pos.lng;

          // GET ADDRESS VIA REVERSE GEOCODING
          const address = await reverseGeocode(lat, lng);

          if (!isMounted) return;

          // A manual drag supersedes any pending/typed address search.
          resetGeocode();

          validatePoint(lat, lng, address);

          setCheckoutData((prev) => ({
            ...prev,
            lat: lat,
            lng: lng,
            address: address,
          }));
        });

        mapRef.current = mapInstance;

        // INITIAL REVERSE GEOCODING FOR DEFAULT LOCATION (fallback if geolocation not available)
        reverseGeocode(initialLat, initialLng).then((address) => {
          if (!isMounted) return;
          setLocationError('');
          setCheckoutData((prev) => {
            // Only apply default location address when the user has not already selected a saved address
            if (prev.address && selectedAddressId !== null) {
              return prev;
            }
            return {
              ...prev,
              address: prev.address ? prev.address : address,
              lat: initialLat,
              lng: initialLng,
            };
          });
        });
      }

      // FIX SIZE AFTER SWITCHING TO DELIVER
      const timer = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 300);

      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    } else {
      // REMOVE MAP WHEN SWITCHING AWAY FROM DELIVER
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        boundaryLayersRef.current = null;
      }
    }
  }, [isOpen, checkoutData.method]);

  /* =========================
     CLEANUP MAP ON MODAL CLOSE
  ========================= */
  useEffect(() => {
    if (!isOpen && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
      boundaryLayersRef.current = null;
    }
    if (!isOpen) {
      resetGeocode();
    }
  }, [isOpen]);

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
  const voucherAmount = appliedPromo?.code === 'WELCOME' && checkoutData.method === 'Deliver'
    ? deliveryFee
    : 0;
  const taxAmount = 0;

  const total = subtotal + deliveryFee + rushFee + taxAmount - discountAmount - voucherAmount;

  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (code === 'WELCOME' && checkoutData.method !== 'Deliver') {
      setAppliedPromo(null);
      setPromoMessage('WELCOME is only available for delivery orders.');
    } else if (code === 'WELCOME') {
      setAppliedPromo({ code });
      setPromoMessage('Free delivery applied.');
    } else {
      setAppliedPromo(null);
      setPromoMessage('Invalid promo code. Try WELCOME.');
    }
  };

  /* =========================
     PLACE ORDER
  ========================= */
  const handlePlaceOrder = async () => {

    if (!shopOpen) {
      alert(`The shop is currently closed. Checkout is available from ${SHOP_HOURS_LABEL}.`);
      return;
    }

    if (!checkoutData.phone) {
      alert("Please enter your phone number.");
      return;
    }

    // FIX: Validate GCash number format (must be 09XXXXXXXXX, 11 digits)
    if (checkoutData.payment === "GCash") {
      const gcashRegex = /^09\d{9}$/;
      if (!gcashRegex.test(checkoutData.phone)) {
        alert("Please enter a valid GCash number (e.g. 09XXXXXXXXX).");
        return;
      }
    }

    if (!checkoutData.address && checkoutData.method === "Deliver") {
      alert("Please enter your delivery address.");
      return;
    }

    if (
      checkoutData.method === 'Deliver' &&
      (!checkoutData.lat || !checkoutData.lng || !isWithinTanauan(checkoutData.lat, checkoutData.lng))
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
          name: item.name,
          product: item.name,
          qty: item.qty,
          price: item.price,
          image: item.image || item.photo || item.thumbnail || item.img || '',
          selectionDetails: item.selectionDetails || {},
          variant: item.variant || '',
        })),

        subtotal,
        delivery_fee: deliveryFee,
        rush_fee: rushFee,
        voucher_code: appliedPromo?.code || '',
        voucher_amount: voucherAmount,
        total,

        user_id: savedUser.id || 0, // Include user_id for proper order association
        customer: savedUser.name || "",
        email: savedUser.email || "",

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

      const orderUrl = `${CUSTOMER_BASE}/api_orders.php`;
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

      if (result.status !== "success") {
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
        className="fixed inset-0 z-[9999] flex items-start justify-center overflow-hidden bg-black/10 px-4 pb-3 pt-[104px] backdrop-blur-[2px] md:pt-[112px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >

        <motion.div
          ref={modalScrollRef}
          className="relative my-0 flex max-h-[calc(100vh-8rem)] w-full max-w-[820px] flex-col overflow-y-auto overscroll-contain overflow-x-hidden rounded-[24px] bg-white font-['DM_Sans'] shadow-2xl md:max-h-[calc(100vh-8rem)] md:flex-row"
          initial={{ scale: 0.98 }}
          animate={{ scale: 1 }}
        >

          {/* CLOSE BUTTON */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 text-gray-400 hover:text-[#a67c00]"
          >
            <X size={18} />
          </button>

          {/* LEFT SIDE */}
          <div className="relative z-50 min-w-0 flex-1 p-6 pb-10 pointer-events-auto md:p-10 md:pb-12">

            <h2 className="text-2xl font-semibold text-gray-800 mb-5">
              Delivery Details
            </h2>

            {/* METHOD */}
            <div className="mb-6 space-y-2">

              <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">
                Order Method
              </p>

              <div className="flex gap-2">

                {["Deliver", "Pickup"].map((m) => (

                  <button
                    key={m}
                    onClick={() =>
                      setCheckoutData({
                        ...checkoutData,
                        method: m,
                      })
                    }
                    className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors
                    ${
                      checkoutData.method === m
                        ? "border-[#d4af37] bg-[#fff4c7] text-slate-900"
                        : "bg-white text-gray-600"
                    }`}
                  >
                    {m}
                  </button>

                ))}

              </div>

            </div>

            {/* PAYMENT */}
            <div className="mb-6 space-y-2">

              <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">
                Payment Method
              </p>

              <div className="flex gap-2">
                {["COD", "GCash"].map((paymentOption) => (
                  <button
                    key={paymentOption}
                    onClick={() =>
                      setCheckoutData({
                        ...checkoutData,
                        payment: paymentOption,
                      })
                    }
                    className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors
                    ${
                      checkoutData.payment === paymentOption
                        ? "border-[#d4af37] bg-[#fff4c7] text-slate-900"
                        : "bg-white text-gray-600"
                    }`}
                  >
                    {paymentOption}
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
                  { value: "Urgent", label: "Urgent Rush Order", note: "Priority handling" },
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
                        ? "border-[#d4af37] bg-[#fff4c7] text-slate-900"
                        : "border-gray-200 bg-white text-gray-700 hover:border-[#2f2f2f]"
                    }`}
                  >
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div className={`mt-1 text-xs ${checkoutData.orderType === option.value ? "text-slate-600" : "text-gray-500"}`}>
                      {option.note}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* CONTACT INFO */}
            <div className="space-y-3 relative z-50 pointer-events-auto">

              <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">
                Contact Info
              </p>

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

                    {addressFetchError ? (
                      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {addressFetchError}
                      </div>
                    ) : savedAddresses.length === 0 ? (
                      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm text-gray-500">
                        No saved addresses yet. Add one in your profile to reuse it here.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {savedAddresses.map((address) => (
                          <button
                            key={address.address_id}
                            type="button"
                            onClick={() => handleSelectSavedAddress(address)}
                            className={`w-full text-left rounded-2xl border px-4 py-3 transition ${
                              selectedAddressId === address.address_id
                                ? 'border-[#d4af37] bg-[#fff4c7] text-slate-900'
                                : 'border-gray-200 bg-white text-gray-800 hover:border-[#2f2f2f]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold">{address.address_label}</p>
                                <p className="text-sm text-gray-500 mt-1">{address.recipient_name} • {address.contact_number}</p>
                              </div>
                              {address.is_default && (
                                <span className="rounded-full bg-[#f7e8b0] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#8a6500]">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm leading-snug text-gray-600">
                              {formatSavedAddress(address)}
                            </p>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleSelectSavedAddress(null)}
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-[#d4af37] hover:text-[#8a6500]"
                        >
                          Use a different address
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ADDRESS */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Address"
                      autoComplete="street-address"
                      className="w-full p-3 pr-9 bg-gray-50 rounded-xl text-sm outline-none relative z-[9999] pointer-events-auto"
                      value={checkoutData.address}
                      onClick={(e) => e.currentTarget.focus()}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedAddressId(null);
                        setCheckoutData((prev) => ({
                          ...prev,
                          address: value,
                        }));
                        // Debounced geocode: finds the pin as the user types.
                        setGeocodeSearchTerm(value);
                      }}
                      onBlur={() => geocodeNow()}
                    />
                    {isGeocoding && (
                      <Loader2
                        size={16}
                        className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400 z-[9999]"
                      />
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

                  {/* MAP */}
                  <div
                    id="checkout-map"
                    className="w-full h-36 rounded-xl border bg-gray-100 mt-2 overflow-hidden"
                  />
                </>
              )}

              {/* PHONE */}
              <input
                type="tel"
                autoComplete="tel"
                placeholder={
                  checkoutData.payment === "GCash"
                    ? "GCash Number (09XXXXXXXXX)"
                    : "Phone Number"
                }
                className="box-border w-full p-3 bg-gray-50 rounded-xl text-sm outline-none relative z-[9999] pointer-events-auto"
                value={checkoutData.phone}
                onClick={(e) => e.currentTarget.focus()}
                onChange={(e) =>
                  setCheckoutData({
                    ...checkoutData,
                    phone: e.target.value,
                  })
                }
              />

              {checkoutData.payment === "GCash" && (
                <p className="text-xs text-gray-500 mt-2">
                  Enter your GCash number (09XXXXXXXXX) to receive a payment link.
                </p>
              )}

            </div>

          </div>

          {/* RIGHT SIDE */}
          <div className="flex w-full shrink-0 flex-col border-t border-gray-200 bg-[#fafafa] p-6 md:w-[340px] md:border-l md:border-t-0 md:p-8">

            <p className="text-xs text-gray-500 uppercase tracking-[0.2em] mb-6">
              Summary
            </p>

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
                      className="w-10 h-10 rounded-lg object-cover"
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
            <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">

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

              {checkoutData.method === 'Deliver' && <div className="rounded-2xl border border-[#ead9a1] bg-[#fffaf0] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a67c00]">Promo / Voucher</p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={promoCode}
                    onChange={(event) => setPromoCode(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') applyPromo(); }}
                    placeholder="Enter promo code"
                    className="min-w-0 flex-1 rounded-xl border border-[#ead9a1] bg-white px-3 py-2 text-sm uppercase outline-none focus:border-[#2f2f2f]"
                  />
                  <button type="button" onClick={applyPromo} className="rounded-xl bg-[#d4af37] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-900 hover:bg-[#c49c20]">Apply</button>
                </div>
                <p className="mt-2 text-[11px] text-gray-500">
                  Try WELCOME for free delivery.
                </p>
                {promoMessage && <p className={`mt-2 text-xs font-semibold ${appliedPromo ? 'text-green-700' : 'text-red-600'}`}>{promoMessage}</p>}
              </div>}

              <div className="flex justify-between text-sm text-gray-500">
                <span>Discount</span>
                <span>-₱{discountAmount}</span>
              </div>

              {checkoutData.method === 'Deliver' && voucherAmount > 0 && <div className="flex justify-between text-sm text-gray-500">
                <span>Voucher</span>
                <span>-₱{voucherAmount}</span>
              </div>}

              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax</span>
                <span>₱{taxAmount}</span>
              </div>

              <div className="flex justify-between text-base font-semibold pt-2">
                <span>Total</span>
                <span>₱{total}</span>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={loading || !shopOpen}
                className="w-full py-4 rounded-2xl mt-4 bg-[#d4af37] text-sm font-bold tracking-[0.18em] uppercase text-slate-900 transition active:scale-95 hover:bg-[#c49c20] disabled:bg-gray-300"
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
        onRetryMap={handleOutOfCoverageRetry}
      />

    </AnimatePresence>
  );
}