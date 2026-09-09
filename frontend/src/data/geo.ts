/**
 * Real-world geographic data from Natural Earth (public domain).
 * Source: https://www.naturalearthdata.com/
 *
 * - ne_110m_coastline.json       — low-resolution coastlines (LineString)
 * - ne_110m_admin_0_countries.json — low-resolution country polygons
 *
 * Both files are in standard GeoJSON (lon, lat) order and are loaded
 * lazily by Vite so they do not bloat the initial bundle.
 */
import coastlineRaw from './ne_110m_coastline.json';
import countriesRaw from './ne_110m_admin_0_countries.json';

export interface GeoLineString {
  type: 'LineString';
  coordinates: [number, number][];
}
export interface GeoPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}
export interface GeoMultiPolygon {
  type: 'MultiPolygon';
  coordinates: [number, number][][][];
}
export interface GeoFeature<G = GeoLineString | GeoPolygon | GeoMultiPolygon> {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: G;
  bbox?: [number, number, number, number];
}
export interface FeatureCollection<G = any> {
  type: 'FeatureCollection';
  name?: string;
  features: GeoFeature<G>[];
}

export const COASTLINE: FeatureCollection<GeoLineString> = coastlineRaw as any;
export const COUNTRIES: FeatureCollection<GeoPolygon | GeoMultiPolygon> = countriesRaw as any;

/** Walk any geometry variant to a list of (lon,lat) rings. */
export function extractRings(
  geom: GeoLineString | GeoPolygon | GeoMultiPolygon
): [number, number][][] {
  if (geom.type === 'LineString') return [geom.coordinates as [number, number][]];
  if (geom.type === 'Polygon') return geom.coordinates as [number, number][][];
  if (geom.type === 'MultiPolygon') {
    return (geom.coordinates as [number, number][][][]).flat();
  }
  return [];
}

// ─── Spatial grid index for fast point-in-polygon queries ───────────────────────

/** Grid cell key for spatial hashing. */
function gridKey(lon: number, lat: number, cellDeg: number): string {
  return `${Math.floor(lon / cellDeg)},${Math.floor(lat / cellDeg)}`;
}

/** True if (px,py) is inside the polygon ring using ray casting. */
function pointInRing(
  px: number,
  py: number,
  ring: [number, number][]
): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Build a spatial hash of country polygons keyed by grid cell.
 *  Each polygon is stored under every cell it overlaps. */
function buildCountryIndex(cellDeg: number): Map<string, [number, number][][]> {
  const index = new Map<string, [number, number][][]>();
  for (const feat of COUNTRIES.features) {
    const rings = extractRings(feat.geometry as GeoPolygon | GeoMultiPolygon);
    if (!rings.length) continue;
    // Bounding box of the polygon
    let minLon = Infinity,
      maxLon = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const ring of rings) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
    const gMinLon = Math.floor(minLon / cellDeg);
    const gMaxLon = Math.floor(maxLon / cellDeg);
    const gMinLat = Math.floor(minLat / cellDeg);
    const gMaxLat = Math.floor(maxLat / cellDeg);
    for (let gx = gMinLon; gx <= gMaxLon; gx++) {
      for (let gy = gMinLat; gy <= gMaxLat; gy++) {
        const key = `${gx},${gy}`;
        const existing = index.get(key);
        if (existing) {
          existing.push(...rings);
        } else {
          index.set(key, [...rings]);
        }
      }
    }
  }
  return index;
}

// 10-degree grid gives ~324 cells, each holding a handful of country polygons.
// Point lookup is O(candidates) where candidates ≈ countries touching that cell.
const COUNTRY_INDEX = buildCountryIndex(10);
const CELL_DEG = 10;

/**
 * Returns true if the given (lat, lon) point is over ocean (water),
 * false if it is over land.
 *
 * Uses ray casting on the Natural Earth country polygons with a 10-degree
 * spatial grid for fast candidate lookup. Points on the coastline boundary
 * are treated as ocean (valid water observations).
 */
export function isOverOcean(lat: number, lon: number): boolean {
  // Wrap longitude into [-180, 180]
  let wrappedLon = ((lon + 180) % 360 + 360) % 360 - 180;
  const cell = COUNTRY_INDEX.get(gridKey(wrappedLon, lat, CELL_DEG));
  if (!cell) return true; // no country polygons overlap this cell → ocean

  for (const ring of cell) {
    if (pointInRing(wrappedLon, lat, ring)) {
      return false; // inside land polygon
    }
  }
  return true; // checked all candidates, none matched → ocean
}
