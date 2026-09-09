import type { OceanField } from '@/types';

/**
 * Bilinear interpolation of a field grid at a (lat, lon) point.
 * Returns null if the point is outside the grid or any corner is NaN.
 */
export function sampleFieldValue(field: OceanField | null, lat: number, lon: number): number | null {
  if (!field) return null;
  const lats = field.latitude;
  const lons = field.longitude;
  if (lat < lats[0] || lat > lats[lats.length - 1]) return null;
  if (lon < lons[0] || lon > lons[lons.length - 1]) return null;

  let i0 = 0, i1 = 0, j0 = 0, j1 = 0;
  for (let i = 0; i < lats.length - 1; i++) {
    if (lats[i] <= lat && lats[i + 1] >= lat) { i0 = i; i1 = i + 1; break; }
  }
  for (let j = 0; j < lons.length - 1; j++) {
    if (lons[j] <= lon && lons[j + 1] >= lon) { j0 = j; j1 = j + 1; break; }
  }

  const t = (lat - lats[i0]) / (lats[i1] - lats[i0] + 1e-9);
  const u = (lon - lons[j0]) / (lons[j1] - lons[j0] + 1e-9);
  const v00 = field.data[i0]?.[j0] ?? NaN;
  const v01 = field.data[i0]?.[j1] ?? NaN;
  const v10 = field.data[i1]?.[j0] ?? NaN;
  const v11 = field.data[i1]?.[j1] ?? NaN;
  if ([v00, v01, v10, v11].some(isNaN)) return null;
  return v00 * (1 - t) * (1 - u) + v01 * (1 - t) * u + v10 * t * (1 - u) + v11 * t * u;
}