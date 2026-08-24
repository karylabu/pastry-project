/**
 * INTEGRATION GUIDE: Location Coverage Check
 * 
 * This file shows how to integrate the location validation system
 * into your existing CheckoutModal component.
 */

/*
=============================================
STEP 1: IMPORT REQUIRED UTILITIES AND HOOKS
=============================================
*/

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

/*
=============================================
STEP 2: INITIALIZE VALIDATION HOOK
=============================================
*/

function CheckoutModal({ isOpen, onClose, cartItems, setCartItems, onOrderPlaced }) {
  // Add this hook to your component
  const locationValidation = useLocationValidation();

  // ... rest of your state and refs ...
  const mapRef = useRef(null);
  const boundaryLayersRef = useRef(null);
  const highlightRef = useRef(null);

  /*
  =============================================
  STEP 3: ADD BOUNDARY VISUALIZATION
  =============================================
  */

  // In your map initialization useEffect:
  useEffect(() => {
    if (!isOpen || checkoutData.method !== 'Deliver') return;

    let isMounted = true;
    let mapInstance = mapRef.current;

    if (!mapInstance) {
      mapInstance = L.map('checkout-map').setView(getTanauanCenter(), 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapInstance);

      // ADD BOUNDARY VISUALIZATION
      if (!boundaryLayersRef.current) {
        boundaryLayersRef.current = addBoundaryVisualization(mapInstance, {
          showRectangle: true,  // Show delivery zone boundary
          showCircle: false,    // Optional: show circular geofence
          showCenter: true,     // Optional: show city center marker
        });
      }

      // ... rest of your map setup ...
    }

    mapRef.current = mapInstance;
    return () => { isMounted = false; };
  }, [isOpen, checkoutData.method]);

  /*
  =============================================
  STEP 4: VALIDATE ON MARKER DRAG
  =============================================
  */

  // In your marker dragend handler:
  marker.on('dragend', async () => {
    if (!isMounted || !mapRef.current) return;

    const pos = marker.getLatLng();
    const lat = pos.lat;
    const lng = pos.lng;

    // GET ADDRESS VIA REVERSE GEOCODING
    const address = await reverseGeocode(lat, lng);

    // VALIDATE LOCATION
    const isValid = locationValidation.validateLocation(lat, lng, address);

    // CLEAR PREVIOUS HIGHLIGHT
    if (highlightRef.current) {
      highlightRef.current.remove();
    }

    // SHOW VISUAL FEEDBACK
    if (!isMounted) return;
    highlightRef.current = highlightLocation(mapRef.current, lat, lng, isValid);

    if (!isValid) {
      // Location is out of coverage - show modal
      // The modal will be displayed automatically via validationState
      return;
    }

    // Valid location - update checkout data
    setCheckoutData((prev) => ({
      ...prev,
      lat,
      lng,
      address,
    }));
  });

  /*
  =============================================
  STEP 5: HANDLE OUT OF COVERAGE MODAL
  =============================================
  */

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

  /*
  =============================================
  STEP 6: ADD MODAL TO JSX
  =============================================
  */

  // Add to your component's JSX:
  return (
    <>
      {/* ... existing modal content ... */}

      <OutOfCoverageModal
        isOpen={locationValidation.showOutOfCoverageModal}
        errorMessage={locationValidation.errorMessage}
        distanceFromCenter={locationValidation.validationState.distanceFromCenter}
        onClose={locationValidation.clearValidation}
        onRetryMap={handleOutOfCoverageRetry}
      />
    </>
  );
}

/*
=============================================
STEP 7: UPDATE ORDER VALIDATION
=============================================
*/

// In your handlePlaceOrder function:
const handlePlaceOrder = async () => {
  // ... existing validations ...

  if (checkoutData.method === 'Deliver') {
    // Use the validation hook result
    if (!locationValidation.isLocationValid) {
      alert('Please select a valid delivery address within Tanauan City.');
      return;
    }
  }

  // ... rest of order placement ...
};

/*
=============================================
UTILITY FUNCTIONS REFERENCE
=============================================
*/

// Location validation utilities:
// - isLocationWithinCoverage(lat, lng) → boolean
// - validateCoordinates(lat, lng) → { valid, error }
// - getDistanceToCenter(lat, lng) → number (km)
// - getOutOfCoverageMessage(lat, lng) → string
// - isAddressProbablyTanauan(addressString) → boolean

// Map visualization utilities:
// - addBoundaryVisualization(map, options) → layers object
// - highlightLocation(map, lat, lng, isValid) → layers object
// - focusOnTanauan(map, zoomLevel)
// - resetMapToTanauan(map)

// Custom hook:
// - useLocationValidation() → {
//     validationState,
//     validateLocation(lat, lng, address),
//     clearValidation(),
//     resetValidation(),
//     isLocationValid,
//     errorMessage,
//     showOutOfCoverageModal
//   }

export default CheckoutModal;
