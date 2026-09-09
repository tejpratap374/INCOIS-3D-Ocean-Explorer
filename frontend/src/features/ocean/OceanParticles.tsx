import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useOceanStore } from '@/stores/oceanStore';
import { lonLatToVec3 } from '@/utils/geo';
import { isOverOcean } from '@/data/geo';
import * as THREE from 'three';

const STREAMLINE_COUNT = 3200;
const DOMAIN = { latMin: -60, latMax: 45, lonMin: 15, lonMax: 135 };

interface StreamlineParticle {
  lon: number;
  lat: number;
  prevLon: number;
  prevLat: number;
  life: number;
  maxLife: number;
}

/** Precomputed 0.25-degree spatial land mask derived from Natural Earth country polygons */
const MASK_RES = 4; // 4 samples per degree (0.25 deg resolution)
const LAT_MIN = -90, LAT_MAX = 90;
const LON_MIN = -180, LON_MAX = 180;
const LAT_BINS = (LAT_MAX - LAT_MIN) * MASK_RES; // 720
const LON_BINS = (LON_MAX - LON_MIN) * MASK_RES; // 1440
const LAND_MASK = new Uint8Array(LAT_BINS * LON_BINS);

let maskInitialized = false;
function getLandMask(): Uint8Array {
  if (!maskInitialized) {
    for (let r = 0; r < LAT_BINS; r++) {
      const lat = LAT_MIN + (r + 0.5) / MASK_RES;
      for (let c = 0; c < LON_BINS; c++) {
        const lon = LON_MIN + (c + 0.5) / MASK_RES;
        // isOverOcean(lat, lon) returns true for ocean, false for land
        if (!isOverOcean(lat, lon)) {
          LAND_MASK[r * LON_BINS + c] = 1; // 1 = land
        }
      }
    }
    maskInitialized = true;
  }
  return LAND_MASK;
}

/** Fast O(1) geographic land boundary check with 0.25-degree precision */
function isLandFast(lon: number, lat: number): boolean {
  if (lat < LAT_MIN || lat > LAT_MAX || lon < LON_MIN || lon > LON_MAX) return true;
  const mask = getLandMask();
  let wLon = ((lon + 180) % 360 + 360) % 360 - 180;
  const r = Math.floor((lat - LAT_MIN) * MASK_RES);
  const c = Math.floor((wLon - LON_MIN) * MASK_RES);
  const rClamped = Math.min(LAT_BINS - 1, Math.max(0, r));
  const cClamped = Math.min(LON_BINS - 1, Math.max(0, c));
  return mask[rClamped * LON_BINS + cClamped] === 1;
}

/** Pre-processed 2D grid index for bilinear vector field sampling */
interface VectorGridIndex {
  lats: number[];
  lons: number[];
  uGrid: number[][];
  vGrid: number[][];
}

function buildVectorGridIndex(vectorField: any): VectorGridIndex | null {
  if (!vectorField?.vectors || vectorField.vectors.length === 0) return null;

  const latSet = new Set<number>();
  const lonSet = new Set<number>();

  for (const v of vectorField.vectors) {
    latSet.add(v.lat);
    lonSet.add(v.lon);
  }

  const lats = Array.from(latSet).sort((a, b) => a - b);
  const lons = Array.from(lonSet).sort((a, b) => a - b);

  const nlat = lats.length;
  const nlon = lons.length;
  if (nlat < 2 || nlon < 2) return null;

  const uGrid: number[][] = Array.from({ length: nlat }, () => Array(nlon).fill(0));
  const vGrid: number[][] = Array.from({ length: nlat }, () => Array(nlon).fill(0));

  const latMap = new Map(lats.map((lat, i) => [lat, i]));
  const lonMap = new Map(lons.map((lon, j) => [lon, j]));

  for (const vec of vectorField.vectors) {
    const i = latMap.get(vec.lat);
    const j = lonMap.get(vec.lon);
    if (i !== undefined && j !== undefined) {
      uGrid[i][j] = vec.u;
      vGrid[i][j] = vec.v;
    }
  }

  return { lats, lons, uGrid, vGrid };
}

/**
 * Continuous bilinear velocity interpolation across model grid nodes.
 * Falls back to smooth analytical Indian Ocean circulation if vector grid is loading.
 */
function sampleVelocityBilinear(
  lon: number,
  lat: number,
  grid: VectorGridIndex | null
): { u: number; v: number } {
  if (grid) {
    const { lats, lons, uGrid, vGrid } = grid;
    const nlat = lats.length;
    const nlon = lons.length;

    if (lat >= lats[0] && lat <= lats[nlat - 1] && lon >= lons[0] && lon <= lons[nlon - 1]) {
      // Find grid cell (i0, j0)
      let i0 = 0;
      while (i0 < nlat - 2 && lats[i0 + 1] <= lat) i0++;
      let j0 = 0;
      while (j0 < nlon - 2 && lons[j0 + 1] <= lon) j0++;

      const i1 = i0 + 1;
      const j1 = j0 + 1;

      const lat0 = lats[i0], lat1 = lats[i1];
      const lon0 = lons[j0], lon1 = lons[j1];

      const fy = (lat - lat0) / Math.max(1e-5, lat1 - lat0);
      const fx = (lon - lon0) / Math.max(1e-5, lon1 - lon0);

      const u00 = uGrid[i0][j0], u10 = uGrid[i0][j1];
      const u01 = uGrid[i1][j0], u11 = uGrid[i1][j1];

      const v00 = vGrid[i0][j0], v10 = vGrid[i0][j1];
      const v01 = vGrid[i1][j0], v11 = vGrid[i1][j1];

      const uTop = u00 + (u10 - u00) * fx;
      const uBot = u01 + (u11 - u01) * fx;
      const u = (uTop + (uBot - uTop) * fy) * 0.75;

      const vTop = v00 + (v10 - v00) * fx;
      const vBot = v01 + (v11 - v01) * fx;
      const v = (vTop + (vBot - vTop) * fy) * 0.75;

      return { u, v };
    }
  }

  // Smooth analytical flow model for Indian Ocean
  let u = 0.35;
  let v = 0.0;

  // 1. South Equatorial Current (Westward)
  if (lat >= -25 && lat <= -10) {
    u = -0.85 - 0.35 * Math.cos((lat + 17.5) * 0.22);
    v = -0.12 * Math.sin(lon * 0.05);
  }
  // 2. Equatorial Counter Current (Eastward)
  else if (lat >= -5 && lat <= 5) {
    u = 0.95 + 0.35 * Math.sin(lon * 0.08);
    v = 0.12 * Math.cos(lat * 0.2);
  }
  // 3. Somali Current Jet (Northward)
  else if (lon >= 38 && lon <= 55 && lat >= -10 && lat <= 15) {
    u = 0.45;
    v = 1.25 + 0.35 * Math.sin(lat * 0.15);
  }
  // 4. Bay of Bengal Gyre (Clockwise)
  else if (lon >= 80 && lon <= 98 && lat >= 5 && lat <= 22) {
    const dx = lon - 89.0;
    const dy = lat - 13.5;
    u = -dy * 0.07;
    v = dx * 0.07;
  }
  // 5. Agulhas Current (Southward)
  else if (lon >= 20 && lon <= 40 && lat >= -40 && lat <= -25) {
    u = -0.35;
    v = -1.1;
  }
  // 6. West Australian Current (Northward)
  else if (lon >= 105 && lon <= 125 && lat >= -35 && lat <= -15) {
    u = -0.25;
    v = 0.65;
  }

  const turb = Math.sin(lon * 0.18 + lat * 0.25) * 0.12;
  return { u: u + turb, v: v + turb * 0.5 };
}

export function OceanParticles() {
  const showParticles = useOceanStore((s) => s.showParticles);
  const vectorField = useOceanStore((s) => s.vectorField);
  const playbackSpeed = useOceanStore((s) => s.playbackSpeed);

  // Particles render for all active variables when particle toggle is on
  const shouldRender = showParticles;

  const lineRef = useRef<THREE.LineSegments>(null);
  const positionsRef = useRef<Float32Array>(new Float32Array(STREAMLINE_COUNT * 6));
  const colorsRef = useRef<Float32Array>(new Float32Array(STREAMLINE_COUNT * 6));
  const particles = useRef<StreamlineParticle[]>([]);

  // Build grid index for bilinear velocity sampling
  const vectorGridIndex = useMemo(() => {
    return buildVectorGridIndex(vectorField);
  }, [vectorField]);

  // Initialize particles with staggered lifespans across valid ocean coordinates
  const initialized = useRef(false);
  if (!initialized.current) {
    for (let i = 0; i < STREAMLINE_COUNT; i++) {
      let rlon = 0, rlat = 0;
      let attempts = 0;
      do {
        rlon = DOMAIN.lonMin + Math.random() * (DOMAIN.lonMax - DOMAIN.lonMin);
        rlat = DOMAIN.latMin + Math.random() * (DOMAIN.latMax - DOMAIN.latMin);
        attempts++;
      } while (isLandFast(rlon, rlat) && attempts < 100);

      const maxLife = 120 + Math.random() * 140;
      particles.current.push({
        lon: rlon,
        lat: rlat,
        prevLon: rlon,
        prevLat: rlat,
        life: Math.random() * maxLife, // Staggered initial life
        maxLife,
      });
    }
    initialized.current = true;
  }

  useFrame(() => {
    if (!lineRef.current || !shouldRender) return;

    const dt = 0.012 * Math.max(0.2, playbackSpeed);
    const posArr = positionsRef.current;
    const colArr = colorsRef.current;
    const RADIUS = 1.0045;

    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];

      // Save previous position for streamline line segment
      p.prevLon = p.lon;
      p.prevLat = p.lat;

      // 2nd-Order Runge-Kutta (RK2) Advection for smooth fluid trajectories
      const v1 = sampleVelocityBilinear(p.lon, p.lat, vectorGridIndex);
      const midLon = p.lon + v1.u * dt * 0.5;
      const midLat = p.lat + v1.v * dt * 0.5;
      const v2 = sampleVelocityBilinear(midLon, midLat, vectorGridIndex);

      p.lon += v2.u * dt * 6.5;
      p.lat += v2.v * dt * 6.5;
      p.life += 1.0;

      const onLand = isLandFast(p.lon, p.lat);
      const outOfBounds =
        p.lon < DOMAIN.lonMin ||
        p.lon > DOMAIN.lonMax ||
        p.lat < DOMAIN.latMin ||
        p.lat > DOMAIN.latMax ||
        p.life >= p.maxLife ||
        onLand;

      if (outOfBounds) {
        let rlon = 0, rlat = 0;
        let attempts = 0;
        do {
          rlon = DOMAIN.lonMin + Math.random() * (DOMAIN.lonMax - DOMAIN.lonMin);
          rlat = DOMAIN.latMin + Math.random() * (DOMAIN.latMax - DOMAIN.latMin);
          attempts++;
        } while (isLandFast(rlon, rlat) && attempts < 100);

        p.lon = rlon;
        p.lat = rlat;
        p.prevLon = rlon;
        p.prevLat = rlat;
        p.life = 0;
      }

      // Convert prev & curr lat/lon to 3D sphere positions
      const pPrev = lonLatToVec3(p.prevLon, p.prevLat, RADIUS);
      const pCurr = lonLatToVec3(p.lon, p.lat, RADIUS);

      // Tail vertex (prev)
      posArr[i * 6] = pPrev.x;
      posArr[i * 6 + 1] = pPrev.y;
      posArr[i * 6 + 2] = pPrev.z;

      // Head vertex (curr)
      posArr[i * 6 + 3] = pCurr.x;
      posArr[i * 6 + 4] = pCurr.y;
      posArr[i * 6 + 5] = pCurr.z;

      // Smooth Fade-In at birth and Fade-Out at death (eliminates jumps & popping)
      const fadeIn = Math.min(1.0, p.life / 20.0);
      const fadeOut = Math.min(1.0, (p.maxLife - p.life) / 20.0);
      const alpha = Math.max(0.0, Math.min(fadeIn, fadeOut));

      const speed = Math.hypot(v1.u, v1.v);
      const speedNorm = Math.min(1.0, speed / 1.5);

      // Cyan to Emerald fluid streamline color gradient
      const r = 0.0 + speedNorm * 0.15;
      const g = 0.85 + speedNorm * 0.15;
      const b = 1.0 - speedNorm * 0.2;

      // Tail vertex color (darker / translucent tail)
      colArr[i * 6] = r * alpha * 0.25;
      colArr[i * 6 + 1] = g * alpha * 0.25;
      colArr[i * 6 + 2] = b * alpha * 0.25;

      // Head vertex color (bright glowing leading tip)
      colArr[i * 6 + 3] = r * alpha * 1.25;
      colArr[i * 6 + 4] = g * alpha * 1.25;
      colArr[i * 6 + 5] = b * alpha * 1.25;
    }

    const posAttr = lineRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = lineRef.current.geometry.attributes.color as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  if (!shouldRender) return null;

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positionsRef.current, 3]}
          count={STREAMLINE_COUNT * 2}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colorsRef.current, 3]}
          count={STREAMLINE_COUNT * 2}
        />
      </bufferGeometry>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.92}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        linewidth={1.5}
      />
    </lineSegments>
  );
}

