// Geographic projection utilities for the 3D ocean
// Supports both flat plane (Indian Ocean domain) and spherical (Earth) projections.

import * as THREE from 'three';

export const DOMAIN = {
  latMin: -5,
  latMax: 25,
  lonMin: 55,
  lonMax: 100,
};

// ─── Spherical / Earth coordinate system ────────────────────────────────────

/**
 * Map lon/lat to a 3D position on a sphere of given radius.
 * Standard geographic coordinates: latitude [-90,90], longitude [-180,180]
 *
 * Coordinate system (camera looking from +Z toward origin):
 *   +Y = North Pole (up)
 *   +Z = 0° longitude (Prime Meridian, toward camera)
 *   +X = 90°E (east, to the right when viewing from +Z)
 *   -X = 90°W (west, to the left when viewing from +Z)
 */
export function lonLatToVec3(lon: number, lat: number, radius = 1): THREE.Vector3 {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  return new THREE.Vector3(
    radius * Math.cos(latRad) * Math.sin(lonRad), // X: 90°E → +X (right), 90°W → -X (left)
    radius * Math.sin(latRad),                    // Y: +90° (North) → +Y, -90° (South) → -Y
    radius * Math.cos(latRad) * Math.cos(lonRad)  // Z: 0° lon → +Z (toward camera)
  );
}

/**
 * Convert a 3D position on a sphere to lon/lat.
 */
export function vec3ToLonLat(vec: THREE.Vector3): { lon: number; lat: number } {
  const r = vec.length();
  const lat = Math.asin(Math.max(-1, Math.min(1, vec.y / r))) * (180 / Math.PI);
  const lon = Math.atan2(vec.z, vec.x) * (180 / Math.PI);
  return { lon, lat };
}

/**
 * Compute great-circle distance between two points on Earth (in km).
 */
export function greatCircleDistance(
  lon1: number, lat1: number,
  lon2: number, lat2: number,
  radiusKm = 6371
): number {
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const sinLat1 = Math.sin(lat1Rad), cosLat1 = Math.cos(lat1Rad);
  const sinLat2 = Math.sin(lat2Rad), cosLat2 = Math.cos(lat2Rad);
  const cosDLon = Math.cos(dLon);
  const a = sinLat1 * sinLat2 + cosLat1 * cosLat2 * cosDLon;
  return radiusKm * Math.acos(Math.max(-1, Math.min(1, a)));
}

// ─── Flat plane coordinate system (legacy / HUD) ────────────────────────────

// Map lon/lat to normalized [-1, 1] coordinates within the domain
export function lonLatToXY(lon: number, lat: number): { x: number; y: number } {
  const x = ((lon - DOMAIN.lonMin) / (DOMAIN.lonMax - DOMAIN.lonMin)) * 2 - 1;
  // Flip so north is up
  const y = (1 - (lat - DOMAIN.latMin) / (DOMAIN.latMax - DOMAIN.latMin)) * 2 - 1;
  return { x, y };
}

export function xyToLonLat(x: number, y: number): { lon: number; lat: number } {
  const lon = ((x + 1) / 2) * (DOMAIN.lonMax - DOMAIN.lonMin) + DOMAIN.lonMin;
  const lat = (1 - (y + 1) / 2) * (DOMAIN.latMax - DOMAIN.latMin) + DOMAIN.latMin;
  return { lon, lat };
}

export function depthToZ(depth: number, verticalExaggeration = 1): number {
  // Depth in meters → scene Z. We use a logarithmic scale to fit dynamic range.
  // Surface = 0, deep water (4000m) ≈ -1.0
  const maxDepth = 4000;
  const t = Math.min(depth / maxDepth, 1);
  // Compress: surface to ~250m is small, deep ocean is large
  const compressed = Math.pow(t, 0.5);
  return -compressed * verticalExaggeration;
}

export function zToDepth(z: number, verticalExaggeration = 1): number {
  const t = -z / verticalExaggeration;
  return Math.pow(t, 2) * 4000;
}

// ─── Sphere depth (radial offset) ─────────────────────────────────────────────

/**
 * Convert depth in meters to a radial offset from Earth's surface.
 * For a sphere of radius R, a depth slice at `depth` meters appears at radius R + offset.
 * The offset is scaled so 4000m depth ≈ 0.05 radial units.
 */
export const SPHERE_MAX_DEPTH_OFFSET = 0.05; // radial units for deepest ocean

export function depthToSphereOffset(depth: number): number {
  if (depth <= 0) return 0;
  const t = Math.pow(Math.min(depth / 4000, 1), 0.5);
  return t * SPHERE_MAX_DEPTH_OFFSET;
}

export function sphereOffsetToDepth(offset: number): number {
  const t = offset / SPHERE_MAX_DEPTH_OFFSET;
  return Math.pow(t, 2) * 4000;
}

// ─── Geographic data for Earth rendering ──────────────────────────────────────

/** Simplified major ocean basin polygon boundaries (lon/lat rings) */
export const OCEAN_BASINS = {
  indian: {
    name: 'Indian Ocean',
    bounds: { latMin: -40, latMax: 30, lonMin: 20, lonMax: 120 },
  },
  pacific: {
    name: 'Pacific Ocean',
    bounds: { latMin: -60, latMax: 65, lonMin: 100, lonMax: 280 },
  },
  atlantic: {
    name: 'Atlantic Ocean',
    bounds: { latMin: -60, latMax: 70, lonMin: -80, lonMax: 0 },
  },
  arctic: {
    name: 'Arctic Ocean',
    bounds: { latMin: 66.5, latMax: 90, lonMin: -180, lonMax: 180 },
  },
  southern: {
    name: 'Southern Ocean',
    bounds: { latMin: -90, latMax: -60, lonMin: -180, lonMax: 180 },
  },
} as const;

/** Key latitudes (for grid highlights) */
export const KEY_LATITUDES = [
  { lat: 0, label: 'Equator' },
  { lat: 23.5, label: 'Tropic of Cancer' },
  { lat: -23.5, label: 'Tropic of Capricorn' },
  { lat: 66.5, label: 'Arctic Circle' },
  { lat: -66.5, label: 'Antarctic Circle' },
];

/** Key longitudes (for grid highlights) */
export const KEY_LONGITUDES = [
  { lon: 0, label: 'Prime Meridian' },
  { lon: 72.5, label: 'INCOIS Region' },
  { lon: 90, label: '' },
  { lon: 120, label: '' },
  { lon: -120, label: '' },
  { lon: 180, label: 'Date Line' },
];

// India outline (very simplified). Real dataset would replace this.
export const INDIA_OUTLINE: [number, number][] = [
  // [lon, lat]
  [68, 8], [70, 6], [72, 7], [73, 14], [76, 8], [77, 22], [78, 23],
  [80, 22], [82, 19], [83, 17], [85, 19], [86, 20], [87, 21], [88, 21],
  [89, 22], [90, 22], [91, 22], [92, 21], [94, 16], [96, 17],
  [98, 12], [97, 9], [93, 8], [90, 22], [80, 13], [73, 8], [68, 8],
];

export const SRI_LANKA: [number, number][] = [
  [80, 6], [81, 6], [82, 7], [81, 9], [80, 9], [80, 6],
];

// Major reference points
export const REFERENCE_POINTS: { name: string; lon: number; lat: number }[] = [
  { name: 'Mumbai', lon: 72.88, lat: 19.08 },
  { name: 'Chennai', lon: 80.27, lat: 13.08 },
  { name: 'Kochi', lon: 76.27, lat: 9.97 },
  { name: 'Visakhapatnam', lon: 83.30, lat: 17.69 },
  { name: 'Goa', lon: 73.83, lat: 15.50 },
  { name: 'Port Blair', lon: 92.74, lat: 11.62 },
  { name: 'Male', lon: 73.51, lat: 4.18 },
  { name: 'Colombo', lon: 79.86, lat: 6.93 },
  { name: 'Diego Garcia', lon: 72.37, lat: -7.31 },
];
