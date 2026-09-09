import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Bathymetric base — a stylized seabed with subtle depth-based coloring.
 * Uses a vertex displacement based on simplified bathymetry of the Indian Ocean.
 */
export function BathymetryBase() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(2.2, 2.2, 64, 64);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      // Approximate bathymetry
      // Deep basin center (Arabian Sea central)
      const dist1 = Math.sqrt((x - 0.0) ** 2 + (y - 0.3) ** 2);
      // Bay of Bengal deep
      const dist2 = Math.sqrt((x + 0.3) ** 2 + (y + 0.0) ** 2);
      // Shallow near "coastlines" (left/bottom edges of domain)
      const shoreDist = Math.min(
        Math.abs(x + 1.0),  // west
        Math.abs(y - 0.7),  // north
        1.5
      );

      const basin = -0.4 * Math.exp(-dist1 * 1.5) - 0.3 * Math.exp(-dist2 * 1.8);
      const shallow = 0.2 * Math.max(0, Math.min(1, 1 - shoreDist));
      const noise = (Math.sin(x * 7) * Math.cos(y * 5) * 0.05);

      const z = basin + shallow + noise;
      pos.setZ(i, z);

      // Color: dark blue (deep) → cyan (shallow)
      const t = (z + 0.7) / 0.9;
      const r = 0.02 + 0.10 * t;
      const g = 0.10 + 0.25 * t;
      const b = 0.20 + 0.40 * t;
      colors.push(r, g, b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <group position={[0, -1.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          metalness={0.2}
          roughness={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
