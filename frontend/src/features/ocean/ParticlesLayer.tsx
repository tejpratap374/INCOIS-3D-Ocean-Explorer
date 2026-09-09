import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useOceanStore } from '@/stores/oceanStore';
import { lonLatToXY, depthToZ } from '@/utils/geo';
import * as THREE from 'three';

const PARTICLE_COUNT = 800;

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export function ParticlesLayer() {
  const vectorField = useOceanStore((s) => s.vectorField);
  const depth = useOceanStore((s) => s.depth);
  const ve = useOceanStore((s) => s.verticalExaggeration);
  const playbackSpeed = useOceanStore((s) => s.playbackSpeed);

  const meshRef = useRef<THREE.Points>(null);
  const positionsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const particles = useRef<Particle[]>([]);

  // Initialize particles at random positions
  const initialized = useRef(false);
  if (!initialized.current) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const lon = 55 + Math.random() * 45;
      const lat = -5 + Math.random() * 30;
      const { x, y } = lonLatToXY(lon, lat);
      const z = depth > 0 ? depthToZ(depth, ve) : 0;
      particles.current.push({
        position: new THREE.Vector3(x, z, y),
        velocity: new THREE.Vector3(0, 0, 0),
        life: Math.random() * 200,
        maxLife: 200,
      });
    }
    initialized.current = true;
  }

  // Sample vector field at a given (x, z) and update particle velocity
  const sampleField = (x: number, z: number): { vx: number; vz: number } => {
    if (!vectorField?.vectors) return { vx: 0, vz: 0 };
    // Find nearest vector
    let minDist = Infinity;
    let nearest = vectorField.vectors[0];
    for (const v of vectorField.vectors) {
      const { x: vx, y: vy } = lonLatToXY(v.lon, v.lat);
      const dx = vx - x;
      const dz = vy - z;
      const d = dx * dx + dz * dz;
      if (d < minDist) {
        minDist = d;
        nearest = v;
      }
    }
    if (!nearest) return { vx: 0, vz: 0 };
    // Convert (u, v) to scene coordinates
    // u = eastward, v = northward
    // In scene: +x = east, +z = south (flipped lat)
    // So screen vx = u (east), vz = -v (north becomes -z in flipped)
    return {
      vx: nearest.u * 0.6,
      vz: -nearest.v * 0.6,
    };
  };

  useFrame(() => {
    if (!meshRef.current) return;
    const dt = playbackSpeed * 0.16;
    let arr = positionsRef.current;
    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];
      // Sample velocity from vector field
      const { vx, vz } = sampleField(p.position.x, p.position.z);
      // Smooth velocity
      p.velocity.x = p.velocity.x * 0.85 + vx * 0.15;
      p.velocity.z = p.velocity.z * 0.85 + vz * 0.15;
      // Update position
      p.position.x += p.velocity.x * dt;
      p.position.z += p.velocity.z * dt;
      p.life += dt;
      // Reset if out of bounds or dead
      if (Math.abs(p.position.x) > 1.1 || Math.abs(p.position.z) > 1.1 || p.life > p.maxLife) {
        const lon = 55 + Math.random() * 45;
        const lat = -5 + Math.random() * 30;
        const { x, y } = lonLatToXY(lon, lat);
        p.position.set(x, p.position.y, y);
        p.velocity.set(0, 0, 0);
        p.life = 0;
      }
      arr[i * 3] = p.position.x;
      arr[i * 3 + 1] = p.position.y;
      arr[i * 3 + 2] = p.position.z;
    }
    (meshRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positionsRef.current, 3]}
          count={PARTICLE_COUNT}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.010}
        color="#00c8ff"
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
