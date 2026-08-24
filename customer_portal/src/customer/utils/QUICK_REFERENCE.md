/**
 * QUICK REFERENCE: Location Validation Integration Cheat Sheet
 * Copy & paste snippets for common use cases
 */

// ============================================
// IMPORTS (Add to top of CheckoutModal.jsx)
// ============================================

import useLocationValidation from '../hooks/useLocationValidation';
import OutOfCoverageModal from '../components/OutOfCoverageModal';
import {
  isLocationWithinCoverage,
  getTanauanCenter,
} from '../utils/locationBoundaryUtils';
import {
  addBoundaryVisualization,
  highlightLocation,
  resetMapToTanauan,
} from '../utils/mapBoundaryHelper';


// ============================================
// INITIALIZATION (In component body)
// ============================================

const locationValidation = useLocationValidation();
const mapRef = useRef(null);
const boundaryLayersRef = useRef(null);
const highlightRef = useRef(null);


// ============================================
// MAP SETUP (In useEffect for map creation)
// ============================================

if (!mapInstance) {
  mapInstance = L.map('checkout-map').setView(getTanauanCenter(), 13);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapInstance);

  // Add boundary visualization
  boundaryLayersRef.current = addBoundaryVisualization(mapInstance, {
    showRectangle: true,
    showCircle: false,
    showCenter: true,
  });

  mapRef.current = mapInstance;
}


// ============================================
// VALIDATE ON MARKER DRAG (In marker dragend handler)
// ============================================

marker.on('dragend', async () => {
  if (!isMounted || !mapRef.current) return;

  const pos = marker.getLatLng();
  const lat = pos.lat;
  const lng = pos.lng;

  // Get address from reverse geocoding
  const address = await reverseGeocode(lat, lng);

  // Validate location
  const isValid = locationValidation.validateLocation(lat, lng, address);

  // Clear previous highlight
  if (highlightRef.current) {
    highlightRef.current.remove();
  }

  if (!isMounted) return;

  // Show visual feedback
  highlightRef.current = highlightLocation(mapRef.current, lat, lng, isValid);

  if (!isValid) {
    // Modal shows automatically from validationState
    return;
  }

  // Update checkout data for valid location
  setCheckoutData((prev) => ({
    ...prev,
    lat,
    lng,
    address,
  }));
});


// ============================================
// VALIDATE ON ADDRESS SELECTION (For saved addresses)
// ============================================

const handleSelectSavedAddress = (address) => {
  if (!address) {
    locationValidation.resetValidation();
    return;
  }

  // For saved addresses, validate the coordinates if available
  if (address.latitude && address.longitude) {
    const isValid = locationValidation.validateLocation(
      parseFloat(address.latitude),
      parseFloat(address.longitude),
      formatSavedAddress(address)
    );

    if (!isValid) {
      // Address is out of coverage
      return;
    }
  }

  setSelectedAddressId(address.address_id);
  setCheckoutData((prev) => ({
    ...prev,
    method: 'Deliver',
    address: formatSavedAddress(address),
    phone: address.contact_number || prev.phone,
    lat: address.latitude ? parseFloat(address.latitude) : null,
    lng: address.longitude ? parseFloat(address.longitude) : null,
  }));
};


// ============================================
// HANDLE OUT OF COVERAGE MODAL
// ============================================

const handleOutOfCoverageRetry = () => {
  locationValidation.clearValidation();
  
  // Reset map view to Tanauan City
  if (mapRef.current) {
    resetMapToTanauan(mapRef.current);
  }
  
  // Clear the marker
  if (marker) {
    marker.setLatLng(getTanauanCenter());
  }
};


// ============================================
// VALIDATE BEFORE ORDER SUBMISSION
// ============================================

const handlePlaceOrder = async () => {
  // ... existing validations ...

  if (checkoutData.method === 'Deliver') {
    if (!locationValidation.isLocationValid) {
      alert('Please select a valid delivery address within Tanauan City.');
      return;
    }
  }

  // Verify coordinates one more time before submitting
  if (
    checkoutData.method === 'Deliver' &&
    (!checkoutData.lat || !checkoutData.lng || 
     !isLocationWithinCoverage(checkoutData.lat, checkoutData.lng))
  ) {
    alert('Delivery location must be within Tanauan City. Please adjust your location.');
    return;
  }

  // ... rest of order placement ...
};


// ============================================
// JSX: ADD OUT OF COVERAGE MODAL
// ============================================

return (
  <>
    {/* Existing modal content */}

    <OutOfCoverageModal
      isOpen={locationValidation.showOutOfCoverageModal}
      errorMessage={locationValidation.errorMessage}
      distanceFromCenter={locationValidation.validationState.distanceFromCenter}
      onClose={locationValidation.clearValidation}
      onRetryMap={handleOutOfCoverageRetry}
    />
  </>
);


// ============================================
// CLEANUP ON MODAL CLOSE
// ============================================

useEffect(() => {
  if (!isOpen && mapRef.current) {
    // Clean up boundary layers
    if (boundaryLayersRef.current) {
      boundaryLayersRef.current.remove();
      boundaryLayersRef.current = null;
    }

    // Clean up highlight
    if (highlightRef.current) {
      highlightRef.current.remove();
      highlightRef.current = null;
    }

    // Remove map
    mapRef.current.remove();
    mapRef.current = null;

    // Reset validation
    locationValidation.resetValidation();
  }
}, [isOpen]);


// ============================================
// COMMON USE CASES
// ============================================

// Check if location is valid
if (locationValidation.isLocationValid) {
  // User selected valid location
}

// Get current validation error
console.log(locationValidation.errorMessage);

// Get distance from center
console.log(locationValidation.validationState.distanceFromCenter);

// Manual validation check
import { isLocationWithinCoverage } from '../utils/locationBoundaryUtils';
const isValid = isLocationWithinCoverage(14.0735, 121.0743); // true

// Reset everything
locationValidation.resetValidation();

// Just close the modal (keep validation state)
locationValidation.clearValidation();


// ============================================
// UNIT TEST EXAMPLES
// ============================================

import { isLocationWithinCoverage, calculateDistance } from '../utils/locationBoundaryUtils';

describe('Location Validation', () => {
  // Valid locations (inside Tanauan)
  expect(isLocationWithinCoverage(14.0735, 121.0743)).toBe(true);
  expect(isLocationWithinCoverage(14.0785, 121.0638)).toBe(true);

  // Invalid locations (outside Tanauan)
  expect(isLocationWithinCoverage(14.1381, 121.0123)).toBe(false); // Tagaytay
  expect(isLocationWithinCoverage(14.5995, 120.9842)).toBe(false); // Manila

  // Distance calculation
  const distance = calculateDistance(14.0735, 121.0743, 14.0785, 121.0638);
  expect(distance).toBeGreaterThan(0);
  expect(distance).toBeLessThan(15);
});


// ============================================
// STYLING CUSTOMIZATION
// ============================================

// In mapBoundaryHelper.js, change these colors:
// Gold (current): #D4AF37
// Red: #ef4444
// Green: #22c55e
// Blue: #0066cc

// Example for red boundary:
const rectangle = L.rectangle(bounds, {
  color: '#ef4444',       // Red
  fillColor: '#fecaca',   // Light red
  // ... rest of options
});


// ============================================
// PERFORMANCE TIPS
// ============================================

// 1. Debounce reverse geocoding to avoid too many API calls
const debouncedReverseGeocode = debounce(reverseGeocode, 500);

// 2. Cache address lookups
const addressCache = useRef({});

// 3. Lazy load boundary visualization only when map is visible
if (mapInstance && !boundaryLayersRef.current) {
  boundaryLayersRef.current = addBoundaryVisualization(mapInstance);
}

// 4. Remove highlight layers when not needed
useEffect(() => {
  return () => {
    if (highlightRef.current) {
      highlightRef.current.remove();
    }
  };
}, []);


// ============================================
// ERROR HANDLING
// ============================================

try {
  const isValid = locationValidation.validateLocation(lat, lng, address);
} catch (error) {
  console.error('Location validation failed:', error);
  alert('Unable to validate location. Please try again.');
}

// Coordinate validation before checking coverage
import { validateCoordinates } from '../utils/locationBoundaryUtils';

const validation = validateCoordinates(lat, lng);
if (!validation.valid) {
  console.error(validation.error);
  return;
}


// ============================================
// DEBUGGING
// ============================================

// Log validation state changes
useEffect(() => {
  console.log('Validation State Updated:', locationValidation.validationState);
}, [locationValidation.validationState]);

// Debug distance
console.log('Distance to center:', locationValidation.validationState.distanceFromCenter, 'km');

// Check boundary functions directly
console.log('Within coverage?', isLocationWithinCoverage(14.0735, 121.0743));

// Export validation state for inspection (dev only)
window.__locationValidation = locationValidation;
