import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useOceanStore } from '@/stores/oceanStore';
import { lonLatToVec3 } from '@/utils/geo';

interface ADCPStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  depths: number[]; // meters
}

const ADCP_STATIONS: ADCPStation[] = [
  { id: 'adcp_bd02', name: 'ADCP BD02 Bay of Bengal', lat: 16.5, lon: 88.0, depths: [10, 50, 100, 200, 500] },
  { id: 'adcp_bd08', name: 'ADCP BD08 Central BoB', lat: 12.0, lon: 89.0, depths: [10, 50, 100, 250, 600] },
  { id: 'adcp_ad06', name: 'ADCP AD06 Arabian Sea', lat: 18.5, lon: 67.5, depths: [10, 50, 100, 200, 500] },
  { id: 'adcp_rama1', name: 'RAMA Moored ADCP 15N 90E', lat: 15.0, lon: 90.0, depths: [10, 75, 150, 300, 750] },
];

export const ADCPMooringLayer: React.FC = () => {
  const showADCP = useOceanStore((s) => s.showADCP);

  const moorings = useMemo(() => {
    if (!showADCP) return [];

    return ADCP_STATIONS.map((st) => {
      const topPos = lonLatToVec3(st.lon, st.lat, 1.008);
      const bottomPos = lonLatToVec3(st.lon, st.lat, 0.94);

      const depthNodes = st.depths.map((d) => {
        const radius = 1.008 - (d / 2000) * 0.08;
        return lonLatToVec3(st.lon, st.lat, radius);
      });

      return {
        id: st.id,
        name: st.name,
        points: [topPos, bottomPos],
        depthNodes,
      };
    });
  }, [showADCP]);

  if (!showADCP || moorings.length === 0) return null;

  return (
    <group>
      {moorings.map((m) => (
        <group key={m.id}>
          {/* Vertical Mooring Line */}
          <Line points={m.points} color="#00bcd4" lineWidth={2} />

          {/* ADCP Vertical Acoustic Sensor Cones along depth */}
          {m.depthNodes.map((nodePos, i) => (
            <mesh key={i} position={nodePos}>
              <sphereGeometry args={[0.008, 12, 12]} />
              <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={0.6} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};
