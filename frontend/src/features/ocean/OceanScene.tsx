import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Text, Billboard } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useOceanStore } from '@/stores/oceanStore';
import { depthToSphereOffset, lonLatToVec3 } from '@/utils/geo';
import styles from './OceanScene.module.css';

import { dataApi } from '@/services/api';
import { EarthBase } from './EarthBase';
import { EarthAtmosphere } from './EarthAtmosphere';
import { Atmosphere } from '@/features/earth/Atmosphere';
import { CloudLayer } from '@/features/earth/CloudLayer';
import { StarField } from '@/features/earth/StarField';
import { ContinentalOverlay } from './ContinentalOverlay';
import { CoastlineLayer } from '@/features/earth/CoastlineLayer';
import { SphereGrid } from './SphereGrid';
import { OceanSpherePatch } from './OceanSpherePatch';
import { OceanIsosurfacePatch } from './OceanIsosurfacePatch';
import { OceanCurrents } from './OceanCurrents';
import { OceanParticles } from './OceanParticles';
import { SphereObservations } from './SphereObservations';
import { HFRadarLayer } from './HFRadarLayer';
import { ADCPMooringLayer } from './ADCPMooringLayer';
import { SphereProbe } from './SphereInspector';
import { SphereLabels } from './SphereLabels';
import { REGION_CONFIGS, getRegionName, formatRegionBounds } from '@/config/regions';

// ─── Billboard Label with Dynamic Zoom Scaling ───────────────────────────────

function ZoomLabel({
  position,
  children,
}: {
  position: { x: number; y: number; z: number };
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Dynamic scale calculation matching Argo/Glider/Mooring devices exactly
  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    const dist = camera.position.length();
    const targetScale = THREE.MathUtils.clamp((dist - 1.0) * 0.95 + 0.35, 0.75, 3.2);
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
  });

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      <Billboard>{children}</Billboard>
    </group>
  );
}

// ─── Camera Controller ─────────────────────────────────────────────────────────

function CameraController() {
  const { camera } = useThree();
  const preset = useOceanStore((s) => s.cameraPreset);
  const region = useOceanStore((s) => s.currentRegion);
  const controls = useRef<any>(null);

  useEffect(() => {
    const target = new THREE.Vector3(0, 0, 0);
    let pos: [number, number, number];
    let fov = 45;

    switch (preset) {
      case 'top':
        pos = [0, 3.5, 0];
        break;
      case 'side':
        pos = [3.5, 0, 0];
        break;
      case 'india':
        pos = [0.4, 1.0, 1.5];
        break;
      case 'global':
        pos = [1.8, 1.0, 1.8];
        fov = 50;
        break;
      default: {
        // Auto-position based on selected region.
        // North is +Y. Camera sits above the region's center lat/lon on the
        // equatorial radius so the view is always top-down (no tilt).
        const config = REGION_CONFIGS.find(r => r.id === region);
        if (config) {
          const latRad = (config.center.lat * Math.PI) / 180;
          const lonRad = (config.center.lon * Math.PI) / 180;
          const dist = 2.4;
          // Mirror lonLatToVec3 exactly so camera sits at the region's
          // geographic center on the sphere surface.
          const sinLat = Math.sin(latRad);
          const cosLat = Math.cos(latRad);
          pos = [
            dist * cosLat * Math.sin(lonRad),  // X: matches lonLatToVec3
            dist * sinLat,                     // Y: up = north
            dist * cosLat * Math.cos(lonRad),  // Z: 0° lon = toward camera
          ];
          fov = config.fov ?? 40;
        } else {
          pos = [1.2, 0.9, 1.4];
        }
      }
    }

    camera.position.set(...pos);
    if ((camera as THREE.PerspectiveCamera).fov !== undefined) {
      (camera as THREE.PerspectiveCamera).fov = fov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
    camera.lookAt(target);
  }, [preset, region, camera]);

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.08}
      minDistance={1.4}
      maxDistance={6.0}
      target={[0, 0, 0]}
      enablePan={true}
      panSpeed={0.4}
      rotateSpeed={0.6}
      zoomSpeed={1.0}
      // Constrain to horizontal-only rotation around the polar (Y) axis.
      // User can spin the globe left/right (azimuth) and zoom, but cannot
      // tilt it upside-down — keeps North up.
      minPolarAngle={0.01}
      maxPolarAngle={Math.PI - 0.01}
    />
  );
}

// ─── Depth Slice Plane ─────────────────────────────────────────────────────────

/**
 * A transparent cutting plane through the Earth at a given depth,
 * rendered as a translucent sphere shell segment showing the depth slice extent.
 */
function DepthSliceIndicator() {
  const depth = useOceanStore((s) => s.depth);
  const vizMode = useOceanStore((s) => s.vizMode);

  if (depth === 0 || vizMode !== 'depth_slice') return null;

  const outerRadius = 1.0 + depthToSphereOffset(depth) + 0.002;
  const innerRadius = 1.0 + depthToSphereOffset(Math.max(0, depth - 500));

  return (
    <group>
      {/* Outer boundary ring */}
      <mesh>
        <sphereGeometry args={[outerRadius, 64, 32]} />
        <meshBasicMaterial
          color="#00c8ff"
          transparent
          opacity={0.05}
          side={THREE.FrontSide}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[outerRadius, 64, 32]} />
        <meshBasicMaterial
          color="#00c8ff"
          transparent
          opacity={0.12}
          wireframe
        />
      </mesh>
    </group>
  );
}

// ─── INCOIS Indian Ocean Border ────────────────────────────────────────────────

// ─── INCOIS Indian Ocean Border & Regional 3D Labels ──────────────────────────

/** Draws a prominent 4-sided cyan border and corner badges around the Indian Ocean region */
function IndianOceanBorder() {
  const points = useMemo(() => {
    const latMin = -60;
    const latMax = 30;
    const lonMin = 20;
    const lonMax = 120;
    const R = 1.0025;
    const steps = 48;
    const pts: [number, number, number][] = [];

    // 1. Bottom edge (South: latMin, lonMin -> lonMax)
    for (let i = 0; i <= steps; i++) {
      const lon = lonMin + (i / steps) * (lonMax - lonMin);
      const v = lonLatToVec3(lon, latMin, R);
      pts.push([v.x, v.y, v.z]);
    }
    // 2. Right edge (East: lonMax, latMin -> latMax)
    for (let i = 0; i <= steps; i++) {
      const lat = latMin + (i / steps) * (latMax - latMin);
      const v = lonLatToVec3(lonMax, lat, R);
      pts.push([v.x, v.y, v.z]);
    }
    // 3. Top edge (North: latMax, lonMax -> lonMin)
    for (let i = 0; i <= steps; i++) {
      const lon = lonMax - (i / steps) * (lonMax - lonMin);
      const v = lonLatToVec3(lon, latMax, R);
      pts.push([v.x, v.y, v.z]);
    }
    // 4. Left edge (West: lonMin, latMax -> latMin)
    for (let i = 0; i <= steps; i++) {
      const lat = latMax - (i / steps) * (latMax - latMin);
      const v = lonLatToVec3(lonMin, lat, R);
      pts.push([v.x, v.y, v.z]);
    }

    return pts;
  }, []);

  const corners = useMemo(() => {
    const R = 1.006;
    return [
      { text: '30°N, 20°E', pos: lonLatToVec3(20, 30, R) },
      { text: '30°N, 120°E', pos: lonLatToVec3(120, 30, R) },
      { text: '60°S, 20°E', pos: lonLatToVec3(20, -60, R) },
      { text: '60°S, 120°E', pos: lonLatToVec3(120, -60, R) },
    ];
  }, []);

  return (
    <group>
      {/* Outer ambient glow line */}
      <Line
        points={points}
        color="#0088ff"
        lineWidth={5.0}
        transparent
        opacity={0.4}
      />
      {/* Primary sharp cyan border */}
      <Line
        points={points}
        color="#00f0ff"
        lineWidth={2.8}
        transparent
        opacity={0.95}
      />

      {/* 4 Corner Coordinate Badges */}
      {corners.map((c, i) => (
        <ZoomLabel key={`corner-${i}`} position={c.pos}>
          <Text
            fontSize={0.016}
            color="#00f0ff"
            anchorX="center"
            anchorY="middle"
            outlineColor="#000000"
            outlineWidth={0.0025}
            renderOrder={26}
            material-depthTest={false}
            material-depthWrite={false}
          >
            {c.text}
          </Text>
        </ZoomLabel>
      ))}
    </group>
  );
}

// ─── Main Scene ────────────────────────────────────────────────────────────────

export function OceanScene() {
  const isLoading = useOceanStore((s) => s.isLoading);
  const field = useOceanStore((s) => s.field);
  const showCurrents = useOceanStore((s) => s.showCurrents);
  const showParticles = useOceanStore((s) => s.showParticles);
  const showArgo = useOceanStore((s) => s.showArgoLayer);
  const showGlider = useOceanStore((s) => s.showGliderLayer);
  const showAtmosphere = useOceanStore((s) => s.showAtmosphere);
  const showLand = useOceanStore((s) => s.showLandMasses);
  const showCoastline = useOceanStore((s) => s.showCoastline);
  const currentTime = useOceanStore((s) => s.currentTime);
  const variable = useOceanStore((s) => s.variable);
  const depth = useOceanStore((s) => s.depth);
  const vizMode = useOceanStore((s) => s.vizMode);
  const currentRegion = useOceanStore((s) => s.currentRegion);
  const regionConfig = REGION_CONFIGS.find((r) => r.id === currentRegion);
  const regionBounds = regionConfig
    ? formatRegionBounds(regionConfig.domain)
    : 'Global · 180°W–180°E · 90°S–90°N';
  const dataset = useOceanStore((s) => s.dataset);
  const setField = useOceanStore((s) => s.setField);
  const setLoading = useOceanStore((s) => s.setLoading);
  const setError = useOceanStore((s) => s.setError);
  const setPalette = useOceanStore((s) => s.setPalette);
  const setVmin = useOceanStore((s) => s.setVmin);
  const setVmax = useOceanStore((s) => s.setVmax);

  const setVectorField = useOceanStore((s) => s.setVectorField);

  // Automatically fetch ocean field & update colormap when variable, depth, time, region, or dataset changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    if (variable === 'temperature') setPalette('thermal');
    else if (variable === 'salinity') setPalette('haline');
    else if (variable === 'chl') setPalette('algae');
    else if (variable === 'currents') setPalette('turbo');
    else if (variable === 'ssh') setPalette('balance');

    dataApi
      .getField({
        dataset: dataset || 'godas_indian_ocean',
        variable: variable || 'temperature',
        time: currentTime,
        depth: depth || 0,
        region: currentRegion !== 'global' ? currentRegion : undefined,
        resolution: 160,
      })
      .then((f) => {
        if (!cancelled && f) {
          setField(f);
          if (f.min_value !== undefined && f.max_value !== undefined) {
            setVmin(f.min_value);
            setVmax(f.max_value);
          }
          setLoading(false);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoading(false);
          setError(err?.message || 'Failed to fetch field');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dataset, variable, depth, currentTime, currentRegion, setField, setLoading, setError, setPalette, setVmin, setVmax]);

  // Fetch vector field for currents & particle flow when enabled
  useEffect(() => {
    if (!showCurrents && variable !== 'currents' && !showParticles) return;
    let cancelled = false;
    dataApi
      .getVectors({
        time: currentTime,
        depth: depth || 0,
        region: currentRegion !== 'global' ? currentRegion : undefined,
        spacing: 8,
      })
      .then((vf) => {
        if (!cancelled && vf) setVectorField(vf);
      })
      .catch((err) => {
        if (!cancelled) console.error('Vector field fetch failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, [showCurrents, variable, showParticles, currentTime, depth, currentRegion, setVectorField]);

  return (
    <div className={styles.canvasWrap}>
      <Canvas
        camera={{ position: [1.2, 0.9, 1.4], fov: 45, near: 0.01, far: 100 }}
        gl={{
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 1.6]}
      >
        {/* ── Scene background ── */}
        <color attach="background" args={['#01040a']} />
        <fog attach="fog" args={['#01040a', 4, 10]} />

        {/* ── Lighting (100% Uniform Illumination) ── */}
        <ambientLight intensity={1.0} color="#ffffff" />

        {/* ── Background stars ── */}
        <StarField count={4000} />

        {/* ── Earth base sphere ── */}
        <EarthBase />

        {/* ── Oceanographic data on sphere ── */}
        <OceanSpherePatch />
        <OceanIsosurfacePatch />

        {/* ── Atmosphere glow & Clouds ── */}
        {showAtmosphere && <Atmosphere radius={1.08} intensity={0.8} />}
        {showAtmosphere && <CloudLayer radius={1.018} opacity={0.5} />}
        <EarthAtmosphere />

        {/* ── Continental outlines ── */}
        {(showCoastline || showLand) && <ContinentalOverlay />}
        {showCoastline && <CoastlineLayer />}

        {/* ── Indian Ocean Border Highlight & Geographic Sphere Labels ── */}
        <IndianOceanBorder />
        <SphereLabels />

        {/* ── Depth slice indicator ── */}
        <DepthSliceIndicator />

        {/* ── Currents ── */}
        {showCurrents && <OceanCurrents />}

        {/* ── Particle flow ── */}
        {showParticles && <OceanParticles />}

        {/* ── Observations & Sensors ── */}
        {(showArgo || showGlider) && <SphereObservations />}
        <HFRadarLayer />
        <ADCPMooringLayer />

        {/* ── Click probe ── */}
        <SphereProbe />

        {/* ── Camera controls ── */}
        <CameraController />
      </Canvas>
    </div>
  );
}
