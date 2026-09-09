import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { lonLatToVec3 } from '@/utils/geo';
import { useOceanStore } from '@/stores/oceanStore';
import {
  COASTLINE,
  COUNTRIES,
  extractRings,
  type GeoLineString,
  type GeoPolygon,
  type GeoMultiPolygon,
} from '@/data/geo';

const COASTLINE_RADIUS = 1.0025;
const COUNTRY_RADIUS = 1.0022;

const COAST_COLOR = '#475569';
const COUNTRY_COLOR = '#334155';

interface RingProps {
  ring: [number, number][];
  color: string;
  radius: number;
  opacity: number;
  width: number;
}

/** Render a single closed ring as a polyline on a sphere. */
function Ring({ ring, color, radius, opacity, width }: RingProps) {
  const points = useMemo(() => {
    if (ring.length < 2) return [];
    return ring.map(([lon, lat]) => lonLatToVec3(lon, lat, radius));
  }, [ring, radius]);

  if (points.length < 2) return null;
  return (
    <Line
      points={points}
      color={color}
      lineWidth={width}
      transparent
      opacity={opacity}
    />
  );
}

/** Build coastline line set from Natural Earth data. */
function Coastlines({ opacity, width }: { opacity: number; width: number }) {
  const rings = useMemo(() => {
    const out: [number, number][][] = [];
    for (const feat of COASTLINE.features) {
      const r = extractRings(feat.geometry as GeoLineString);
      for (const ring of r) {
        if (ring.length >= 2) out.push(ring);
      }
    }
    return out;
  }, []);

  return (
    <>
      {rings.map((ring, i) => (
        <Ring
          key={`c-${i}`}
          ring={ring}
          color={COAST_COLOR}
          radius={COASTLINE_RADIUS}
          opacity={opacity}
          width={width}
        />
      ))}
    </>
  );
}

/** Build country border lines. */
function CountryBorders({ opacity, width }: { opacity: number; width: number }) {
  const rings = useMemo(() => {
    const out: [number, number][][] = [];
    for (const feat of COUNTRIES.features) {
      const r = extractRings(feat.geometry as GeoPolygon | GeoMultiPolygon);
      for (const ring of r) {
        if (ring.length >= 2) out.push(ring);
      }
    }
    return out;
  }, []);

  return (
    <>
      {rings.map((ring, i) => (
        <Ring
          key={`cb-${i}`}
          ring={ring}
          color={COUNTRY_COLOR}
          radius={COUNTRY_RADIUS}
          opacity={opacity}
          width={width}
        />
      ))}
    </>
  );
}

export function ContinentalOverlay() {
  const showCoastline = useOceanStore((s) => s.showCoastline);

  return (
    <group>
      {showCoastline && (
        <>
          <Coastlines opacity={0.85} width={1.2} />
          <CountryBorders opacity={0.6} width={0.8} />
        </>
      )}
    </group>
  );
}
