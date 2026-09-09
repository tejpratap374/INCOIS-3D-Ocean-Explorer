import { useState, useEffect, useRef } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { xyToLonLat, lonLatToXY, depthToZ } from '@/utils/geo';
import { isOverOcean } from '@/data/geo';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';

interface HoverData {
  x: number;
  z: number;
  lat: number;
  lon: number;
  value: number;
}

/**
 * Invisible plane that captures clicks on the ocean field to allow
 * click-to-inspect functionality. Shows a probe marker and a label.
 */
export function ClickToInspect() {
  const [hovered, setHovered] = useState<HoverData | null>(null);
  const field = useOceanStore((s) => s.field);
  const depth = useOceanStore((s) => s.depth);
  const ve = useOceanStore((s) => s.verticalExaggeration);
  const variable = useOceanStore((s) => s.variable);
  const setRightOpen = useOceanStore((s) => s.setRightPanelOpen);
  const setProbeLocation = useOceanStore((s) => s.setProbeLocation);
  const probeLocation = useOceanStore((s) => s.probeLocation);

  const { raycaster, camera, gl } = useThree();
  const planeRef = useRef<THREE.Mesh>(null);
  const planeGeometry = useRef<THREE.PlaneGeometry>(new THREE.PlaneGeometry(2, 2));

  // Get value at lat/lon from field
  const getValue = (lat: number, lon: number): number | null => {
    if (!field) return null;
    const lats = field.latitude;
    const lons = field.longitude;
    // Bilinear interpolation
    if (lat < lats[0] || lat > lats[lats.length - 1]) return null;
    if (lon < lons[0] || lon > lons[lons.length - 1]) return null;
    // Find indices
    let i0 = 0, i1 = 0, j0 = 0, j1 = 0;
    for (let i = 0; i < lats.length - 1; i++) {
      if (lats[i] <= lat && lats[i + 1] >= lat) {
        i0 = i; i1 = i + 1;
        break;
      }
    }
    for (let j = 0; j < lons.length - 1; j++) {
      if (lons[j] <= lon && lons[j + 1] >= lon) {
        j0 = j; j1 = j + 1;
        break;
      }
    }
    const t = (lat - lats[i0]) / (lats[i1] - lats[i0] + 1e-9);
    const u = (lon - lons[j0]) / (lons[j1] - lons[j0] + 1e-9);
    const v00 = field.data[i0]?.[j0] ?? NaN;
    const v01 = field.data[i0]?.[j1] ?? NaN;
    const v10 = field.data[i1]?.[j0] ?? NaN;
    const v11 = field.data[i1]?.[j1] ?? NaN;
    if (isNaN(v00) || isNaN(v01) || isNaN(v10) || isNaN(v11)) return null;
    return v00 * (1 - t) * (1 - u) + v01 * (1 - t) * u + v10 * t * (1 - u) + v11 * t * u;
  };

  useEffect(() => {
    if (!field) return;
    const zPos = depth > 0 ? depthToZ(depth, ve) : 0.0;
    if (planeRef.current) {
      planeRef.current.position.y = zPos + 0.001;
    }
  }, [depth, ve, field]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!field) return;
      // Get NDC
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      if (!planeRef.current) return;
      const intersects = raycaster.intersectObject(planeRef.current);
      if (intersects.length > 0) {
        const pt = intersects[0].point;
        const { lon, lat } = xyToLonLat(pt.x, pt.z);
        if (!isOverOcean(lat, lon)) return; // DO NOTHING on land click!
        const value = getValue(lat, lon);
        if (value !== null) {
          setProbeLocation({ lat, lon });
          setRightOpen(true);
        }
      }
    };

    const onMove = (e: MouseEvent) => {
      if (!field) return;
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      if (!planeRef.current) return;
      const intersects = raycaster.intersectObject(planeRef.current);
      if (intersects.length > 0) {
        const pt = intersects[0].point;
        const { lon, lat } = xyToLonLat(pt.x, pt.z);
        const value = getValue(lat, lon);
        if (value !== null) {
          setHovered({ x: pt.x, z: pt.z, lat, lon, value });
        } else {
          setHovered(null);
        }
      } else {
        setHovered(null);
      }
    };

    gl.domElement.addEventListener('click', onClick);
    gl.domElement.addEventListener('mousemove', onMove);
    return () => {
      gl.domElement.removeEventListener('click', onClick);
      gl.domElement.removeEventListener('mousemove', onMove);
    };
  }, [field, gl, raycaster, camera, setProbeLocation, setRightOpen, getValue]);

  // Compute probe display from store
  const probeValue = (() => {
    if (!probeLocation || !field) return null;
    return getValue(probeLocation.lat, probeLocation.lon);
  })();

  if (!field) return <mesh ref={planeRef} visible={false} geometry={planeGeometry.current} />;

  // Convert lat/lon → scene x/z for probe marker
  const probePos = probeLocation
    ? (() => {
        const { x, y } = lonLatToXY(probeLocation.lon, probeLocation.lat);
        return { x, y };
      })()
    : null;

  return (
    <>
      <mesh
        ref={planeRef}
        geometry={planeGeometry.current}
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          const pt = e.point;
          const { lon, lat } = xyToLonLat(pt.x, pt.z);
          const value = getValue(lat, lon);
          if (value !== null) {
            setProbeLocation({ lat, lon });
            setRightOpen(true);
          }
        }}
      />
      {probePos && probeValue !== null && (
        <group position={[probePos.x, (depth > 0 ? depthToZ(depth, ve) : 0) + 0.005, probePos.y]}>
          {/* Probe marker - pulsing ring */}
          <mesh>
            <ringGeometry args={[0.025, 0.032, 24]} />
            <meshBasicMaterial color="#00c8ff" transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
          <mesh>
            <ringGeometry args={[0.034, 0.038, 24]} />
            <meshBasicMaterial color="#00c8ff" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.005, 8, 8]} />
            <meshBasicMaterial color="#00c8ff" />
          </mesh>
          {/* Vertical line down */}
          <mesh position={[0, -0.05, 0]}>
            <cylinderGeometry args={[0.002, 0.002, 0.1, 6]} />
            <meshBasicMaterial color="#00c8ff" transparent opacity={0.5} />
          </mesh>
          {/* Label */}
          <Text
            position={[0.04, 0.04, 0]}
            fontSize={0.024}
            color="#00c8ff"
            anchorX="left"
            anchorY="bottom"
            outlineColor="#04080f"
            outlineWidth={0.002}
          >
            {`${probeLocation!.lat.toFixed(2)}°N · ${probeLocation!.lon.toFixed(2)}°E`}
          </Text>
          <Text
            position={[0.04, 0.012, 0]}
            fontSize={0.018}
            color="#8aadbf"
            anchorX="left"
            anchorY="bottom"
            outlineColor="#04080f"
            outlineWidth={0.002}
          >
            {`${variable}: ${probeValue.toFixed(2)}`}
          </Text>
        </group>
      )}
      {hovered && !probeLocation && (
        <group position={[hovered.x, (depth > 0 ? depthToZ(depth, ve) : 0) + 0.005, hovered.z]}>
          <mesh>
            <sphereGeometry args={[0.004, 8, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
          </mesh>
        </group>
      )}
    </>
  );
}
