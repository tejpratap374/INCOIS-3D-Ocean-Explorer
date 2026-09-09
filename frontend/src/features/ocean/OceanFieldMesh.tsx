import { useMemo, useRef, useEffect } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { lonLatToXY, depthToZ } from '@/utils/geo';
import { colorFor } from '@/utils/colorScales';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';

export function OceanFieldMesh() {
  const field = useOceanStore((s) => s.field);
  const palette = useOceanStore((s) => s.palette);
  const vmin = useOceanStore((s) => s.vmin);
  const vmax = useOceanStore((s) => s.vmax);
  const reverseScale = useOceanStore((s) => s.reverseScale);
  const scale = useOceanStore((s) => s.scale);
  const opacity = useOceanStore((s) => s.opacity);
  const showModel = useOceanStore((s) => s.showModelLayer);
  const ve = useOceanStore((s) => s.verticalExaggeration);
  const depth = useOceanStore((s) => s.depth);

  const resolvedVmin = vmin ?? field?.min_value ?? 0;
  const resolvedVmax = vmax ?? field?.max_value ?? 30;

  // Build a proper plane geometry with vertex colors
  const { geometry, material } = useMemo(() => {
    if (!field || !field.latitude.length || !field.longitude.length) {
      return { geometry: null, material: null };
    }
    const lats = field.latitude as number[];
    const lons = field.longitude as number[];
    const data = field.data as number[][];

    const nlat = lats.length;
    const nlon = lons.length;

    // Create plane geometry with segments
    const geo = new THREE.PlaneGeometry(2, 2, nlon - 1, nlat - 1);

    // Get the current depth for z-position
    const zPos = depth > 0 ? depthToZ(depth, ve) : 0.0;

    // Set vertex positions based on lat/lon and set colors
    const positions = geo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];

    for (let i = 0; i < nlat; i++) {
      for (let j = 0; j < nlon; j++) {
        const lon = lons[j];
        const lat = lats[i];
        const val = data[i]?.[j] ?? NaN;
        if (isNaN(val)) continue;

        // Position in our 3D coordinate system
        const { x, y } = lonLatToXY(lon, lat);
        const vertexIdx = i * nlon + j;
        positions.setXYZ(vertexIdx, x, zPos, y);

        // Color
        const rgb = colorFor(val, resolvedVmin, resolvedVmax, palette, reverseScale, scale);
        colors.push(rgb[0], rgb[1], rgb[2]);
      }
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // Create vertex shader for pulsing effect with depth-aware color
    const mat = new THREE.ShaderMaterial({
      vertexColors: true,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: opacity },
        uIsDeep: { value: depth > 0 ? 1.0 : 0.0 },
      },
      vertexShader: `
        varying vec3 vColor;
        varying vec3 vPosition;
        uniform float uTime;
        void main() {
          vColor = color;
          vPosition = position;
          // Subtle wave distortion (only at surface)
          vec3 pos = position;
          pos.y += sin(pos.x * 8.0 + uTime * 1.5) * 0.002;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying vec3 vPosition;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uIsDeep;
        void main() {
          // Subtle shimmer effect
          float shimmer = 0.92 + 0.08 * sin(vPosition.x * 15.0 + uTime * 2.0);
          vec3 col = vColor * shimmer;
          // For deep slices, slightly desaturate to suggest attenuation
          if (uIsDeep > 0.5) {
            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(col, vec3(lum * 0.7, lum * 0.85, lum), 0.2);
          }
          gl_FragColor = vec4(col, uOpacity);
        }
      `,
    });

    return { geometry: geo, material: mat };
  }, [field, resolvedVmin, resolvedVmax, palette, reverseScale, scale, opacity, ve, depth]);

  const meshRef = useRef<THREE.Mesh>(null);

  // Update time uniform
  useFrame(({ clock }) => {
    if (material?.uniforms) {
      (material.uniforms.uTime as any).value = clock.elapsedTime;
      (material.uniforms.uOpacity as any).value = opacity;
      (material.uniforms.uIsDeep as any).value = depth > 0 ? 1.0 : 0.0;
    }
  });

  if (!field || !geometry || !material || !showModel) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} />
  );
}

// ─── Colorbar Legend rendered in 3D ──────────────────────────────────────────
export function ColorbarLegend() {
  const field = useOceanStore((s) => s.field);
  const palette = useOceanStore((s) => s.palette);
  const vmin = useOceanStore((s) => s.vmin);
  const vmax = useOceanStore((s) => s.vmax);
  const opacity = useOceanStore((s) => s.opacity);
  const reverseScale = useOceanStore((s) => s.reverseScale);

  const resolvedVmin = vmin ?? field?.min_value ?? 0;
  const resolvedVmax = vmax ?? field?.max_value ?? 30;
  const unit = field?.unit ?? '';
  const variable = field?.variable ?? '';

  const STEPS = 32;
  const stops = useMemo(() => {
    return Array.from({ length: STEPS }, (_, i) => {
      const t = i / (STEPS - 1);
      const rgb = colorFor(reverseScale ? (1 - t) : t, 0, 1, palette, false, 'linear');
      return [rgb[0], rgb[1], rgb[2]];
    });
  }, [palette, reverseScale]);

  const barHeight = 1.2;
  const barWidth = 0.08;
  const barX = 0.88;
  const barY = 0.0;

  return (
    <group position={[barX, barY, -0.95]}>
      {/* Background */}
      <mesh>
        <planeGeometry args={[0.18, barHeight + 0.36]} />
        <meshBasicMaterial color="#070e1a" transparent opacity={0.9} />
      </mesh>

      {/* Color bar segments */}
      {stops.map((color, i) => {
        const y = -barHeight / 2 + (i / (STEPS - 1)) * barHeight;
        return (
          <mesh key={i} position={[0, y, 0.001]}>
            <planeGeometry args={[barWidth, barHeight / STEPS + 0.002]} />
            <meshBasicMaterial color={new THREE.Color(color[0], color[1], color[2])} />
          </mesh>
        );
      })}

      {/* Border lines */}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[barWidth + 0.004, barHeight + 0.004]} />
        <meshBasicMaterial color="#00c8ff" transparent opacity={0.3} wireframe />
      </mesh>

      {/* Tick marks and labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = -barHeight / 2 + t * barHeight;
        const value = (resolvedVmin + t * (resolvedVmax - resolvedVmin)).toFixed(2);
        return (
          <group key={t} position={[barWidth / 2 + 0.02, y, 0.001]}>
            {/* Tick */}
            <mesh>
              <planeGeometry args={[0.015, 0.003]} />
              <meshBasicMaterial color="#00c8ff" transparent opacity={0.6} />
            </mesh>
            {/* Label */}
            <Text
              position={[0.025, 0, 0]}
              fontSize={0.018}
              color="#8aadbf"
              anchorX="left"
              anchorY="middle"
              outlineColor="#04080f"
              outlineWidth={0.001}
            >
              {value}
            </Text>
          </group>
        );
      })}

      {/* Unit label */}
      <Text
        position={[0, barHeight / 2 + 0.10, 0.001]}
        fontSize={0.018}
        color="#00c8ff"
        anchorX="center"
        outlineColor="#04080f"
        outlineWidth={0.001}
      >
        {variable.toUpperCase()}
      </Text>
      <Text
        position={[0, barHeight / 2 + 0.05, 0.001]}
        fontSize={0.014}
        color="#4d6d80"
        anchorX="center"
        outlineColor="#04080f"
        outlineWidth={0.001}
      >
        ({unit})
      </Text>
    </group>
  );
}
