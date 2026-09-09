import { useMemo } from 'react';
import { Line, Text } from '@react-three/drei';
import { lonLatToVec3, KEY_LATITUDES, KEY_LONGITUDES } from '@/utils/geo';

const GRID_RADIUS = 1.002;

interface GridLineProps {
  points: [number, number, number][];
  color: string;
  lineWidth?: number;
  opacity?: number;
}

function GridLine({ points, color, lineWidth = 0.5, opacity = 0.15 }: GridLineProps) {
  if (points.length < 2) return null;
  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
    />
  );
}

// Major grid lines (equator, tropics, etc.) — more visible
function MajorGridLines() {
  const lines = useMemo(() => {
    const result: { points: [number, number, number][]; label?: string }[] = [];

    // Equator
    const equator: [number, number, number][] = [];
    for (let lon = -180; lon <= 180; lon += 2) {
      equator.push(lonLatToVec3(lon, 0, GRID_RADIUS).toArray() as [number, number, number]);
    }
    result.push({ points: equator, label: 'Equator' });

    // Tropics
    for (const t of [23.5, -23.5]) {
      const pts: [number, number, number][] = [];
      for (let lon = -180; lon <= 180; lon += 2) {
        pts.push(lonLatToVec3(lon, t, GRID_RADIUS).toArray() as [number, number, number]);
      }
      result.push({ points: pts });
    }

    // Arctic / Antarctic Circles
    for (const p of [66.5, -66.5]) {
      const pts: [number, number, number][] = [];
      for (let lon = -180; lon <= 180; lon += 2) {
        pts.push(lonLatToVec3(lon, p, GRID_RADIUS).toArray() as [number, number, number]);
      }
      result.push({ points: pts });
    }

    // Prime Meridian and 180° meridian
    for (const lon of [0, 72.5, 180]) {
      const pts: [number, number, number][] = [];
      for (let lat = -90; lat <= 90; lat += 2) {
        pts.push(lonLatToVec3(lon, lat, GRID_RADIUS).toArray() as [number, number, number]);
      }
      result.push({ points: pts });
    }

    // Indian Ocean region meridians
    for (const meridian of [40, 55, 100, 120]) {
      const pts: [number, number, number][] = [];
      for (let lat = -90; lat <= 90; lat += 2) {
        pts.push(lonLatToVec3(meridian, lat, GRID_RADIUS).toArray() as [number, number, number]);
      }
      result.push({ points: pts });
    }

    // Key latitudes
    for (const { lat } of KEY_LATITUDES) {
      if ([0, 23.5, -23.5, 66.5, -66.5].includes(Math.abs(lat))) continue;
      const pts: [number, number, number][] = [];
      for (let lon = -180; lon <= 180; lon += 2) {
        pts.push(lonLatToVec3(lon, lat, GRID_RADIUS).toArray() as [number, number, number]);
      }
      result.push({ points: pts });
    }

    return result;
  }, []);

  return (
    <>
      {lines.map((line, i) => (
        <GridLine
          key={`major-${i}`}
          points={line.points}
          color="#00c8ff"
          lineWidth={0.8}
          opacity={0.25}
        />
      ))}
    </>
  );
}

// Minor grid lines — every 10 degrees
function MinorGridLines() {
  const lines = useMemo(() => {
    const result: [number, number, number][][] = [];

    // Latitude lines every 10° (excluding equator, tropics which are in major)
    for (let lat = -80; lat <= 80; lat += 10) {
      if ([0, 23.5, -23.5, 66.5, -66.5].includes(lat)) continue;
      const pts: [number, number, number][] = [];
      for (let lon = -180; lon <= 180; lon += 5) {
        pts.push(lonLatToVec3(lon, lat, GRID_RADIUS).toArray() as [number, number, number]);
      }
      result.push(pts);
    }

    // Longitude lines every 10°
    for (let lon = -170; lon <= 180; lon += 10) {
      if ([0, 72.5, 180].includes(lon)) continue;
      const pts: [number, number, number][] = [];
      for (let lat = -90; lat <= 90; lat += 5) {
        pts.push(lonLatToVec3(lon, lat, GRID_RADIUS).toArray() as [number, number, number]);
      }
      result.push(pts);
    }

    return result;
  }, []);

  return (
    <>
      {lines.map((pts, i) => (
        <GridLine
          key={`minor-${i}`}
          points={pts}
          color="#00c8ff"
          lineWidth={0.4}
          opacity={0.1}
        />
      ))}
    </>
  );
}

// Latitude labels
function LatLabels() {
  const labels = useMemo(() => {
    const result: { lat: number; lon: number; label: string; isEquator?: boolean }[] = [
      { lat: 0, lon: -5, label: '0°', isEquator: true },
      { lat: 23.5, lon: -5, label: '23.5°N' },
      { lat: -23.5, lon: -5, label: '23.5°S' },
      { lat: 66.5, lon: -5, label: '66.5°N' },
      { lat: -66.5, lon: -5, label: '66.5°S' },
    ];
    return result;
  }, []);

  return (
    <>
      {labels.map(({ lat, lon, label }) => {
        const pos = lonLatToVec3(lon, lat, GRID_RADIUS + 0.01);
        return (
          <Text
            key={label}
            position={[pos.x + 0.02, pos.y, pos.z]}
            fontSize={0.012}
            color={label.includes('0°') ? '#00c8ff' : '#4d6d80'}
            outlineColor="#04080f"
            outlineWidth={0.001}
          >
            {label}
          </Text>
        );
      })}
    </>
  );
}

// Longitude labels
function LonLabels() {
  const labels = useMemo(() => {
    return [
      { lon: 0, lat: -88, label: '0°' },
      { lon: 72.5, lat: -88, label: '72.5°E' },
      { lon: 180, lat: -88, label: '180°' },
      { lon: -72.5, lat: -88, label: '72.5°W' },
    ];
  }, []);

  return (
    <>
      {labels.map(({ lon, lat, label }) => {
        const pos = lonLatToVec3(lon, lat, GRID_RADIUS + 0.01);
        return (
          <Text
            key={label}
            position={[pos.x, pos.y, pos.z]}
            fontSize={0.012}
            color="#4d6d80"
            outlineColor="#04080f"
            outlineWidth={0.001}
          >
            {label}
          </Text>
        );
      })}
    </>
  );
}

export function SphereGrid() {
  return (
    <group>
      <MinorGridLines />
      <MajorGridLines />
      <LatLabels />
      <LonLabels />
    </group>
  );
}
