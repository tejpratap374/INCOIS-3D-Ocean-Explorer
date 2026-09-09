import { useMemo, useRef } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { lonLatToVec3 } from '@/utils/geo';
import * as THREE from 'three';

const EARTH_RADIUS = 1.0;
const ARROW_SCALE = 0.012; // scaled for globe view

export function OceanCurrents() {
  const vectorField = useOceanStore((s) => s.vectorField);
  const depth = useOceanStore((s) => s.depth);
  const showCurrents = useOceanStore((s) => s.showCurrents);

  const arrows = useMemo(() => {
    if (!vectorField?.vectors) return [];
    const maxSpeed = Math.max(...vectorField.vectors.map((v) => v.speed), 0.001);
    return vectorField.vectors.slice(0, 600).map((v) => {
      // Position arrow at sphere surface
      const pos = lonLatToVec3(v.lon, v.lat, EARTH_RADIUS + 0.001);
      const speed = Math.min(v.speed / maxSpeed, 1.0);
      const angle = Math.atan2(v.u, v.v);
      const len = speed * ARROW_SCALE;
      const dx = len * Math.cos(angle);
      const dy = len * Math.sin(angle);
      const color = new THREE.Color().setHSL(0.58 - speed * 0.45, 0.9, 0.45 + speed * 0.25);
      return {
        id: `${v.lat}-${v.lon}`,
        pos: pos.toArray() as [number, number, number],
        dx, dy,
        speed,
        colorHex: '#' + color.getHexString(),
      };
    });
  }, [vectorField]);

  if (!showCurrents || arrows.length === 0) return null;

  return (
    <group>
      {arrows.map((a) => (
        <SphereArrow3D
          key={a.id}
          position={a.pos}
          dx={a.dx}
          dz={a.dy}
          length={a.speed}
          color={a.colorHex}
        />
      ))}
    </group>
  );
}

function SphereArrow3D({
  position,
  dx,
  dz,
  length,
  color,
}: {
  position: [number, number, number];
  dx: number;
  dz: number;
  length: number;
  color: string;
}) {
  const [x, y, z] = position;
  const actualLen = Math.max(0.004, length * ARROW_SCALE * 0.8);
  const dir = Math.atan2(dx, dz);
  const arrowX = x, arrowY = y, arrowZ = z;

  return (
    <group position={[arrowX, arrowY, arrowZ]}>
      {/* Rotate arrow to point in (dx, dz) direction in local tangent plane */}
      <mesh
        rotation={[0, -dir, 0]}
        position={[actualLen / 2, 0, 0]}
      >
        <boxGeometry args={[actualLen, 0.002, 0.002]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      <mesh
        rotation={[0, -dir, 0]}
        position={[actualLen + 0.005, 0, 0]}
      >
        <coneGeometry args={[0.004, 0.008, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}
