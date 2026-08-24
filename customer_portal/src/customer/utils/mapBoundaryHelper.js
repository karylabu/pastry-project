/**
 * Map Boundary Overlay Component
 * Displays Tanauan City boundary on Leaflet map
 * Can be used independently or integrated with CheckoutModal
 */

import L from 'leaflet';
import { TANAUAN_CITY_BOUNDS, getTanauanMapBounds } from '../utils/locationBoundaryUtils';

/**
 * Create boundary rectangle for Leaflet map
 * Shows Tanauan City coverage area
 */
export const createBoundaryRectangle = (map) => {
  const bounds = getTanauanMapBounds();

  const rectangle = L.rectangle(bounds, {
    color: '#D4AF37', // Gold color to match app theme
    weight: 2,
    opacity: 0.7,
    fill: true,
    fillColor: '#D4AF37',
    fillOpacity: 0.08,
    dashArray: '5, 5', // Dashed border
  }).addTo(map);

  return rectangle;
};

/**
 * Create circular geofence around city center
 * Visual representation of circular coverage area
 */
export const createCircularGeofence = (map) => {
  const circle = L.circle(
    [TANAUAN_CITY_BOUNDS.centerLat, TANAUAN_CITY_BOUNDS.centerLng],
    {
      radius: TANAUAN_CITY_BOUNDS.radiusKm * 1000, // Convert km to meters
      color: '#0066cc',
      weight: 2,
      opacity: 0.5,
      fill: true,
      fillColor: '#0066cc',
      fillOpacity: 0.05,
      dashArray: '10, 5',
    }
  ).addTo(map);

  return circle;
};

/**
 * Create center point marker
 * Shows Tanauan City center/hub location
 */
export const createCenterMarker = (map) => {
  const centerMarker = L.circleMarker(
    [TANAUAN_CITY_BOUNDS.centerLat, TANAUAN_CITY_BOUNDS.centerLng],
    {
      radius: 4,
      color: '#D4AF37',
      weight: 2,
      opacity: 1,
      fill: true,
      fillColor: '#D4AF37',
      fillOpacity: 0.8,
    }
  ).addTo(map);

  centerMarker.bindPopup('<strong>Tanauan City Center</strong>', {
    className: 'boundary-popup',
  });

  return centerMarker;
};

/**
 * Add all boundary visualizations to map
 */
export const addBoundaryVisualization = (map, options = {}) => {
  const { showRectangle = true, showCircle = false, showCenter = true } = options;

  const layers = {
    rectangle: null,
    circle: null,
    center: null,
  };

  if (showRectangle) {
    layers.rectangle = createBoundaryRectangle(map);
  }

  if (showCircle) {
    layers.circle = createCircularGeofence(map);
  }

  if (showCenter) {
    layers.center = createCenterMarker(map);
  }

  return {
    ...layers,
    remove: () => {
      Object.values(layers).forEach((layer) => {
        if (layer && map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
    },
  };
};

/**
 * Highlight a location on the map with visual feedback
 */
export const highlightLocation = (map, lat, lng, isValid) => {
  const markerColor = isValid ? '#22c55e' : '#ef4444';
  const haloColor = isValid ? '#dcfce7' : '#fee2e2';

  const haloCircle = L.circleMarker([lat, lng], {
    radius: 25,
    color: markerColor,
    weight: 2,
    opacity: 0.4,
    fill: true,
    fillColor: haloColor,
    fillOpacity: 0.3,
    interactive: false,
  }).addTo(map);

  const centerDot = L.circleMarker([lat, lng], {
    radius: 6,
    color: markerColor,
    weight: 2,
    opacity: 1,
    fill: true,
    fillColor: '#fff',
    fillOpacity: 1,
    interactive: false,
  }).addTo(map);

  return {
    halo: haloCircle,
    center: centerDot,
    remove: () => {
      map.removeLayer(haloCircle);
      map.removeLayer(centerDot);
    },
  };
};

/**
 * Pan and zoom map to focus on Tanauan City
 */
export const focusOnTanauan = (map, zoomLevel = 13) => {
  const bounds = getTanauanMapBounds();
  map.fitBounds(bounds, { padding: [50, 50], maxZoom: zoomLevel });
};

/**
 * Reset map to default Tanauan view
 */
export const resetMapToTanauan = (map) => {
  const center = [TANAUAN_CITY_BOUNDS.centerLat, TANAUAN_CITY_BOUNDS.centerLng];
  map.setView(center, 13);
};

export default {
  createBoundaryRectangle,
  createCircularGeofence,
  createCenterMarker,
  addBoundaryVisualization,
  highlightLocation,
  focusOnTanauan,
  resetMapToTanauan,
};
