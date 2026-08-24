/**
 * Location Boundary Utilities for Tanauan City, Batangas
 * Provides geofencing and location validation functions
 */

// Tanauan City precise boundaries (coordinates in decimal degrees)
export const TANAUAN_CITY_BOUNDS = {
  // Bounding box for Tanauan City
  minLat: 13.8850,  // Southern boundary
  maxLat: 14.1200,  // Northern boundary
  minLng: 120.9450, // Western boundary
  maxLng: 121.1100, // Eastern boundary

  // City center (approximate city hall location)
  centerLat: 14.0735,
  centerLng: 121.0743,

  // Radius in kilometers for alternative circular geofence
  radiusKm: 8.5,
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if coordinates are within Tanauan City bounds (bounding box method)
 * More efficient for rectangular regions
 */
export const isWithinBoundingBox = (lat, lng) => {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return false;
  }

  return (
    lat >= TANAUAN_CITY_BOUNDS.minLat &&
    lat <= TANAUAN_CITY_BOUNDS.maxLat &&
    lng >= TANAUAN_CITY_BOUNDS.minLng &&
    lng <= TANAUAN_CITY_BOUNDS.maxLng
  );
};

/**
 * Check if coordinates are within Tanauan City (circular geofence)
 * More accurate for irregular city boundaries
 */
export const isWithinCircularGeofence = (lat, lng) => {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return false;
  }

  const distance = calculateDistance(
    lat,
    lng,
    TANAUAN_CITY_BOUNDS.centerLat,
    TANAUAN_CITY_BOUNDS.centerLng
  );

  return distance <= TANAUAN_CITY_BOUNDS.radiusKm;
};

/**
 * Comprehensive location validation using both methods
 * Returns true only if within BOTH bounding box AND circular geofence
 */
export const isLocationWithinCoverage = (lat, lng) => {
  return isWithinBoundingBox(lat, lng) && isWithinCircularGeofence(lat, lng);
};

/**
 * Get distance from location to city center
 */
export const getDistanceToCenter = (lat, lng) => {
  return calculateDistance(
    lat,
    lng,
    TANAUAN_CITY_BOUNDS.centerLat,
    TANAUAN_CITY_BOUNDS.centerLng
  );
};

/**
 * Validate address string by checking if it contains Tanauan indicators
 * Useful for validating addresses before reverse geocoding
 */
export const isAddressProbablyTanauan = (addressString) => {
  if (!addressString || typeof addressString !== 'string') {
    return false;
  }

  const lowerAddress = addressString.toLowerCase();
  const tanauanIndicators = [
    'tanauan',
    'batangas',
    'tagaytay', // border town, often confused
  ];

  return tanauanIndicators.some((indicator) =>
    lowerAddress.includes(indicator)
  );
};

/**
 * Get human-readable distance message
 */
export const getDistanceMessage = (distanceKm) => {
  if (distanceKm < 1) {
    return `${(distanceKm * 1000).toFixed(0)}m from city center`;
  }
  return `${distanceKm.toFixed(2)}km from city center`;
};

/**
 * Get recommended action for out-of-coverage location
 */
export const getOutOfCoverageMessage = (lat, lng) => {
  const distance = getDistanceToCenter(lat, lng);
  const distanceMsg = getDistanceMessage(distance);

  if (distance < TANAUAN_CITY_BOUNDS.radiusKm + 2) {
    return `Your location is ${distanceMsg}. Just a bit outside our delivery zone. Try a different address.`;
  }

  if (distance < TANAUAN_CITY_BOUNDS.radiusKm + 5) {
    return `Your location is ${distanceMsg}. Outside our delivery area. Please select a location in Tanauan City.`;
  }

  return `Your location is ${distanceMsg}. Unfortunately, we only deliver to Tanauan City.`;
};

/**
 * Get map bounds for focusing on Tanauan City
 * Format: [[minLat, minLng], [maxLat, maxLng]] for Leaflet fitBounds
 */
export const getTanauanMapBounds = () => {
  return [
    [TANAUAN_CITY_BOUNDS.minLat, TANAUAN_CITY_BOUNDS.minLng],
    [TANAUAN_CITY_BOUNDS.maxLat, TANAUAN_CITY_BOUNDS.maxLng],
  ];
};

/**
 * Get center coordinates for Leaflet setView
 */
export const getTanauanCenter = () => {
  return [TANAUAN_CITY_BOUNDS.centerLat, TANAUAN_CITY_BOUNDS.centerLng];
};

/**
 * Validate and sanitize coordinates
 */
export const validateCoordinates = (lat, lng) => {
  // Check if valid numbers
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { valid: false, error: 'Invalid coordinate format' };
  }

  // Check valid latitude range
  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'Latitude out of valid range (-90 to 90)' };
  }

  // Check valid longitude range
  if (lng < -180 || lng > 180) {
    return { valid: false, error: 'Longitude out of valid range (-180 to 180)' };
  }

  // Check if within Philippines approximately
  const inPhilippines = lat >= 5 && lat <= 20 && lng >= 117 && lng <= 127;
  if (!inPhilippines) {
    return { valid: false, error: 'Location outside Philippines' };
  }

  return { valid: true, error: null };
};
