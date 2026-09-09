import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useOceanStore } from '@/stores/oceanStore';
import { lonLatToVec3 } from '@/utils/geo';
import { colorFor } from '@/utils/colorScales';

const EARTH_RADIUS = 1.0;

/**
 * OceanSpherePatch — renders oceanographic model data as a colored mesh on the
 * surface of the Earth sphere, geographically registered to the actual lat/lon bounds
 * of the dataset.
 *
 * Continuous interpolation across all valid ocean cells and coastal boundaries,
 * with pixel-perfect fragment shader land clipping to eliminate missing spots & notch holes.
 */
export function OceanSpherePatch() {
  const field = useOceanStore((s) => s.field);
  const palette = useOceanStore((s) => s.palette);
  const vmin = useOceanStore((s) => s.vmin);
  const vmax = useOceanStore((s) => s.vmax);
  const reverseScale = useOceanStore((s) => s.reverseScale);
  const scale = useOceanStore((s) => s.scale);
  const opacity = useOceanStore((s) => s.opacity);
  const showModel = useOceanStore((s) => s.showModelLayer);
  const depth = useOceanStore((s) => s.depth);
  const vizMode = useOceanStore((s) => s.vizMode);

  const resolvedVmin = vmin ?? field?.min_value ?? 0;
  const resolvedVmax = vmax ?? field?.max_value ?? 30;

  const meshRef = useRef<THREE.Mesh>(null);

  // ─── Build continuous gapless sphere-patch geometry ─────────────────────────
  const geometry = useMemo(() => {
    if (!field?.latitude?.length || !field.longitude?.length) return null;

    const lats = field.latitude as number[];
    const lons = field.longitude as number[];
    const data = field.data as number[][];
    const nlat = lats.length;
    const nlon = lons.length;

    // Step 1: Identify all real ocean model data cells (non-null & non-NaN)
    const isRealOcean: boolean[][] = Array.from({ length: nlat }, () =>
      Array(nlon).fill(false)
    );
    let effectiveData: (number | null)[][] = Array.from({ length: nlat }, () =>
      Array(nlon).fill(null)
    );

    for (let i = 0; i < nlat; i++) {
      for (let j = 0; j < nlon; j++) {
        const val = data[i]?.[j];
        if (val != null && !isNaN(val)) {
          effectiveData[i][j] = val;
          isRealOcean[i][j] = true;
        }
      }
    }

    // Step 2: Multi-pass coastal infilling (3 passes outward into land boundary nodes)
    // Ensures coastal quad quads have 100% valid vertices, eliminating black triangle holes
    for (let pass = 0; pass < 3; pass++) {
      const nextData = effectiveData.map((row) => [...row]);
      let addedAny = false;
      for (let i = 0; i < nlat; i++) {
        for (let j = 0; j < nlon; j++) {
          if (effectiveData[i][j] == null) {
            let sum = 0;
            let count = 0;
            for (let di = -1; di <= 1; di++) {
              for (let dj = -1; dj <= 1; dj++) {
                if (di === 0 && dj === 0) continue;
                const ni = i + di;
                const nj = j + dj;
                if (ni >= 0 && ni < nlat && nj >= 0 && nj < nlon) {
                  const nval = effectiveData[ni][nj];
                  if (nval != null) {
                    sum += nval;
                    count++;
                  }
                }
              }
            }
            if (count > 0) {
              nextData[i][j] = sum / count;
              addedAny = true;
            }
          }
        }
      }
      effectiveData = nextData;
      if (!addedAny) break;
    }

    // Step 3: Build per-vertex positions & colors
    const positions: number[] = [];
    const colors: number[] = [];
    const nodeValid: boolean[] = [];
    const nodeRealOcean: boolean[] = [];

    for (let i = 0; i < nlat; i++) {
      const lat = lats[i];
      for (let j = 0; j < nlon; j++) {
        const lon = lons[j];
        const val = effectiveData[i][j];
        const real = isRealOcean[i][j];

        const radius = EARTH_RADIUS + 0.0015;
        const vec = lonLatToVec3(lon, lat, radius);
        positions.push(vec.x, vec.y, vec.z);

        if (val != null) {
          const rgb = colorFor(val, resolvedVmin, resolvedVmax, palette, reverseScale, scale);
          colors.push(rgb[0], rgb[1], rgb[2]);
          nodeValid.push(true);
          nodeRealOcean.push(real);
        } else {
          colors.push(0, 0, 0);
          nodeValid.push(false);
          nodeRealOcean.push(false);
        }
      }
    }

    // Step 4: Triangulate quads — render quads if all 3 vertices are valid & contain ocean data
    const indices: number[] = [];
    for (let i = 0; i < nlat - 1; i++) {
      for (let j = 0; j < nlon - 1; j++) {
        const v00 = i * nlon + j;
        const v10 = (i + 1) * nlon + j;
        const v01 = i * nlon + (j + 1);
        const v11 = (i + 1) * nlon + (j + 1);

        // Triangle 1: (v00, v01, v10)
        const t1Valid = nodeValid[v00] && nodeValid[v01] && nodeValid[v10];
        const t1HasOcean = nodeRealOcean[v00] || nodeRealOcean[v01] || nodeRealOcean[v10];
        if (t1Valid && t1HasOcean) {
          indices.push(v00, v01, v10);
        }

        // Triangle 2: (v10, v01, v11)
        const t2Valid = nodeValid[v10] && nodeValid[v01] && nodeValid[v11];
        const t2HasOcean = nodeRealOcean[v10] || nodeRealOcean[v01] || nodeRealOcean[v11];
        if (t2Valid && t2HasOcean) {
          indices.push(v10, v01, v11);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [field, depth, vizMode, resolvedVmin, resolvedVmax, palette, reverseScale, scale]);

  // ─── Land Mask Texture ────────────────────────────────────────────────────────
  const landMask = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/assets/earth/specular/earth_specular_2048.jpg');
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, []);

  // ─── Shader material ─────────────────────────────────────────────────────────
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexColors: true,
      transparent: true,
      opacity: opacity,
      depthWrite: true,
      side: THREE.FrontSide,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: opacity },
        uDepth: { value: depth },
        uVizMode: { value: vizMode === 'depth_slice' ? 1.0 : 0.0 },
        uLandMask: { value: landMask },
      },
      vertexShader: `
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

        void main() {
          vColor = color;
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform float uTime;
        uniform sampler2D uLandMask;

        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

        const float PI = 3.14159265359;

        void main() {
          // Calculate geographic lat/lon from spherical position
          vec3 pos = normalize(vWorldPos);
          float lat = asin(clamp(pos.y, -1.0, 1.0));
          float lon = atan(pos.x, pos.z); // lon in [-PI, PI]

          float u = 0.5 + lon / (2.0 * PI);
          float v = 0.5 + lat / PI;

          float isOcean = texture2D(uLandMask, vec2(u, v)).r;

          // Discard true land pixels (isOcean < 0.12)
          if (isOcean < 0.12) {
            discard;
          }

          // Full vibrant un-dimmed scientific variable color
          vec3 color = vColor;

          gl_FragColor = vec4(color, uOpacity);
        }
      `,
    });
  }, [opacity, depth, vizMode, landMask]);

  // ─── Per-frame updates ──────────────────────────────────────────────────────
  useFrame(({ clock }) => {
    if (material?.uniforms) {
      (material.uniforms.uTime as any).value = clock.elapsedTime;
      (material.uniforms.uOpacity as any).value = opacity;
    }
  });

  if (!field || !geometry || !material || !showModel) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      renderOrder={1}
    />
  );
}

