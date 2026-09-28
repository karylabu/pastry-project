/**
 * Location Boundary Utilities for Tanauan City, Batangas
 * Provides geofencing and location validation functions
 */

// Simplified 2020 City of Tanauan, Batangas boundary from GeoBoundaries PHL ADM3.
// Source: NAMRIA/PSA/OCHA Philippines; CC BY 3.0 IGO.
// GeoJSON coordinate order is [longitude, latitude].
export const TANAUAN_CITY_POLYGON = [
  [121.10021844800008, 14.039355850000048],
  [121.10169484300002, 14.042928309000049],
  [121.1037581380001, 14.041838084000062],
  [121.10715756000002, 14.04446517100007],
  [121.12214156300001, 14.046079979000067],
  [121.13630959800003, 14.052849459000072],
  [121.13873800500004, 14.051780996000048],
  [121.14511624500005, 14.056003005000036],
  [121.14564767600007, 14.054900240000052],
  [121.15472638000007, 14.05821121200006],
  [121.16065998400006, 14.066600082000036],
  [121.16116102, 14.070054031000041],
  [121.15917468400004, 14.071764729000051],
  [121.15900211000007, 14.074031289000059],
  [121.15735749600003, 14.079029862000027],
  [121.158462116, 14.079776839000033],
  [121.15462924100007, 14.084376482000041],
  [121.15584567900009, 14.085847021000063],
  [121.15364527800011, 14.088155549000019],
  [121.15207742500002, 14.087425687000064],
  [121.15084378100005, 14.090753698000071],
  [121.14365768900007, 14.094929479000028],
  [121.14149291300009, 14.099055575000024],
  [121.13881542700005, 14.099006745000054],
  [121.13581241100007, 14.101179659000024],
  [121.1352892650001, 14.106025935000048],
  [121.14011747400002, 14.113981798000054],
  [121.1360299480001, 14.117765032000024],
  [121.1317727280001, 14.11873341200004],
  [121.12527363400011, 14.125078217000066],
  [121.12784553100005, 14.127816865000057],
  [121.12580851300004, 14.130757502000051],
  [121.12765622200004, 14.135493077000037],
  [121.12648253900011, 14.139455432000034],
  [121.12784136300002, 14.141019953000068],
  [121.12656254500008, 14.143682287000049],
  [121.12754328900007, 14.145392015000027],
  [121.10234538800012, 14.154389819000071],
  [121.10217525200005, 14.155837033000068],
  [121.05975954500002, 14.153467445000048],
  [121.04538386100012, 14.154943326000023],
  [121.04335015000004, 14.153926470000044],
  [121.05124520200002, 14.14411308800004],
  [121.05916695200006, 14.125434339000035],
  [121.06057402300006, 14.116065836000075],
  [121.05973495900002, 14.105703508000031],
  [121.05219591700006, 14.098346026000058],
  [121.04848771200012, 14.090233214000024],
  [121.05378252700007, 14.088988149000045],
  [121.0548471730001, 14.084521830000028],
  [121.0571063000001, 14.084391995000033],
  [121.05920962500011, 14.086469353000041],
  [121.06473177700002, 14.076664347000076],
  [121.06405276100008, 14.073932527000068],
  [121.06952272500008, 14.068545842000049],
  [121.07142969900008, 14.06453508900006],
  [121.06960665200006, 14.056705604000058],
  [121.06360959400001, 14.046938268000076],
  [121.06319756900007, 14.042793537000025],
  [121.05423350100011, 14.031141341000025],
  [121.05736847800006, 14.027652547000059],
  [121.06093028300006, 14.027532824000048],
  [121.075701481, 14.029366329000029],
  [121.09006050100004, 14.033777960000066],
  [121.10021844800008, 14.039355850000048],
];

// Bounding box of TANAUAN_CITY_POLYGON.
export const TANAUAN_CITY_BOUNDS = {
  minLat: 14.027532824,
  maxLat: 14.155837033000068,
  minLng: 121.043350150000038,
  maxLng: 121.16116102,

  // City center (approximate city hall location)
  centerLat: 14.0735,
  centerLng: 121.0743,

  // Retained for the optional distance visualization; not used for coverage.
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
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
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
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
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

export const isWithinTanauanCity = (lat, lng) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isWithinBoundingBox(lat, lng)) {
    return false;
  }

  let inside = false;

  for (let current = 0, previous = TANAUAN_CITY_POLYGON.length - 1; current < TANAUAN_CITY_POLYGON.length; previous = current++) {
    const [currentLng, currentLat] = TANAUAN_CITY_POLYGON[current];
    const [previousLng, previousLat] = TANAUAN_CITY_POLYGON[previous];
    const cross = (lng - currentLng) * (previousLat - currentLat) - (lat - currentLat) * (previousLng - currentLng);
    const onSegment = Math.abs(cross) < 1e-10 &&
      lng >= Math.min(currentLng, previousLng) - 1e-10 &&
      lng <= Math.max(currentLng, previousLng) + 1e-10 &&
      lat >= Math.min(currentLat, previousLat) - 1e-10 &&
      lat <= Math.max(currentLat, previousLat) + 1e-10;

    if (onSegment) return true;

    const crossesLatitude = (currentLat > lat) !== (previousLat > lat);
    const crossingLng = ((previousLng - currentLng) * (lat - currentLat)) / (previousLat - currentLat) + currentLng;
    if (crossesLatitude && lng < crossingLng) inside = !inside;
  }

  return inside;
};

export const isLocationWithinCoverage = (lat, lng) => isWithinTanauanCity(lat, lng);

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
  return `Your location is ${distanceMsg} from Tanauan City Center and outside the delivery boundary. Please select an address within Tanauan City.`;
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
