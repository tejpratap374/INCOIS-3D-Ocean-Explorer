import { useRef, useEffect } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { vec3ToLonLat, lonLatToVec3, depthToSphereOffset } from '@/utils/geo';
import { sampleFieldValue } from '@/utils/sampleField';
import { isOverOcean } from '@/data/geo';
import { REGION_CONFIGS, getRegionConfig, isInsideDomain } from '@/config/regions';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';

const EARTH_RADIUS = 1.0;

// Default to the Indian Ocean boundary when no explicit region domain is active
const INDIAN_OCEAN_DOMAIN = (REGION_CONFIGS.find((r) => r.id === 'indian_ocean') ?? REGION_CONFIGS[0]).domain;

/**
 * SphereProbe — a click-to-inspect marker on the Earth sphere.
 * Uses a raycaster against the Earth sphere to find the clicked point,
 * then displays a marker + label with the lat/lon and value.
 */
export function SphereProbe() {
  const probeLocation = useOceanStore((s) => s.probeLocation);
  const field = useOceanStore((s) => s.field);
  const depth = useOceanStore((s) => s.depth);
  const variable = useOceanStore((s) => s.variable);
  const setRightOpen = useOceanStore((s) => s.setRightPanelOpen);

  const { raycaster, camera, gl } = useThree();
  const earthRef = useRef<THREE.Mesh>(null);
  const markerRef = useRef<THREE.Group>(null);

  // Mouse click handler
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!field) return;
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);

      // Create a temporary sphere for intersection
      const tempSphere = new THREE.SphereGeometry(EARTH_RADIUS, 64, 32);
      const intersects = raycaster.intersectObject(
        new THREE.Mesh(tempSphere)
      );
      if (intersects.length > 0) {
        const pt = intersects[0].point;
        const { lon, lat } = vec3ToLonLat(pt);

        // Restrict inspection to the active region boundary — must be ocean AND inside the region domain.
        const region = getRegionConfig(useOceanStore.getState().currentRegion);
        const bounds = region?.domain ?? INDIAN_OCEAN_DOMAIN;
        if (!isOverOcean(lat, lon) || !isInsideDomain(lat, lon, bounds)) {
          tempSphere.dispose();
          return;
        }

        const value = sampleFieldValue(field, lat, lon);
        if (value !== null) {
          useOceanStore.getState().setProbeLocation({ lat, lon });
          setRightOpen(true);
        }
      }
      tempSphere.dispose();
    };

    gl.domElement.addEventListener('click', onClick);
    return () => gl.domElement.removeEventListener('click', onClick);
  }, [field, gl, raycaster, camera, setRightOpen]);

  // Update marker position from probeLocation
  useEffect(() => {
    if (!markerRef.current || !probeLocation) return;
    const { lon, lat } = probeLocation;
    const depthOffset = depth > 0 ? depthToSphereOffset(depth) : 0.002;
    const pos = lonLatToVec3(lon, lat, EARTH_RADIUS + depthOffset);
    markerRef.current.position.set(pos.x, pos.y, pos.z);
  }, [probeLocation, depth]);

  if (!probeLocation) return null;

  const value = sampleFieldValue(field, probeLocation.lat, probeLocation.lon);
  if (value === null) return null;

  const { lon, lat } = probeLocation;
  const dirLat = lat >= 0 ? 'N' : 'S';
  const dirLon = lon >= 0 ? 'E' : 'W';

  return (
    <group ref={markerRef}>
      {/* Pulsing ring */}
      <mesh rotation={[0, 0, 0]}>
        <ringGeometry args={[0.008, 0.011, 24]} />
        <meshBasicMaterial color="#00c8ff" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[0, 0, 0]}>
        <ringGeometry args={[0.011, 0.014, 24]} />
        <meshBasicMaterial color="#00c8ff" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Center dot */}
      <mesh>
        <sphereGeometry args={[0.003, 8, 8]} />
        <meshBasicMaterial color="#00c8ff" />
      </mesh>
      {/* Label */}
      <Text
        position={[0.015, 0.015, 0]}
        fontSize={0.01}
        color="#00c8ff"
        anchorX="left"
        anchorY="bottom"
        outlineColor="#04080f"
        outlineWidth={0.001}
      >
        {`${Math.abs(lat).toFixed(2)}°${dirLat} · ${Math.abs(lon).toFixed(2)}°${dirLon}`}
      </Text>
      <Text
        position={[0.015, 0.004, 0]}
        fontSize={0.008}
        color="#8aadbf"
        anchorX="left"
        anchorY="bottom"
        outlineColor="#04080f"
        outlineWidth={0.001}
      >
        {`${variable}: ${value.toFixed(2)} ${field?.unit ?? ''}`}
      </Text>
    </group>
  );
}
