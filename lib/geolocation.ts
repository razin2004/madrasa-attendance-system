/**
 * Earth radius in meters (WGS-84 mean radius)
 */
const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate the great-circle distance between two geographic coordinates in meters
 * using the Haversine formula.
 *
 * @param lat1 Latitude of point 1 (degrees)
 * @param lon1 Longitude of point 1 (degrees)
 * @param lat2 Latitude of point 2 (degrees)
 * @param lon2 Longitude of point 2 (degrees)
 * @returns Distance in meters
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c * 100) / 100; // Round to 2 decimal places
}

export interface GeofenceCheckResult {
  isWithin: boolean;
  distanceMeters: number;
  radiusMeters: number;
  accuracyMeters?: number;
  marginMeters: number; // Difference: radius - distance (positive means inside)
  failureReason?: string;
}

/**
 * Check if coordinates fall within the configured geofence radius.
 * Strict Geofence Boundary Decision (Section 15, 16, 17, 18, 19):
 * - distance <= radiusMeters -> PASS
 * - distance > radiusMeters  -> FAIL
 * - accuracyMeters exceeds max threshold -> FAIL ("Location accuracy is too low to verify your attendance.")
 */
export function isWithinGeofence(
  staffLat: number,
  staffLng: number,
  branchLat: number,
  branchLng: number,
  radiusMeters: number,
  accuracyMeters?: number
): GeofenceCheckResult {
  const distanceMeters = calculateDistanceMeters(staffLat, staffLng, branchLat, branchLng);
  const marginMeters = Math.round((radiusMeters - distanceMeters) * 100) / 100;

  // Check GPS accuracy threshold (Section 18 & 19)
  // If location accuracy is too poor (e.g. 500m accuracy for 150m radius)
  const maxAllowedAccuracy = 150000;
  if (accuracyMeters !== undefined && accuracyMeters > maxAllowedAccuracy) {
    return {
      isWithin: false,
      distanceMeters,
      radiusMeters,
      accuracyMeters,
      marginMeters,
      failureReason: 'Location accuracy is too low to verify your attendance.',
    };
  }

  // Strict boundary rule: distance <= configuredRadius
  const isWithin = distanceMeters <= radiusMeters;

  return {
    isWithin,
    distanceMeters,
    radiusMeters,
    accuracyMeters,
    marginMeters,
    failureReason: isWithin ? undefined : `Location is ${distanceMeters}m from branch (exceeds ${radiusMeters}m geofence radius).`,
  };
}

/**
 * Validate latitude (-90 to 90) and longitude (-180 to 180)
 */
export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
