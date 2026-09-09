import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useOceanStore } from '@/stores/oceanStore';
import { isOverOcean } from '@/data/geo';
import { colorFor, type ColorPalette } from '@/utils/colorScales';
import { dataApi } from '@/services/api';
import type { VerticalTransectData } from '@/types';

// Dimensions of the 3D Rectangular Ocean Data Cube
const CUBE_WIDTH = 3.0; // X axis = Longitude
const CUBE_DEPTH = 2.0; // Y axis = Depth (0 to 4000m)
const CUBE_LENGTH = 2.0; // Z axis = Latitude

interface DataCubeSceneProps {
  cubeMode: 'cube' | 'slice' | 'multi';
  viewMode: 'horizontal' | 'vertical' | 'volume';
  transectAxis?: 'lat' | 'lon';
  transectFixedValue?: number;
}

function DataCubeScene({ cubeMode, viewMode, transectAxis = 'lon', transectFixedValue = 70 }: DataCubeSceneProps) {
  const field = useOceanStore((s) => s.field);
  const depth = useOceanStore((s) => s.depth);
  const opacity = useOceanStore((s) => s.opacity);
  const variable = useOceanStore((s) => s.variable);
  const dataset = useOceanStore((s) => s.dataset);
  const currentTime = useOceanStore((s) => s.currentTime);
  const currentRegion = useOceanStore((s) => s.currentRegion);
  const volumeData = useOceanStore((s) => s.volumeData);
  const setVolumeData = useOceanStore((s) => s.setVolumeData);
  const setVolumeLoading = useOceanStore((s) => s.setVolumeLoading);

  // Depth Y position: maps 0m -> 0.0, 4000m -> -CUBE_DEPTH (-2.0)
  const sliceY = -(depth / 4000) * CUBE_DEPTH;

  const [volumeTextures, setVolumeTextures] = useState<THREE.Texture[]>([]);
  const [volumeDepths, setVolumeDepths] = useState<number[]>([]);
  const [volumeMinMax, setVolumeMinMax] = useState<{ min: number; max: number }>({ min: 0, max: 30 });
  const fetchingRef = useRef(false);

  // Vertical transect state
  const [verticalTexture, setVerticalTexture] = useState<THREE.Texture | null>(null);
  const [verticalTransectData, setVerticalTransectData] = useState<VerticalTransectData | null>(null);
  const verticalFetchingRef = useRef(false);

  // Choose scientific palette per variable
  const palette: ColorPalette = variable === 'salinity' ? 'haline' : variable === 'chl' ? 'algae' : 'thermal';

  // Fetch volume data when in cube mode (3D Data Cube)
  useEffect(() => {
    if (cubeMode !== 'cube' || fetchingRef.current) return;

    const fetchVolume = async () => {
      fetchingRef.current = true;
      setVolumeLoading(true);
      try {
        // Get region bounds
        const regionConfig = {
          indian_ocean: { lat_min: -60, lat_max: 30, lon_min: 20, lon_max: 120 },
          arabian_sea: { lat_min: 8, lat_max: 25, lon_min: 55, lon_max: 78 },
          bay_of_bengal: { lat_min: 5, lat_max: 22, lon_min: 80, lon_max: 100 },
          somali_jet: { lat_min: -5, lat_max: 20, lon_min: 45, lon_max: 78 },
          equatorial_jet: { lat_min: -5, lat_max: 10, lon_min: 50, lon_max: 100 },
          world: { lat_min: -90, lat_max: 90, lon_min: -180, lon_max: 180 },
        } as Record<string, { lat_min: number; lat_max: number; lon_min: number; lon_max: number }>;

        const bounds = regionConfig[currentRegion] || regionConfig.indian_ocean;

        const volume = await dataApi.getVolume({
          dataset_id: dataset,
          variable,
          time: currentTime,
          lat_min: bounds.lat_min,
          lat_max: bounds.lat_max,
          lon_min: bounds.lon_min,
          lon_max: bounds.lon_max,
          depth_min: 0,
          depth_max: 4000,
          depth_levels: 20,
        });

        setVolumeData(volume);
        setVolumeDepths(volume.depth);
        setVolumeMinMax({ min: volume.valid_range[0], max: volume.valid_range[1] });

        // Generate textures for each depth level
        const textures: THREE.Texture[] = [];
        const lats = volume.lat;
        const lons = volume.lon;
        const width = lons.length;
        const height = lats.length;

        for (let d = 0; d < volume.depth.length; d++) {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          const imgData = ctx.createImageData(width, height);
          const data = imgData.data;
          const depthData = (volume.data[0]?.[d] as unknown as number[][]) || [];

          for (let i = 0; i < height; i++) {
            const lat = lats[i] ?? 0;
            for (let j = 0; j < width; j++) {
              const lon = lons[j] ?? 0;
              const pixelIdx = (i * width + j) * 4;

              // Apply strict land/ocean mask: Land -> solid bedrock color
              if (!isOverOcean(lat, lon)) {
                data[pixelIdx] = 10;
                data[pixelIdx + 1] = 25;
                data[pixelIdx + 2] = 47;
                data[pixelIdx + 3] = 255;
                continue;
              }

              const rawVal = depthData[i]?.[j] ?? volume.valid_range[0];
              const normalized = Math.max(0, Math.min(1, (rawVal - volume.valid_range[0]) / (volume.valid_range[1] - volume.valid_range[0] || 1)));

              const [rNorm, gNorm, bNorm] = colorFor(normalized, 0, 1, palette);

              data[pixelIdx] = Math.round(rNorm * 255);
              data[pixelIdx + 1] = Math.round(gNorm * 255);
              data[pixelIdx + 2] = Math.round(bNorm * 255);
              data[pixelIdx + 3] = 180; // Semi-transparent for volume stacking
            }
          }

          ctx.putImageData(imgData, 0, 0);
          const tex = new THREE.CanvasTexture(canvas);
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.needsUpdate = true;
          textures.push(tex);
        }

        setVolumeTextures(textures);
      } catch (err) {
        console.error('Failed to fetch volume data:', err);
      } finally {
        setVolumeLoading(false);
        fetchingRef.current = false;
      }
    };

    fetchVolume();
  }, [cubeMode, dataset, variable, currentTime, currentRegion, setVolumeData, setVolumeLoading, palette]);

  // Fetch vertical transect data when viewMode is 'vertical'
  useEffect(() => {
    if (viewMode !== 'vertical' || verticalFetchingRef.current) return;

    const fetchVertical = async () => {
      verticalFetchingRef.current = true;
      try {
        // Get region bounds for traverse range
        const regionConfig = {
          indian_ocean: { lat_min: -60, lat_max: 30, lon_min: 20, lon_max: 120 },
          arabian_sea: { lat_min: 8, lat_max: 25, lon_min: 55, lon_max: 78 },
          bay_of_bengal: { lat_min: 5, lat_max: 22, lon_min: 80, lon_max: 100 },
          somali_jet: { lat_min: -5, lat_max: 20, lon_min: 45, lon_max: 78 },
          equatorial_jet: { lat_min: -5, lat_max: 10, lon_min: 50, lon_max: 100 },
          world: { lat_min: -90, lat_max: 90, lon_min: -180, lon_max: 180 },
        } as Record<string, { lat_min: number; lat_max: number; lon_min: number; lon_max: number }>;

        const bounds = regionConfig[currentRegion] || regionConfig.indian_ocean;

        // Use transect props for axis and fixed value
        const axis = transectAxis;
        const fixedValue = transectFixedValue ?? (axis === 'lon' 
          ? (bounds.lon_min + bounds.lon_max) / 2 
          : (bounds.lat_min + bounds.lat_max) / 2);
        const traverseMin = axis === 'lon' ? bounds.lat_min : bounds.lon_min;
        const traverseMax = axis === 'lon' ? bounds.lat_max : bounds.lon_max;

        const transect = await dataApi.getVerticalTransect({
          dataset_id: dataset,
          variable,
          time: currentTime,
          axis,
          fixed_value: fixedValue,
          traverse_min: traverseMin,
          traverse_max: traverseMax,
          depth_min: 0,
          depth_max: 4000,
          depth_levels: 30,
          traverse_points: 100,
        });

        setVerticalTransectData(transect);

        // Generate texture from transect data [depth][traverse]
        const canvas = document.createElement('canvas');
        const width = transect.traverse_coords.length;
        const height = transect.depth.length;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imgData = ctx.createImageData(width, height);
          const data = imgData.data;

          for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
              const pixelIdx = (i * width + j) * 4;
              const rawVal = transect.data[i]?.[j] ?? transect.valid_range[0];
              const normalized = Math.max(0, Math.min(1, (rawVal - transect.valid_range[0]) / (transect.valid_range[1] - transect.valid_range[0] || 1)));

              const [rNorm, gNorm, bNorm] = colorFor(normalized, 0, 1, palette);

              data[pixelIdx] = Math.round(rNorm * 255);
              data[pixelIdx + 1] = Math.round(gNorm * 255);
              data[pixelIdx + 2] = Math.round(bNorm * 255);
              data[pixelIdx + 3] = 230;
            }
          }

          ctx.putImageData(imgData, 0, 0);
          const tex = new THREE.CanvasTexture(canvas);
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.needsUpdate = true;
          setVerticalTexture(tex);
        }
      } catch (err) {
        console.error('Failed to fetch vertical transect:', err);
      } finally {
        verticalFetchingRef.current = false;
      }
    };

    fetchVertical();
  }, [viewMode, dataset, variable, currentTime, currentRegion, transectAxis, transectFixedValue, palette]);

  // Generate scientific colormapped texture from field data with land masking (for slice mode)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const width = field?.longitude.length || 128;
    const height = field?.latitude.length || 128;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const lats = field?.latitude || [];
    const lons = field?.longitude || [];
    const gridData = field?.data || [];
    const minVal = field?.min_value ?? 0;
    const maxVal = field?.max_value ?? 30;
    const range = maxVal - minVal || 1.0;

    for (let i = 0; i < height; i++) {
      const lat = lats[i] ?? 0;
      for (let j = 0; j < width; j++) {
        const lon = lons[j] ?? 0;
        const pixelIdx = (i * width + j) * 4;

        // Apply strict land/ocean mask: Land -> solid bedrock color (fixes empty spaces)
        if (!isOverOcean(lat, lon)) {
          data[pixelIdx] = 10;
          data[pixelIdx + 1] = 25;
          data[pixelIdx + 2] = 47;
          data[pixelIdx + 3] = 255;
          continue;
        }

        const rawVal = gridData[i]?.[j] ?? minVal;
        const normalized = Math.max(0, Math.min(1, (rawVal - minVal) / range));

        // Use scientific colormap
        const [rNorm, gNorm, bNorm] = colorFor(normalized, 0, 1, palette);

        data[pixelIdx] = Math.round(rNorm * 255);
        data[pixelIdx + 1] = Math.round(gNorm * 255);
        data[pixelIdx + 2] = Math.round(bNorm * 255);
        data[pixelIdx + 3] = 230;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }, [field, variable, palette]);

  // Multiple parallel slice Y positions (250m, 750m, 1500m, 2500m)
  const multiSliceYs = [
    -(250 / 4000) * CUBE_DEPTH,
    -(750 / 4000) * CUBE_DEPTH,
    -(1500 / 4000) * CUBE_DEPTH,
    -(2500 / 4000) * CUBE_DEPTH,
  ];

  // Bounding box corner points
  const boxCorners = useMemo(() => {
    const hw = CUBE_WIDTH / 2;
    const hl = CUBE_LENGTH / 2;
    const top = 0;
    const bot = -CUBE_DEPTH;

    return [
      // Top square
      [[-hw, top, -hl], [hw, top, -hl]],
      [[hw, top, -hl], [hw, top, hl]],
      [[hw, top, hl], [-hw, top, hl]],
      [[-hw, top, hl], [-hw, top, -hl]],
      // Bottom square
      [[-hw, bot, -hl], [hw, bot, -hl]],
      [[hw, bot, -hl], [hw, bot, hl]],
      [[hw, bot, hl], [-hw, bot, hl]],
      [[-hw, bot, hl], [-hw, bot, -hl]],
      // Vertical edges
      [[-hw, top, -hl], [-hw, bot, -hl]],
      [[hw, top, -hl], [hw, bot, -hl]],
      [[hw, top, hl], [hw, bot, hl]],
      [[-hw, top, hl], [-hw, bot, hl]],
    ] as [[number, number, number], [number, number, number]][];
  }, []);

  return (
    <group>
      {/* ── Bounding Box Wireframe & Ticks ── */}
      {boxCorners.map((line, idx) => (
        <Line key={idx} points={line} color="#00e5ff" lineWidth={1.5} transparent opacity={0.6} />
      ))}

      {/* Depth Ticks */}
      {[0, 1000, 2000, 3000, 4000].map((d) => {
        const yPos = -(d / 4000) * CUBE_DEPTH;
        return (
          <group key={d} position={[-CUBE_WIDTH / 2 - 0.25, yPos, CUBE_LENGTH / 2]}>
            <Text fontSize={0.1} color="#00e5ff" anchorX="right">
              {`${d} m`}
            </Text>
          </group>
        );
      })}

      {/* Axis Labels */}
      <Text position={[0, 0.15, CUBE_LENGTH / 2 + 0.1]} fontSize={0.12} color="#64ffda">
        Longitude →
      </Text>
      <Text position={[-CUBE_WIDTH / 2 - 0.1, -CUBE_DEPTH / 2, CUBE_LENGTH / 2 + 0.1]} fontSize={0.12} color="#64ffda" rotation={[0, 0, Math.PI / 2]}>
        Depth (m) →
      </Text>

      {/* ── 3D Volume Rendering (cube mode) ── */}
      {cubeMode === 'cube' && volumeTextures.length > 0 && (
        <group>
          {volumeTextures.map((tex, idx) => {
            const depthVal = volumeDepths[idx];
            const yPos = -(depthVal / 4000) * CUBE_DEPTH;
            // Deeper = more opaque for accumulation effect
            const opacityFactor = 0.15 + (depthVal / 4000) * 0.25;
            return (
              <mesh key={idx} position={[0, yPos, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[CUBE_WIDTH, CUBE_LENGTH, 32, 32]} />
                <meshStandardMaterial
                  map={tex}
                  transparent
                  opacity={opacityFactor}
                  roughness={0.2}
                  metalness={0.1}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            );
          })}
        </group>
      )}

      {/* ── Upper Water Column Fading Box ── */}
      {depth > 0 && (cubeMode === 'slice' || cubeMode === 'cube') && viewMode !== 'vertical' && (
        <mesh position={[0, sliceY / 2, 0]}>
          <boxGeometry args={[CUBE_WIDTH, Math.abs(sliceY), CUBE_LENGTH]} />
          <meshStandardMaterial
            color="#003366"
            transparent
            opacity={opacity * 0.35}
            roughness={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* ── Horizontal Depth Slice Mesh ── */}
      {(cubeMode === 'slice' || cubeMode === 'cube') && viewMode !== 'vertical' && texture && (
        <mesh position={[0, sliceY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[CUBE_WIDTH, CUBE_LENGTH, 64, 64]} />
          <meshStandardMaterial
            map={texture}
            transparent
            roughness={0.2}
            metalness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* ── Multiple Parallel Slices Mode ── */}
      {cubeMode === 'multi' && texture && (
        <group>
          {multiSliceYs.map((y, idx) => (
            <mesh key={idx} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[CUBE_WIDTH, CUBE_LENGTH, 32, 32]} />
              <meshStandardMaterial
                map={texture}
                transparent
                opacity={0.85}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* ── Vertical Cross-Section Mode (Real Transect) ── */}
      {viewMode === 'vertical' && verticalTexture && verticalTransectData && (
        <group>
          {/* Vertical section plane - spans full depth, positioned at fixed longitude */}
          <mesh position={[0, -CUBE_DEPTH / 2, 0]}>
            <planeGeometry args={[CUBE_WIDTH, CUBE_DEPTH, 64, 64]} />
            <meshStandardMaterial
              map={verticalTexture}
              transparent
              opacity={0.95}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Transect axis labels */}
          <Text position={[0, 0.15, -CUBE_LENGTH / 2 - 0.15]} fontSize={0.1} color="#64ffda" anchorX="center">
            {verticalTransectData.traverse_axis === 'latitude' ? 'Latitude' : 'Longitude'} →
          </Text>
          <Text position={[-CUBE_WIDTH / 2 - 0.15, -CUBE_DEPTH / 2, -CUBE_LENGTH / 2 - 0.15]} fontSize={0.1} color="#64ffda" rotation={[0, 0, Math.PI / 2]}>
            Depth (m) →
          </Text>
          {/* Fixed coordinate label */}
          <Text position={[0, 0.15, CUBE_LENGTH / 2 + 0.15]} fontSize={0.08} color="#8892b0" anchorX="center">
            Fixed {verticalTransectData.fixed_axis}: {verticalTransectData.fixed_value.toFixed(1)}°
          </Text>
        </group>
      )}

      {/* ── Bathymetry Bedrock Floor ── */}
      <mesh position={[0, -CUBE_DEPTH - 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CUBE_WIDTH, CUBE_LENGTH]} />
        <meshStandardMaterial color="#0a192f" roughness={0.9} metalness={0.2} />
      </mesh>
    </group>
  );
}

export function OceanDataCubeCanvas({ cubeMode, viewMode }: DataCubeSceneProps) {
  return (
    <Canvas
      camera={{ position: [2.8, 1.8, 3.2], fov: 45 }}
      style={{ width: '100%', height: '100%', background: '#020814' }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={['#020814']} />
      <ambientLight intensity={0.6} color="#8ab4d8" />
      <directionalLight position={[3, 5, 2]} intensity={1.0} color="#ffffff" />
      <directionalLight position={[-3, -2, -2]} intensity={0.4} color="#00e5ff" />

      <DataCubeScene cubeMode={cubeMode} viewMode={viewMode} />

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={2.0}
        maxDistance={7.0}
        target={[0, -CUBE_DEPTH / 2, 0]}
      />
    </Canvas>
  );
}