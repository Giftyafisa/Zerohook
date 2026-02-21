/**
 * Shared Geographic Utilities
 * 
 * Single source of truth for Haversine distance calculation and coordinate validation.
 * Previously duplicated across LocationTrackingService, MongoRecommendationEngine, 
 * and RealtimeLocationManager.
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number|null} Distance in kilometers, or null if invalid coordinates
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  lat1 = parseFloat(lat1);
  lng1 = parseFloat(lng1);
  lat2 = parseFloat(lat2);
  lng2 = parseFloat(lng2);

  if (!validateCoordinates(lat1, lng1) || !validateCoordinates(lat2, lng2)) {
    return null;
  }

  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Validate that coordinates are within valid ranges
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude  
 * @returns {boolean}
 */
function validateCoordinates(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Convert degrees to radians
 */
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Get simplified grid cell for a coordinate (Uber H3-style bucketing)
 * ~1.1km resolution
 * @param {number} lat 
 * @param {number} lng
 * @param {number} resolution - Grid resolution (default 0.01 = ~1.1km)
 * @returns {string} Grid cell identifier
 */
function getGridCell(lat, lng, resolution = 0.01) {
  const latCell = Math.floor(lat / resolution);
  const lngCell = Math.floor(lng / resolution);
  return `${latCell}_${lngCell}`;
}

/**
 * Get adjacent grid cells (3x3 grid = ~3.3km search radius)
 * @param {string} cell - Center cell identifier
 * @returns {string[]} Array of 9 cell identifiers
 */
function getAdjacentCells(cell) {
  const [latCell, lngCell] = cell.split('_').map(Number);
  const cells = [];
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLng = -1; dLng <= 1; dLng++) {
      cells.push(`${latCell + dLat}_${lngCell + dLng}`);
    }
  }
  return cells;
}

module.exports = {
  haversineDistance,
  validateCoordinates,
  toRad,
  getGridCell,
  getAdjacentCells
};
