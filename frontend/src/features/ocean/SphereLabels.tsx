import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { lonLatToVec3 } from '@/utils/geo';

const LABEL_RADIUS = 1.018;

interface OceanLabelPoint {
  name: string;
  lon: number;
  lat: number;
  color: string;
  fontSize: number;
}

// STEP 2 — ONLY ALLOWED OCEAN NAMES
const OCEAN_LABELS: OceanLabelPoint[] = [
  { name: 'INDIAN OCEAN', lon: 75.0, lat: -15.0, color: '#38bdf8', fontSize: 0.038 },
  { name: 'ATLANTIC OCEAN', lon: -25.0, lat: 0.0, color: '#38bdf8', fontSize: 0.032 },
  { name: 'PACIFIC OCEAN', lon: 160.0, lat: 0.0, color: '#38bdf8', fontSize: 0.032 },
  { name: 'SOUTHERN OCEAN', lon: 70.0, lat: -62.0, color: '#38bdf8', fontSize: 0.028 },
];

/**
 * STEP 3 — Camera-distance-aware billboard wrapper for ocean labels.
 * Scale decreases smoothly as camera zooms in (dist decreases),
 * producing smaller screen-space text when closer to the globe.
 */
function CameraDistanceOceanLabel({
  position,
  children,
}: {
  position: { x: number; y: number; z: number };
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;

    // STEP 14 — Back-face occlusion check: hide labels on the back side of the 3D globe
    const labelVec = new THREE.Vector3(position.x, position.y, position.z).normalize();
    const camVec = camera.position.clone().normalize();
    if (labelVec.dot(camVec) < 0.05) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    const dist = camera.position.length();

    // Zoomed out (dist ~3.5) -> scaleFactor ~1.0 (medium readable)
    // Zoomed in (dist ~1.4) -> scaleFactor ~0.25 (very small / subtle)
    const rawScale = Math.pow(dist / 3.5, 1.6);
    const targetScale = THREE.MathUtils.clamp(rawScale, 0.25, 1.25);

    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
  });

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      <Billboard>{children}</Billboard>
    </group>
  );
}

export function SphereLabels() {
  const oceanPoints = useMemo(() => {
    return OCEAN_LABELS.map((p) => ({
      ...p,
      pos: lonLatToVec3(p.lon, p.lat, LABEL_RADIUS),
    }));
  }, []);

  return (
    <group>
      {oceanPoints.map((p) => (
        <CameraDistanceOceanLabel key={p.name} position={p.pos}>
          <Text
            fontSize={p.fontSize}
            color={p.color}
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.14}
            outlineColor="#040a14"
            outlineWidth={0.003}
            renderOrder={25}
            material-depthTest={false}
            material-depthWrite={false}
          >
            {p.name}
          </Text>
        </CameraDistanceOceanLabel>
      ))}
    </group>
  );
}
