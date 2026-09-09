// Region configurations extracted from backend synthetic.py
// Each region has its own lat/lon bounds and climatology

export interface RegionDomain {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface RegionConfig {
  id: string;
  name: string;
  domain: RegionDomain;
  /** Camera center lat/lon */
  center: { lat: number; lon: number };
  /** Vertical FOV in degrees for this region */
  fov?: number;
}

export const REGION_CONFIGS: RegionConfig[] = [
  {
    id: 'world',
    name: 'Whole World',
    domain: { minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 },
    center: { lat: 0, lon: 0 },
    fov: 50,
  },
  {
    id: 'indian_ocean',
    name: 'Indian Ocean',
    domain: { minLat: -60, maxLat: 30, minLon: 20, maxLon: 120 },
    center: { lat: -15, lon: 70 },
    fov: 48,
  },
  {
    id: 'arabian_sea',
    name: 'Arabian Sea',
    domain: { minLat: 8, maxLat: 25, minLon: 55, maxLon: 78 },
    center: { lat: 16.5, lon: 66.5 },
    fov: 35,
  },
  {
    id: 'bay_of_bengal',
    name: 'Bay of Bengal',
    domain: { minLat: 5, maxLat: 22, minLon: 80, maxLon: 100 },
    center: { lat: 13.5, lon: 90 },
    fov: 35,
  },
  {
    id: 'somali_jet',
    name: 'Somali Jet',
    domain: { minLat: -5, maxLat: 20, minLon: 45, maxLon: 78 },
    center: { lat: 8, lon: 60 },
    fov: 40,
  },
  {
    id: 'equatorial_jet',
    name: 'Equatorial Jet',
    domain: { minLat: -5, maxLat: 10, minLon: 50, maxLon: 100 },
    center: { lat: 2, lon: 75 },
    fov: 45,
  },
  {
    id: 'pacific_ocean',
    name: 'Pacific Ocean',
    domain: { minLat: -30, maxLat: 50, minLon: 120, maxLon: 260 },
    center: { lat: 10, lon: 190 },
    fov: 50,
  },
  {
    id: 'atlantic_ocean',
    name: 'Atlantic Ocean',
    domain: { minLat: -40, maxLat: 65, minLon: -75, maxLon: 5 },
    center: { lat: 12.5, lon: -35 },
    fov: 50,
  },
  {
    id: 'southern_ocean',
    name: 'Southern Ocean',
    domain: { minLat: -75, maxLat: -45, minLon: -180, maxLon: 180 },
    center: { lat: -60, lon: 0 },
    fov: 45,
  },
  {
    id: 'arctic_ocean',
    name: 'Arctic Ocean',
    domain: { minLat: 65, maxLat: 88, minLon: -180, maxLon: 180 },
    center: { lat: 76.5, lon: 0 },
    fov: 45,
  },
];

/**
 * Format a latitude value with hemisphere indicator
 * e.g., 10 → "10°N", -10 → "10°S", 0 → "0°"
 */
export function formatLat(lat: number): string {
  if (lat > 0) return `${lat}°N`;
  if (lat < 0) return `${Math.abs(lat)}°S`;
  return '0°';
}

/**
 * Format a longitude value with hemisphere indicator
 * For display in ranges, we distinguish -180 as "180°W" and 180 as "180°E"
 * e.g., 72 → "72°E", -72 → "72°W", -180 → "180°W", 180 → "180°E"
 */
export function formatLon(lon: number): string {
  if (lon > 0 && lon < 180) return `${lon}°E`;
  if (lon < 0 && lon > -180) return `${Math.abs(lon)}°W`;
  if (lon === 180) return '180°E';
  if (lon === -180) return '180°W';
  return `${lon}°`;
}

/**
 * Format a region domain bounds as a human-readable string.
 * e.g., "55°E–100°E · 5°S–25°N"
 */
export function formatRegionBounds(domain: RegionDomain): string {
  const lonStr = `${formatLon(domain.minLon)}–${formatLon(domain.maxLon)}`;
  const latStr = `${formatLat(domain.minLat)}–${formatLat(domain.maxLat)}`;
  return `${lonStr} · ${latStr}`;
}

/**
 * True if a (lat, lon) point lies within a region's bounding domain.
 */
export function isInsideDomain(lat: number, lon: number, domain: RegionDomain): boolean {
  return lat >= domain.minLat && lat <= domain.maxLat && lon >= domain.minLon && lon <= domain.maxLon;
}

/**
 * Get the center coordinates for a region by its ID
 */
export function getRegionCenter(regionId: string): { lat: number; lon: number } | null {
  const region = REGION_CONFIGS.find(r => r.id === regionId);
  return region ? region.center : null;
}

/**
 * Get the display name for a region by its ID
 */
export function getRegionName(regionId: string): string {
  const region = REGION_CONFIGS.find(r => r.id === regionId);
  return region ? region.name : regionId;
}

/**
 * Get a region config by its ID
 */
export function getRegionConfig(regionId: string): RegionConfig | undefined {
  return REGION_CONFIGS.find(r => r.id === regionId);
}
