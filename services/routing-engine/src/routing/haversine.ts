import { LatLng } from '../types/index.js';

const EARTH_RADIUS_METERS = 6371000;

/**
 * Computes great-circle distance between two points in meters using Haversine formula.
 */
export function haversineDistanceMeters(p1: LatLng, p2: LatLng): number {
  const dLat = toRadians(p2.lat - p1.lat);
  const dLng = toRadians(p2.lng - p1.lng);

  const lat1 = toRadians(p1.lat);
  const lat2 = toRadians(p2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
