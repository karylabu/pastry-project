# Location Coverage Validation System

## Overview

A comprehensive React-based geofencing and location validation system for restricting orders to Tanauan City, Batangas. This system includes boundary checking, visual feedback, and user-friendly error handling.

## Components & Files

### 1. **Location Boundary Utilities** (`locationBoundaryUtils.js`)
Core geofencing logic with dual-validation approach (bounding box + circular radius).

#### Key Functions:
- `isLocationWithinCoverage(lat, lng)` - Primary validation function
- `isWithinBoundingBox(lat, lng)` - Rectangular boundary check
- `isWithinCircularGeofence(lat, lng)` - Circular radius check
- `calculateDistance(lat1, lng1, lat2, lng2)` - Haversine distance formula
- `getOutOfCoverageMessage(lat, lng)` - User-friendly error messages
- `validateCoordinates(lat, lng)` - Input sanitization
- `getTanauanMapBounds()` - Leaflet-compatible bounds format
- `getTanauanCenter()` - City center coordinates

#### Boundary Configuration:
```javascript
const TANAUAN_CITY_BOUNDS = {
  minLat: 13.8850,   // South
  maxLat: 14.1200,   // North
  minLng: 120.9450,  // West
  maxLng: 121.1100,  // East
  centerLat: 14.0735,
  centerLng: 121.0743,
  radiusKm: 8.5      // Circular geofence radius
}
```

### 2. **Location Validation Hook** (`useLocationValidation.js`)
Custom React hook managing validation state and logic.

#### Hook Return Object:
```javascript
{
  validationState: {
    isValid: boolean,
    lat: number | null,
    lng: number | null,
    address: string,
    errorMessage: string,
    distanceFromCenter: number | null,
    showOutOfCoverageModal: boolean
  },
  validateLocation(lat, lng, address): boolean,
  clearValidation(): void,
  resetValidation(): void,
  isLocationValid: boolean,
  errorMessage: string,
  showOutOfCoverageModal: boolean
}
```

#### Usage Example:
```javascript
const locationValidation = useLocationValidation();

// Validate a location
const isValid = locationValidation.validateLocation(14.0735, 121.0743, 'Tanauan City');

// Check validation state
if (locationValidation.isLocationValid) {
  // Proceed with order
}

// Clear the out-of-coverage modal
locationValidation.clearValidation();
```

### 3. **Out of Coverage Modal** (`OutOfCoverageModal.jsx`)
User-friendly modal displaying when location is outside service area.

#### Props:
```javascript
{
  isOpen: boolean,                    // Control visibility
  errorMessage: string,               // Custom error message
  distanceFromCenter: number,         // Distance in km
  onClose: () => void,               // Close handler
  onRetryMap: () => void             // Retry location selection
}
```

#### Features:
- Animated entrance/exit
- Distance display
- Service area information
- Actionable suggestions
- Clear call-to-action buttons

### 4. **Map Boundary Helper** (`mapBoundaryHelper.js`)
Leaflet map visualization utilities for boundary display.

#### Key Functions:
- `addBoundaryVisualization(map, options)` - Add all boundary layers
- `createBoundaryRectangle(map)` - Dashed rectangle boundary
- `createCircularGeofence(map)` - Circular coverage area
- `highlightLocation(map, lat, lng, isValid)` - Location feedback
- `focusOnTanauan(map, zoomLevel)` - Zoom to service area
- `resetMapToTanauan(map)` - Return to default view

#### Usage Example:
```javascript
// Add boundary visualization
const boundaryLayers = addBoundaryVisualization(mapInstance, {
  showRectangle: true,  // Show delivery zone
  showCircle: false,    // Optional circular geofence
  showCenter: true      // Show city center
});

// Highlight a selected location
const highlight = highlightLocation(map, lat, lng, isValid);

// Clean up
boundaryLayers.remove();
highlight.remove();
```

## Integration Steps

### Step 1: Import Components
```javascript
import useLocationValidation from '../hooks/useLocationValidation';
import OutOfCoverageModal from '../components/OutOfCoverageModal';
import {
  isLocationWithinCoverage,
  getTanauanCenter,
  getTanauanMapBounds
} from '../utils/locationBoundaryUtils';
import {
  addBoundaryVisualization,
  highlightLocation,
  resetMapToTanauan
} from '../utils/mapBoundaryHelper';
```

### Step 2: Initialize Hook
```javascript
function CheckoutModal(props) {
  const locationValidation = useLocationValidation();
  const mapRef = useRef(null);
  const boundaryLayersRef = useRef(null);
  // ...
}
```

### Step 3: Add Boundary to Map
```javascript
useEffect(() => {
  if (!mapInstance) {
    mapInstance = L.map('checkout-map').setView(getTanauanCenter(), 13);
    
    // Add boundaries
    boundaryLayersRef.current = addBoundaryVisualization(mapInstance, {
      showRectangle: true,
      showCenter: true
    });
  }
}, [isOpen, checkoutData.method]);
```

### Step 4: Validate on Location Change
```javascript
marker.on('dragend', async () => {
  const pos = marker.getLatLng();
  const address = await reverseGeocode(pos.lat, pos.lng);
  
  // Validate
  const isValid = locationValidation.validateLocation(
    pos.lat,
    pos.lng,
    address
  );
  
  if (!isValid) {
    // Modal will show automatically
    return;
  }
  
  // Update checkout data
  setCheckoutData(prev => ({
    ...prev,
    lat: pos.lat,
    lng: pos.lng,
    address
  }));
});
```

### Step 5: Add Modal to JSX
```javascript
return (
  <>
    {/* Existing modal content */}
    
    <OutOfCoverageModal
      isOpen={locationValidation.showOutOfCoverageModal}
      errorMessage={locationValidation.errorMessage}
      distanceFromCenter={locationValidation.validationState.distanceFromCenter}
      onClose={locationValidation.clearValidation}
      onRetryMap={() => {
        locationValidation.clearValidation();
        resetMapToTanauan(mapRef.current);
      }}
    />
  </>
);
```

### Step 6: Validate Before Order Submission
```javascript
const handlePlaceOrder = async () => {
  if (checkoutData.method === 'Deliver' && !locationValidation.isLocationValid) {
    alert('Please select a valid delivery address within Tanauan City.');
    return;
  }
  
  // Proceed with order placement
  // ...
};
```

## Validation Logic

The system uses a **two-layer validation approach**:

### Layer 1: Bounding Box (Rectangle)
- Fast rectangular boundary check
- Prevents obviously wrong locations
- Bounds: 13.8850°N to 14.1200°N, 120.9450°E to 121.1100°E

### Layer 2: Circular Geofence
- 8.5km radius from city center
- Covers actual service area
- Center: 14.0735°N, 121.0743°E

**A location is valid only if it passes BOTH checks.**

## Haversine Distance Formula

The system calculates real geographic distance using the Haversine formula:

```
a = sin²(Δφ/2) + cos(φ1) × cos(φ2) × sin²(Δλ/2)
c = 2 × atan2(√a, √(1−a))
d = R × c

Where:
- φ is latitude, λ is longitude, R is earth's radius (6,371 km)
```

## User Experience Flow

1. **User Opens Map**
   - Boundary rectangle displayed (dashed gold line)
   - Map centered on Tanauan City
   - User's current location loaded (if geolocation enabled)

2. **User Selects/Drags Location**
   - Real-time validation triggers
   - Green highlight = Valid location
   - Red highlight = Out of coverage

3. **Invalid Location Selected**
   - Out of Coverage modal appears
   - Shows distance from city center
   - Provides action suggestions
   - User can retry location selection

4. **Valid Location Selected**
   - Address auto-geocoded (reverse)
   - Location saved to checkout state
   - Checkout proceeds normally

## Customization

### Adjust Boundary Coordinates
Edit `TANAUAN_CITY_BOUNDS` in `locationBoundaryUtils.js`:
```javascript
const TANAUAN_CITY_BOUNDS = {
  minLat: 13.8850,    // Change these values
  maxLat: 14.1200,
  minLng: 120.9450,
  maxLng: 121.1100,
  centerLat: 14.0735,
  centerLng: 121.0743,
  radiusKm: 8.5       // Adjust radius
};
```

### Change Boundary Visualization
In `mapBoundaryHelper.js`, modify colors and styles:
```javascript
const rectangle = L.rectangle(bounds, {
  color: '#D4AF37',        // Change to your color
  weight: 2,
  opacity: 0.7,
  fillOpacity: 0.08,
  dashArray: '5, 5'        // Change dash pattern
});
```

### Customize Modal Messages
Edit `OutOfCoverageModal.jsx` text or use custom messages via props.

## Error Handling

The system validates:
- ✅ Latitude range (-90 to 90)
- ✅ Longitude range (-180 to 180)
- ✅ Coordinates within Philippines
- ✅ Bounding box check
- ✅ Circular geofence check

## Performance Considerations

- **Boundary checks**: O(1) constant time
- **Distance calculation**: Single haversine formula execution
- **Map rendering**: Layers cached in refs
- **Geolocation**: Only called once on modal open
- **Reverse geocoding**: Cached, debounced calls recommended

## Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Dependencies

- `react` 16.8+
- `leaflet` 1.7+
- `framer-motion` (for animations)
- `lucide-react` (for icons)

## Testing

Recommended test coordinates:

**Valid Locations (Within Coverage):**
- Tanauan City Center: 14.0735, 121.0743
- Barangay Poblacion: 14.0785, 121.0638
- Barangay Tubigon: 14.0820, 121.0945

**Invalid Locations (Out of Coverage):**
- Tagaytay: 14.1381, 121.0123
- Manila: 14.5995, 120.9842
- Calamba: 14.3691, 121.1701

## Troubleshooting

### Boundary Not Showing
- Check if `addBoundaryVisualization` is called after map creation
- Verify map instance is properly initialized

### Validation Always Fails
- Ensure coordinates are in decimal format (not DMS)
- Check boundary coordinates match actual service area
- Verify geolocation permissions granted

### Reverse Geocoding Slow
- Limit API calls with debouncing
- Cache results in state
- Use nominatim rate limiting

## Future Enhancements

- [ ] Support for multiple delivery zones
- [ ] Dynamic boundary based on inventory
- [ ] Address autocomplete with validation
- [ ] Heat map of orders within zone
- [ ] Boundary adjustment UI for admins
- [ ] Delivery time estimation based on distance
- [ ] Integration with routing API (OSRM)

## Support & Maintenance

For boundary updates or service area changes:
1. Update `TANAUAN_CITY_BOUNDS` coordinates
2. Test with validation coordinates
3. Update map visualization colors if needed
4. Test reverse geocoding with new boundaries

---

**Created**: 2026-07-14
**Last Updated**: 2026-07-14
**Version**: 1.0.0
