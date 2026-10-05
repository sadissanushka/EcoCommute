/**
 * Orthogonal Point-to-Route Distance Calculator
 * Module 4: Safety Layer (Amaraweera MTP - 244015X)
 * 
 * Computes minimum distance (in meters) from a GPS point to a polyline route.
 * Employs local equirectangular Cartesian projection with segment clamping.
 */

const EARTH_RADIUS_M = 6371000.0;

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Standard Haversine distance between two coordinates in meters.
 */
export function haversineDistanceMeters(p1: LatLng, p2: LatLng): number {
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180.0;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180.0;
  const lat1Rad = (p1.lat * Math.PI) / 180.0;
  const lat2Rad = (p2.lat * Math.PI) / 180.0;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

/**
 * Computes shortest distance from point P to polyline L = [ [lng, lat], ... ].
 * Polyline coordinates follow PostGIS/GeoJSON convention: [longitude, latitude].
 */
export function pointToRouteDistanceMeters(
  point: LatLng,
  polylineLngLat: [number, number][],
  searchWindow?: { startIndex: number; windowSize: number }
): { minDistanceMeters: number; nearestSegmentIndex: number; projectedRatio: number } {
  if (!polylineLngLat || polylineLngLat.length === 0) {
    return { minDistanceMeters: 0, nearestSegmentIndex: 0, projectedRatio: 0 };
  }

  if (polylineLngLat.length === 1) {
    const singlePoint: LatLng = { lat: polylineLngLat[0][1], lng: polylineLngLat[0][0] };
    return {
      minDistanceMeters: haversineDistanceMeters(point, singlePoint),
      nearestSegmentIndex: 0,
      projectedRatio: 0,
    };
  }

  const pLatRad = (point.lat * Math.PI) / 180.0;
  const cosLat = Math.cos(pLatRad);
  const mPerDegLat = (Math.PI * EARTH_RADIUS_M) / 180.0;
  const mPerDegLng = mPerDegLat * cosLat;

  let minDistance = Infinity;
  let nearestSegment = 0;
  let bestRatio = 0;

  // Window optimization if tracking consecutive points
  let start = 0;
  let end = polylineLngLat.length - 1;
  if (searchWindow && polylineLngLat.length > 20) {
    start = Math.max(0, searchWindow.startIndex - searchWindow.windowSize);
    end = Math.min(polylineLngLat.length - 1, searchWindow.startIndex + searchWindow.windowSize);
  }

  for (let i = start; i < end; i++) {
    const aLng = polylineLngLat[i][0];
    const aLat = polylineLngLat[i][1];
    const bLng = polylineLngLat[i + 1][0];
    const bLat = polylineLngLat[i + 1][1];

    // Project A and B to local Cartesian meters relative to point P
    const ax = (aLng - point.lng) * mPerDegLng;
    const ay = (aLat - point.lat) * mPerDegLat;
    const bx = (bLng - point.lng) * mPerDegLng;
    const by = (bLat - point.lat) * mPerDegLat;

    const vx = bx - ax;
    const vy = by - ay;
    const vLenSq = vx * vx + vy * vy;

    let t = 0;
    if (vLenSq > 1e-6) {
      // Vector from A to P is (-ax, -ay)
      t = (-ax * vx + -ay * vy) / vLenSq;
      t = Math.max(0, Math.min(1, t)); // clamp to segment bounds [0, 1]
    }

    // Closest point on segment in local coordinates
    const qx = ax + t * vx;
    const qy = ay + t * vy;
    const dist = Math.sqrt(qx * qx + qy * qy);

    if (dist < minDistance) {
      minDistance = dist;
      nearestSegment = i;
      bestRatio = t;
    }
  }

  return {
    minDistanceMeters: Math.round(minDistance * 10) / 10,
    nearestSegmentIndex: nearestSegment,
    projectedRatio: bestRatio,
  };
}
