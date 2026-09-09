import { useMemo, useRef, useEffect } from 'react';
import type { JSX } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { lonLatToXY, depthToZ } from '@/utils/geo';
import { colorFor } from '@/utils/colorScales';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text, Line } from '@react-three/drei';

interface GlobePoint {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  color: THREE.Color;
}

export function OceanGlobe() {
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
  const vizMode = useOceanStore((s) => s.vizMode);

  const resolvedVmin = vmin ?? field?.min_value ?? 0;
  const resolvedVmax = vmax ?? field?.max_value ?? 30;

  // Globe parameters
  const GLOBE_RADIUS = 0.8;
  const SEGMENTS = 64;

  // Build spherical geometry with vertex colors from ocean data
  const { geometry, material } = useMemo(() => {
    if (!field || !field.latitude.length || !field.longitude.length) {
      return { geometry: null, material: null };
    }
    const lats = field.latitude as number[];
    const lons = field.longitude as number[];
    const data = field.data as number[][];

    const nlat = lats.length;
    const nlon = lons.length;

    // Create sphere geometry
    const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, nlon, nlat);

    // Get vertex positions and normals
    const positions = sphereGeo.attributes.position as THREE.BufferAttribute;
    const normals = sphereGeo.attributes.normal as THREE.BufferAttribute;

    // Create color attribute
    const colors: number[] = [];

    // Map each vertex to nearest lat/lon in our data grid
    for (let i = 0; i < positions.count; i++) {
      // Convert vertex position to spherical coordinates
      const pos = new THREE.Vector3();
      pos.fromBufferAttribute(positions, i);

      // Get spherical coordinates
      const lon = Math.atan2(pos.z, pos.x);
      const lat = Math.asin(Math.max(-1, Math.min(1, pos.y / GLOBE_RADIUS)));

      // Convert to degrees and find nearest data point
      const latDeg = lat * (180 / Math.PI);
      const lonDeg = lon * (180 / Math.PI);

      // Map to data indices
      const latIndex = Math.round(
        ((latDeg + 5) / 30) * (nlat - 1)
      );
      const lonIndex = Math.round(
        ((lonDeg - 55) / 45) * (nlon - 1)
      );

      // Clamp to valid range
      const latIdx = Math.max(0, Math.min(nlat - 1, latIndex));
      const lonIdx = Math.max(0, Math.min(nlon - 1, lonIndex));

      const val = data[latIdx]?.[lonIdx] ?? NaN;

      // Position vertex (with depth adjustment for slice mode)
      let adjustedRadius = GLOBE_RADIUS;
      if (depth > 0 && vizMode === 'depth_slice') {
        // For depth slice, we extrude inward/outward based on data value
        const depthFactor = depthToZ(depth, ve);
        const normalizedVal = (val - resolvedVmin) / (resolvedVmax - resolvedVmin + 1e-9);
        adjustedRadius = GLOBE_RADIUS + (normalizedVal - 0.5) * 0.15;
      }

      pos.normalize().multiplyScalar(adjustedRadius);
      positions.setXYZ(i, pos.x, pos.y, pos.z);

      // Color based on data value
      if (!isNaN(val)) {
        const rgb = colorFor(val, resolvedVmin, resolvedVmax, palette, reverseScale, scale);
        colors.push(rgb[0], rgb[1], rgb[2]);
      } else {
        // Default color for missing data (deep ocean blue)
        colors.push(0.05, 0.1, 0.2);
      }
    }

    sphereGeo.setAttribute('position', positions);
    sphereGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    sphereGeo.computeVertexNormals();

    const landMask = new THREE.TextureLoader().load('/assets/earth/specular/earth_specular_2048.jpg');
    landMask.wrapS = THREE.RepeatWrapping;
    landMask.wrapT = THREE.ClampToEdgeWrapping;

    // Enhanced shader with atmospheric scattering and depth fog
    const material = new THREE.ShaderMaterial({
      vertexColors: true,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: opacity },
        uGlowIntensity: { value: 0.3 },
        uAtmosphereHeight: { value: 0.15 },
        uFogDensity: { value: 0.4 },
        uIsDeep: { value: depth > 0 ? 1.0 : 0.0 },
        uDepth: { value: depth },
        uVe: { value: ve },
        uLandMask: { value: landMask },
      },
      vertexShader: `
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        uniform float uTime;
        void main() {
          vColor = color;
          vNormal = normal;
          vPosition = position;
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          vec3 pos = position;

          // Subtle animated distortion for surface vitality
          float timeWave = uTime * 0.1;
          float distortion = sin(pos.x * 4.0 + timeWave) * sin(pos.z * 4.0 + timeWave * 1.3) * 0.008;
          pos += normal * distortion;

          gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uGlowIntensity;
        uniform float uAtmosphereHeight;
        uniform float uFogDensity;
        uniform float uIsDeep;
        uniform float uDepth;
        uniform float uVe;
        uniform sampler2D uLandMask;

        const float PI = 3.14159265359;

        // Atmospheric scattering constants
        const vec3 atmosphereColor = vec3(0.6, 0.8, 1.0);
        const float atmosphereSize = 1.05;

        void main() {
          // Mask out land pixels so data layer never overlaps land
          vec3 pos = normalize(vWorldPosition);
          float lat = asin(clamp(pos.y, -1.0, 1.0));
          float lon = atan(pos.x, pos.z);
          float u = 0.5 + lon / (2.0 * PI);
          float v = 0.5 + lat / PI;
          float isOcean = texture2D(uLandMask, vec2(u, v)).r;

          if (isOcean < 0.02) {
            discard;
          }

          // Base color from data
          vec3 color = vColor;

          // Calculate view and light directions
          vec3 viewDir = normalize(-vWorldPosition);
          vec3 lightDir = normalize(vec3(0.3, 0.8, 0.5));

          // Diffuse lighting
          float diffuse = max(dot(vNormal, lightDir), 0.0);
          float ambient = 0.3;

          // Fresnel term for atmospheric glow
          float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

          // Atmospheric scattering
          float atmosphere = pow(saturate(1.0 - dot(viewDir, vNormal)), 2.0);
          vec3 atmosColor = atmosphereColor * atmosphere * uGlowIntensity;

          // Depth-based fog (simulate water absorption)
          float depthFactor = length(vWorldPosition) / (GLOBE_RADIUS + uAtmosphereHeight);
          float fog = exp(-uFogDensity * depthFactor);
          fog = clamp(fog, 0.2, 1.0);

          // Apply lighting and fog
          color = color * (ambient + diffuse) * fog;

          // Add atmospheric glow
          color += atmosColor;

          // For deep slices, darken and blue-shift
          if (uIsDeep > 0.5) {
            float depthAmount = uDepth / 4000.0; // Normalize to max expected depth
            color = mix(color, vec3(0.02, 0.04, 0.1), depthAmount * 0.6);
          }

          gl_FragColor = vec4(color, uOpacity);
        }

        // Utility function
        float saturate(float x) {
          return clamp(x, 0.0, 1.0);
        }
      `,
    });

    return { geometry: sphereGeo, material };
  }, [
    field,
    resolvedVmin,
    resolvedVmax,
    palette,
    reverseScale,
    scale,
    opacity,
    showModel,
    ve,
    depth,
    vizMode,
  ]);

  const meshRef = useRef<THREE.Mesh>(null);

  // Update time uniform
  useFrame(({ clock }) => {
    if (material?.uniforms) {
      (material.uniforms.uTime as any).value = clock.elapsedTime;
      (material.uniforms.uOpacity as any).value = opacity;
    }
  });

  if (!field || !geometry || !material || !showModel) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} castShadow receiveShadow />
  );
}

// Enhanced Globe Grid with lat/lon labels
export function GlobeGrid() {
  const globeRadius = 0.81; // Slightly larger than globe
  const ve = useOceanStore((s) => s.verticalExaggeration);
  const depth = useOceanStore((s) => s.depth);
  const vizMode = useOceanStore((s) => s.vizMode);

  // Adjust grid radius for depth slices
  const adjustedRadius = globeRadius + (depth > 0 && vizMode === 'depth_slice' ? 0.05 : 0);

  const lines: JSX.Element[] = [];

  // Meridians (longitude lines)
  for (let lon = -180; lon <= 180; lon += 10) {
    const points: number[] = [];
    for (let lat = -90; lat <= 90; lat += 2) {
      const latRad = (lat * Math.PI) / 180;
      const lonRad = (lon * Math.PI) / 180;
      const x = adjustedRadius * Math.cos(latRad) * Math.cos(lonRad);
      const y = adjustedRadius * Math.sin(latRad);
      const z = adjustedRadius * Math.cos(latRad) * Math.sin(lonRad);
      points.push(x, y, z);
    }
    lines.push(
      <Line key={`meridian-${lon}`} points={points} color="#00c8ff" lineWidth={0.5} transparent opacity={0.15} />
    );
  }

  // Parallels (latitude lines) - only every 15 degrees to reduce clutter
  for (let lat = -90; lat <= 90; lat += 15) {
    const points: number[] = [];
    for (let lon = -180; lon <= 180; lon += 2) {
      const latRad = (lat * Math.PI) / 180;
      const lonRad = (lon * Math.PI) / 180;
      const x = adjustedRadius * Math.cos(latRad) * Math.cos(lonRad);
      const y = adjustedRadius * Math.sin(latRad);
      const z = adjustedRadius * Math.cos(latRad) * Math.sin(lonRad);
      points.push(x, y, z);
    }
    lines.push(
      <Line key={`parallel-${lat}`} points={points} color="#00c8ff" lineWidth={0.5} transparent opacity={0.15} />
    );
  }

  return <>{lines}</>;
}

// Globe-specific reference points with 3D positioning
export function GlobeReferencePoints() {
  const REFERENCE_POINTS: { name: string; lon: number; lat: number }[] = [
    { name: 'Mumbai', lon: 72.88, lat: 19.08 },
    { name: 'Chennai', lon: 80.27, lat: 13.08 },
    { name: 'Kochi', lon: 76.27, lat: 9.97 },
    { name: 'Visakhapatnam', lon: 83.30, lat: 17.69 },
    { name: 'Goa', lon: 73.83, lat: 15.50 },
    { name: 'Port Blair', lon: 92.74, lat: 11.62 },
    { name: 'Male', lon: 73.51, lat: 4.18 },
    { name: 'Colombo', lon: 79.86, lat: 6.93 },
    { name: 'Diego Garcia', lon: 72.37, lat: -7.31 },
    { name: 'Perth', lon: 115.86, lat: -31.95 },
    { name: 'Jakarta', lon: 106.83, lat: -6.18 },
    { name: 'Singapore', lon: 103.82, lat: 1.36 },
  ];

  const globeRadius = 0.82; // Slightly above surface

  return (
    <>
      {REFERENCE_POINTS.map((p) => {
        const latRad = (p.lat * Math.PI) / 180;
        const lonRad = (p.lon * Math.PI) / 180;
        const x = globeRadius * Math.cos(latRad) * Math.cos(lonRad);
        const y = globeRadius * Math.sin(latRad);
        const z = globeRadius * Math.cos(latRad) * Math.sin(lonRad);

        return (
          <group key={p.name} position={[x, y, z]}>
            <mesh>
              <sphereGeometry args={[0.01, 8, 8]} />
              <meshBasicMaterial color="#f5a623" />
            </mesh>
            <Text
              position={[0, 0.02, 0]}
              fontSize={0.014}
              color="#8aadbf"
              anchorX="left"
              anchorY="bottom"
              outlineColor="#04080f"
              outlineWidth={0.001}
              rotation={[0, 0, -lonRad]}
            >
              {p.name}
            </Text>
          </group>
        )}
      )}
    </>
  );
}