import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useOceanStore } from '@/stores/oceanStore';
import { lonLatToVec3 } from '@/utils/geo';

interface RadarStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  vectors: { dLat: number; dLon: number; speed: number }[];
}

const HF_STATIONS: RadarStation[] = [
  {
    id: 'hfr_mumbai',
    name: 'HF-Radar Mumbai Coast',
    lat: 18.96,
    lon: 72.82,
    vectors: [
      { dLat: 0.1, dLon: -0.2, speed: 0.8 },
      { dLat: 0.2, dLon: -0.15, speed: 0.95 },
      { dLat: -0.1, dLon: -0.25, speed: 0.7 },
      { dLat: 0.05, dLon: -0.3, speed: 1.1 },
    ],
  },
  {
    id: 'hfr_kochi',
    name: 'HF-Radar Kochi Coast',
    lat: 9.93,
    lon: 76.26,
    vectors: [
      { dLat: 0.15, dLon: -0.2, speed: 1.2 },
      { dLat: -0.1, dLon: -0.3, speed: 0.85 },
      { dLat: 0.0, dLon: -0.35, speed: 1.05 },
    ],
  },
  {
    id: 'hfr_chennai',
    name: 'HF-Radar Chennai Coast',
    lat: 13.08,
    lon: 80.27,
    vectors: [
      { dLat: 0.2, dLon: 0.2, speed: 0.9 },
      { dLat: -0.15, dLon: 0.25, speed: 0.75 },
      { dLat: 0.1, dLon: 0.3, speed: 1.15 },
    ],
  },
  {
    id: 'hfr_vizag',
    name: 'HF-Radar Visakhapatnam',
    lat: 17.68,
    lon: 83.21,
    vectors: [
      { dLat: 0.1, dLon: 0.2, speed: 0.85 },
      { dLat: 0.2, dLon: 0.25, speed: 1.0 },
      { dLat: -0.2, dLon: 0.3, speed: 0.95 },
    ],
  },
];

export const HFRadarLayer: React.FC = () => {
  const showHFRadar = useOceanStore((s) => s.showHFRadar);

  const lines = useMemo(() => {
    if (!showHFRadar) return [];

    const result: { points: THREE.Vector3[]; color: string }[] = [];

    HF_STATIONS.forEach((st) => {
      st.vectors.forEach((v) => {
        const startVec = lonLatToVec3(st.lon, st.lat, 1.006);
        const endVec = lonLatToVec3(st.lon + v.dLon, st.lat + v.dLat, 1.006);

        result.push({
          points: [startVec, endVec],
          color: v.speed > 1.0 ? '#ff1744' : '#00e676',
        });
      });
    });

    return result;
  }, [showHFRadar]);

  if (!showHFRadar || lines.length === 0) return null;

  return (
    <group>
      {lines.map((line, idx) => (
        <Line key={idx} points={line.points} color={line.color} lineWidth={2} />
      ))}
    </group>
  );
};
