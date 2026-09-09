import { useMemo, useRef, useEffect } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { lonLatToXY, depthToZ } from '@/utils/geo';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const ARROW_SCALE = 0.10;

export function CurrentsLayer() {
  const vectorField = useOceanStore((s) => s.vectorField);
  const depth = useOceanStore((s) => s.depth);
  const ve = useOceanStore((s) => s.verticalExaggeration);

  const arrows = useMemo(() => {
    if (!vectorField?.vectors) return [];
    const z = depth > 0 ? depthToZ(depth, ve) : 0.0;
    const maxSpeed = Math.max(...vectorField.vectors.map((v) => v.speed), 0.001);
    return vectorField.vectors.slice(0, 400).map((v) => {
      const { x, y } = lonLatToXY(v.lon, v.lat);
      const speed = v.speed / maxSpeed;
      const angle = Math.atan2(v.v, v.u);
      const len = speed * ARROW_SCALE;
      const dx = len * Math.cos(angle);
      const dy = len * Math.sin(angle);
      // Color: slow=blue, fast=yellow
      return {
        id: `${v.lat}-${v.lon}`,
        x, y, z,
        dx, dy,
        angle,
        speed,
      };
    });
  }, [vectorField, depth, ve]);

  const groupRef = useRef<THREE.Group>(null);

  if (!vectorField || arrows.length === 0) return null;

  return (
    <group ref={groupRef}>
      {arrows.map((a) => (
        <Arrow3D
          key={a.id}
          position={[a.x, a.z, a.y]}
          direction={a.angle}
          length={a.speed}
        />
      ))}
    </group>
  );
}

function Arrow3D({ position, direction, length }: {
  position: [number, number, number];
  direction: number;
  length: number;
}) {
  const [x, y, z] = position;
  const actualLen = Math.max(0.01, length * ARROW_SCALE);
  const color = new THREE.Color().setHSL(0.6 - length * 0.5, 0.9, 0.5 + length * 0.2);
  const hex = '#' + color.getHexString();

  return (
    <group position={[x, y, z]} rotation={[0, -direction, 0]}>
      {/* Arrow shaft */}
      <mesh position={[actualLen / 2, 0, 0]}>
        <boxGeometry args={[actualLen, 0.005, 0.005]} />
        <meshBasicMaterial color={hex} />
      </mesh>
      {/* Arrow head */}
      <mesh position={[actualLen + 0.015, 0, 0]}>
        <coneGeometry args={[0.012, 0.025, 6]} />
        <meshBasicMaterial color={hex} />
      </mesh>
    </group>
  );
}
