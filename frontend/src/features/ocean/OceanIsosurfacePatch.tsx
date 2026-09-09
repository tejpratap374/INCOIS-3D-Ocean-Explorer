import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useOceanStore } from '@/stores/oceanStore';
import { isOverOcean } from '@/data/geo';

const EARTH_RADIUS = 1.0;

function lonLatToVec3(lat: number, lon: number, radius: number): [number, number, number] {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  return [
    radius * cosLat * Math.sin(lonRad),
    radius * Math.sin(latRad),
    radius * cosLat * Math.cos(lonRad),
  ];
}

export const OceanIsosurfacePatch: React.FC = () => {
  const field = useOceanStore((s) => s.field);
  const vizMode = useOceanStore((s) => s.vizMode);
  const isosurfaceValue = useOceanStore((s) => s.isosurfaceValue);
  const variable = useOceanStore((s) => s.variable);

  const geometry = useMemo(() => {
    if (!field || vizMode !== 'isosurface') return null;

    const { latitude, longitude, data, min_value, max_value } = field;
    const nLat = latitude.length;
    const nLon = longitude.length;

    if (nLat < 2 || nLon < 2 || !data || data.length === 0) return null;

    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    // Map 2D grid points to 3D displaced positions based on target isosurface distance
    const range = (max_value - min_value) || 1.0;
    const gridPoints: ([number, number, number] | null)[][] = Array.from({ length: nLat }, () =>
      Array(nLon).fill(null)
    );

    const baseColor = new THREE.Color(
      variable === 'temperature' ? 0x00e5ff : variable === 'salinity' ? 0x76ff03 : 0xff9100
    );

    for (let i = 0; i < nLat; i++) {
      const lat = latitude[i];
      for (let j = 0; j < nLon; j++) {
        const lon = longitude[j];
        const val = data[i]?.[j];
        if (val === undefined || val === null || isNaN(val)) continue;

        // Isosurface depth displacement factor:
        // Points matching target value sit on top shell, others dip down up to -0.06 radius
        const delta = Math.abs(val - isosurfaceValue) / range;
        const depthOffset = -Math.min(delta * 0.08, 0.07);
        const radius = EARTH_RADIUS + 0.005 + depthOffset;

        const pos = lonLatToVec3(lat, lon, radius);
        gridPoints[i][j] = pos;
      }
    }

    const vertexIndexMap = new Map<string, number>();

    const getOrAddVertex = (i: number, j: number): number | null => {
      const pos = gridPoints[i][j];
      if (!pos) return null;
      const key = `${i}_${j}`;
      if (vertexIndexMap.has(key)) return vertexIndexMap.get(key)!;

      const idx = positions.length / 3;
      positions.push(pos[0], pos[1], pos[2]);

      const val = data[i][j];
      const alpha = Math.max(0.2, 1.0 - Math.abs(val - isosurfaceValue) / range);
      const color = baseColor.clone().multiplyScalar(alpha);
      colors.push(color.r, color.g, color.b);

      vertexIndexMap.set(key, idx);
      return idx;
    };

    for (let i = 0; i < nLat - 1; i++) {
      for (let j = 0; j < nLon - 1; j++) {
        const p00 = getOrAddVertex(i, j);
        const p10 = getOrAddVertex(i + 1, j);
        const p01 = getOrAddVertex(i, j + 1);
        const p11 = getOrAddVertex(i + 1, j + 1);

        if (p00 !== null && p10 !== null && p01 !== null) {
          indices.push(p00, p10, p01);
        }
        if (p10 !== null && p11 !== null && p01 !== null) {
          indices.push(p10, p11, p01);
        }
      }
    }

    if (positions.length === 0 || indices.length === 0) return null;

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    return geom;
  }, [field, vizMode, isosurfaceValue, variable]);

  if (vizMode !== 'isosurface' || !geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        roughness={0.25}
        metalness={0.3}
        transparent={true}
        opacity={0.8}
        side={THREE.DoubleSide}
        wireframe={false}
      />
    </mesh>
  );
};
