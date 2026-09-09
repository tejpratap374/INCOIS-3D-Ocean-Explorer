import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useOceanStore } from '@/stores/oceanStore';

const ATMOSPHERE_RADIUS = 1.025;

/**
 * EarthAtmosphere — a soft outer glow that surrounds the Earth sphere.
 * Rendered with back-side rendering and additive blending so it only appears
 * at the limb (silhouette) of the Earth.
 */
export function EarthAtmosphere() {
  const showAtmosphere = useOceanStore((s) => s.showAtmosphere);
  const glowRef = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uGlowColor: { value: new THREE.Color('#3a8ad8') },
        uGlowIntensity: { value: 0.8 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        uniform float uTime;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          float pulse = 1.0 + 0.015 * sin(uTime * 0.4);
          gl_Position = projectionMatrix * mvPosition * pulse;
        }
      `,
      fragmentShader: `
        uniform vec3 uGlowColor;
        uniform float uGlowIntensity;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, normalize(vViewPosition)), 3.0);
          gl_FragColor = vec4(uGlowColor * intensity * uGlowIntensity, intensity * 0.5);
        }
      `,
    });
  }, []);

  useFrame(({ clock }) => {
    if (material.uniforms) {
      (material.uniforms.uTime as any).value = clock.elapsedTime;
    }
  });

  if (!showAtmosphere) return null;

  return (
    <mesh ref={glowRef} scale={[1, 1, 1]} material={material}>
      <sphereGeometry args={[ATMOSPHERE_RADIUS, 64, 32]} />
    </mesh>
  );
}
