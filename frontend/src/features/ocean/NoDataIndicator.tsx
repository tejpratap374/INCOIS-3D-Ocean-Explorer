import { useMemo } from 'react';
import { Text, Billboard } from '@react-three/drei';
import { lonLatToVec3 } from '@/utils/geo';
import { useOceanStore } from '@/stores/oceanStore';
import { getRegionCenter, getRegionName } from '@/config/regions';

const LABEL_RADIUS = 1.05; // slightly above Earth surface for visibility
const LABEL_OFFSET_DISTANCE = 0.08; // distance to offset label from surface

export function NoDataIndicator() {
  const currentRegion = useOceanStore((s) => s.currentRegion);
  const field = useOceanStore((s) => s.field);

  const position = useMemo(() => {
    const center = getRegionCenter(currentRegion);
    if (!center) return null;
    // Position the label at the region's center, slightly above the surface
    return lonLatToVec3(center.lon, center.lat, LABEL_RADIUS);
  }, [currentRegion]);

  // Only render when data_exists is explicitly false
  if (!field || field.data_exists !== false) {
    return null;
  }

  if (!position) {
    return null;
  }

  const regionName = getRegionName(currentRegion);
  const message = `No Data Available for ${regionName}`;

  return (
    <Billboard position={position}>
      {/* Semi-transparent background plane for readability */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[0.5, 0.1]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </mesh>
      <Text
        position={[0, 0, 0]}
        fontSize={0.04}
        color="#ff6666"
        anchorX="center"
        anchorY="middle"
        maxWidth={0.5}
        textAlign="center"
        outlineWidth={0.002}
        outlineColor="#000000"
      >
        {message}
      </Text>
    </Billboard>
  );
}
