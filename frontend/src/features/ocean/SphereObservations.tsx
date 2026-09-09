import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Line, Billboard } from '@react-three/drei';
import { useOceanStore } from '@/stores/oceanStore';
import { lonLatToVec3, depthToSphereOffset } from '@/utils/geo';
import { isOverOcean } from '@/data/geo';
import { MOORING_BUOYS, type MooringBuoy } from '@/config/moorings';
import type { ArgoFloat, GliderTrack as GliderTrackType } from '@/types';
import * as THREE from 'three';

const EARTH_RADIUS = 1.0;

// ─── Argo Float Marker: Circle ● (Floating Profiler) ──────────────────────────

function ArgoMarker({
  f,
  isSelected,
  handleClick,
}: {
  f: ArgoFloat;
  isSelected: boolean;
  handleClick: (e: any) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const radius = EARTH_RADIUS + 0.003;
  const pos = lonLatToVec3(f.longitude, f.latitude, radius);
  const floatLabel = f.float_id.replace('INCOIS_ARGO_', 'ARGO #');

  const mainColor = isSelected ? '#00f0ff' : f.status === 'active' ? '#ff7b3a' : '#ef4444';

  useFrame(({ camera }) => {
    if (!groupRef.current) return;

    // STEP 14 — Back-face occlusion: hide markers on back side of globe
    const markerVec = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
    const camVec = camera.position.clone().normalize();
    if (markerVec.dot(camVec) < 0.02) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    const dist = camera.position.length();
    // STEP 8 — Controlled zoom scale range
    const hoverMult = hovered ? 1.35 : 1.0;
    const baseScale = THREE.MathUtils.clamp((dist - 1.0) * 0.70 + 0.45, 0.60, 2.0);
    const targetScale = baseScale * hoverMult;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14);
  });

  return (
    <group
      ref={groupRef}
      position={[pos.x, pos.y, pos.z]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      {/* Invisible click target */}
      <mesh visible={false}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Leader line from sphere surface to floating badge */}
      <Line
        points={[[0, 0, 0], [0, 0.008, 0]]}
        color={mainColor}
        lineWidth={1.2}
        transparent
        opacity={0.65}
      />

      {/* Selected / Hover Outer Pulsing Ring */}
      {(isSelected || hovered) && (
        <mesh position={[0, 0.001, 0]}>
          <ringGeometry args={[0.007, 0.010, 24]} />
          <meshBasicMaterial
            color={mainColor}
            transparent
            opacity={isSelected ? 0.55 : 0.35}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* ARGO CIRCLE ● MARKER (Billboard facing camera) */}
      <Billboard position={[0, 0.001, 0]}>
        {/* Outer Circular Ring */}
        <mesh renderOrder={28}>
          <ringGeometry args={[0.0042, 0.0062, 24]} />
          <meshBasicMaterial color={mainColor} transparent opacity={0.95} />
        </mesh>
        {/* Inner Solid Circle */}
        <mesh renderOrder={28}>
          <circleGeometry args={[0.0042, 24]} />
          <meshBasicMaterial color="#0c1626" transparent opacity={0.9} />
        </mesh>
        {/* Inner "A" Icon Identifier */}
        <Text
          position={[0, 0, 0.0005]}
          fontSize={0.0045}
          color={mainColor}
          fontWeight="bold"
          anchorX="center"
          anchorY="middle"
          renderOrder={29}
        >
          A
        </Text>
      </Billboard>

      {/* Floating Device Title */}
      <Billboard>
        <Text
          position={[0, 0.012, 0]}
          fontSize={0.0062}
          color={isSelected ? '#00f0ff' : '#ffb088'}
          anchorX="center"
          anchorY="bottom"
          outlineColor="#000000"
          outlineWidth={0.0014}
          renderOrder={30}
          material-depthTest={false}
          material-depthWrite={false}
        >
          {floatLabel}
        </Text>
      </Billboard>
    </group>
  );
}

function ArgoFloatsLayer() {
  const argoFloats = useOceanStore((s) => s.argoFloats);
  const selectedArgoId = useOceanStore((s) => s.selectedArgoId);
  const setSelectedArgoId = useOceanStore((s) => s.setSelectedArgoId);
  const setSelectedGliderId = useOceanStore((s) => s.setSelectedGliderId);
  const setDetailOpen = useOceanStore((s) => s.setDetailPanelOpen);

  const handleClick = (floatId: string, e: any) => {
    e.stopPropagation();
    setSelectedArgoId(floatId);
    setSelectedGliderId(null);
    setDetailOpen(true);
  };

  return (
    <group>
      {argoFloats.map((f) => {
        if (!isOverOcean(f.latitude, f.longitude)) return null;
        const isSelected = selectedArgoId === f.float_id;
        return (
          <ArgoMarker
            key={f.float_id}
            f={f}
            isSelected={isSelected}
            handleClick={(e) => handleClick(f.float_id, e)}
          />
        );
      })}
    </group>
  );
}

// ─── Glider Track Item: Triangle ▲ (Underwater Glider) ─────────────────────────

function GliderTrack({ track }: { track: GliderTrackType }) {
  const t = track;
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const selectedGliderId = useOceanStore((s) => s.selectedGliderId);
  const setSelectedGliderId = useOceanStore((s) => s.setSelectedGliderId);
  const setSelectedArgoId = useOceanStore((s) => s.setSelectedArgoId);
  const setDetailOpen = useOceanStore((s) => s.setDetailPanelOpen);

  const isSelected = selectedGliderId === t.glider_id;
  const firstObs = t.observations?.[0];
  if (!firstObs) return null;

  const oceanObs = useMemo(() => {
    if (!t.observations?.length) return [];
    return t.observations.filter((obs) => isOverOcean(obs.latitude, obs.longitude));
  }, [t.observations]);

  if (oceanObs.length === 0) return null;

  const startPos = lonLatToVec3(firstObs.longitude, firstObs.latitude, EARTH_RADIUS + 0.003);

  const trackPoints = useMemo(() => {
    return oceanObs.map((obs) => {
      const radius = EARTH_RADIUS + (obs.depth > 0 ? depthToSphereOffset(obs.depth) : 0.003);
      const v = lonLatToVec3(obs.longitude, obs.latitude, radius);
      return [v.x, v.y, v.z] as [number, number, number];
    });
  }, [oceanObs]);

  const lineColor = isSelected ? '#e088ff' : '#a855f7';

  const handleClick = (e: any) => {
    e.stopPropagation();
    setSelectedGliderId(t.glider_id);
    setSelectedArgoId(null);
    setDetailOpen(true);
  };

  useFrame(({ camera }) => {
    if (!groupRef.current) return;

    // STEP 14 — Back-face occlusion: hide markers on back side of globe
    const markerVec = new THREE.Vector3(startPos.x, startPos.y, startPos.z).normalize();
    const camVec = camera.position.clone().normalize();
    if (markerVec.dot(camVec) < 0.02) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    const dist = camera.position.length();
    const hoverMult = hovered ? 1.35 : 1.0;
    const baseScale = THREE.MathUtils.clamp((dist - 1.0) * 0.70 + 0.45, 0.60, 2.0);
    const targetScale = baseScale * hoverMult;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14);
  });

  return (
    <group key={t.glider_id}>
      {/* Track polyline */}
      {trackPoints.length >= 2 && (
        <Line
          points={trackPoints}
          color={lineColor}
          lineWidth={2.2}
          transparent
          opacity={isSelected ? 0.95 : 0.75}
          raycast={() => []}
        />
      )}
      <group
        ref={groupRef}
        position={[startPos.x, startPos.y, startPos.z]}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        {/* Invisible hit target sphere */}
        <mesh visible={false}>
          <sphereGeometry args={[0.025, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {/* Leader line from sphere to badge */}
        <Line
          points={[[0, 0, 0], [0, 0.008, 0]]}
          color={lineColor}
          lineWidth={1.2}
          transparent
          opacity={0.65}
        />

        {/* Selected / Hover Glow Halo */}
        {(isSelected || hovered) && (
          <mesh position={[0, 0.002, 0]}>
            <ringGeometry args={[0.007, 0.010, 3]} />
            <meshBasicMaterial
              color={lineColor}
              transparent
              opacity={isSelected ? 0.55 : 0.35}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* GLIDER TRIANGLE ▲ MARKER (3D Cone pointing up) */}
        <mesh position={[0, 0.002, 0]} rotation={[Math.PI, 0, 0]} renderOrder={28}>
          <coneGeometry args={[0.006, 0.011, 3]} />
          <meshBasicMaterial color={lineColor} transparent opacity={0.95} />
        </mesh>

        {/* Inner "G" Icon Identifier Billboard */}
        <Billboard position={[0, 0.002, 0]}>
          <Text
            fontSize={0.004}
            color="#ffffff"
            fontWeight="bold"
            anchorX="center"
            anchorY="middle"
            renderOrder={29}
          >
            G
          </Text>
        </Billboard>

        {/* Floating Device Title */}
        <Billboard>
          <Text
            position={[0, 0.012, 0]}
            fontSize={0.0062}
            color={lineColor}
            anchorX="center"
            anchorY="bottom"
            outlineColor="#000000"
            outlineWidth={0.0014}
            renderOrder={30}
            material-depthTest={false}
            material-depthWrite={false}
          >
            {t.name}
          </Text>
        </Billboard>
      </group>
    </group>
  );
}

function GliderTracksLayer() {
  const gliderTracks = useOceanStore((s) => s.gliderTracks);
  return (
    <group>
      {gliderTracks.map((track) => (
        <GliderTrack key={track.glider_id} track={track} />
      ))}
    </group>
  );
}

// ─── Mooring Buoy Item: Diamond ◆ (Anchored OMNI Buoy) ────────────────────────

function MooringMarker({
  m,
  handleClick,
}: {
  m: MooringBuoy;
  handleClick: (e: any) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const pos = lonLatToVec3(m.lon, m.lat, EARTH_RADIUS + 0.0035);
  const selectedArgoId = useOceanStore((s) => s.selectedArgoId);
  const isSelected = selectedArgoId === `MOORING_${m.id}`;

  const mainColor = m.type === 'OMNI' ? '#ef4444' : '#f59e0b';

  useFrame(({ camera }) => {
    if (!groupRef.current) return;

    // STEP 14 — Back-face occlusion: hide markers on back side of globe
    const markerVec = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
    const camVec = camera.position.clone().normalize();
    if (markerVec.dot(camVec) < 0.02) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    const dist = camera.position.length();
    const hoverMult = hovered ? 1.35 : 1.0;
    const baseScale = THREE.MathUtils.clamp((dist - 1.0) * 0.70 + 0.45, 0.60, 2.0);
    const targetScale = baseScale * hoverMult;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14);
  });

  const isOffsetRight = m.id === 'RAMA_15N' || m.id === 'RAMA_12N' || m.id === 'RAMA_08N';
  const isOffsetLeft = m.id === 'BD09' || m.id === 'BD10';

  const labelOffset: [number, number, number] = isOffsetRight
    ? [0.008, 0.008, 0]
    : isOffsetLeft
    ? [-0.008, 0.008, 0]
    : [0, 0.012, 0];

  const labelAnchor = isOffsetRight ? 'left' : isOffsetLeft ? 'right' : 'center';

  return (
    <group
      ref={groupRef}
      position={[pos.x, pos.y, pos.z]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      {/* Invisible enlarged hit target sphere */}
      <mesh visible={false}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Leader line connecting buoy anchor on sphere to floating text badge */}
      <Line
        points={[[0, 0, 0], [labelOffset[0], labelOffset[1] - 0.002, labelOffset[2]]]}
        color={mainColor}
        lineWidth={1.2}
        transparent
        opacity={0.65}
      />

      {/* Selected / Hover Outer Glow Halo */}
      {(isSelected || hovered) && (
        <mesh position={[0, 0.003, 0]}>
          <octahedronGeometry args={[0.010]} />
          <meshBasicMaterial
            color={mainColor}
            transparent
            opacity={isSelected ? 0.55 : 0.35}
            wireframe
          />
        </mesh>
      )}

      {/* Cylindrical Buoy Anchor Float Base */}
      <mesh position={[0, 0.001, 0]} renderOrder={28}>
        <cylinderGeometry args={[0.0045, 0.0045, 0.0025, 8]} />
        <meshBasicMaterial color="#1a2436" transparent opacity={0.95} />
      </mesh>

      {/* OMNI DIAMOND ◆ MARKER (3D Octahedron) */}
      <mesh position={[0, 0.0045, 0]} renderOrder={28}>
        <octahedronGeometry args={[0.0065]} />
        <meshBasicMaterial color={mainColor} transparent opacity={0.95} />
      </mesh>

      {/* Inner "O" Icon Identifier Billboard */}
      <Billboard position={[0, 0.0045, 0]}>
        <Text
          fontSize={0.0042}
          color="#ffffff"
          fontWeight="bold"
          anchorX="center"
          anchorY="middle"
          renderOrder={29}
        >
          O
        </Text>
      </Billboard>

      {/* Mooring Name Billboard Badge */}
      <Billboard>
        <Text
          position={labelOffset}
          fontSize={0.0060}
          color={m.type === 'OMNI' ? '#fca5a5' : '#fde047'}
          anchorX={labelAnchor}
          anchorY="bottom"
          outlineColor="#000000"
          outlineWidth={0.0014}
          renderOrder={30}
          material-depthTest={false}
          material-depthWrite={false}
        >
          {m.name}
        </Text>
      </Billboard>
    </group>
  );
}

function MooringsLayer() {
  const setSelectedArgoId = useOceanStore((s) => s.setSelectedArgoId);
  const setSelectedGliderId = useOceanStore((s) => s.setSelectedGliderId);
  const setDetailOpen = useOceanStore((s) => s.setDetailPanelOpen);

  const handleClick = (mooringId: string, e: any) => {
    e.stopPropagation();
    setSelectedArgoId(`MOORING_${mooringId}`);
    setSelectedGliderId(null);
    setDetailOpen(true);
  };

  return (
    <group>
      {MOORING_BUOYS.map((m) => (
        <MooringMarker key={m.id} m={m} handleClick={(e) => handleClick(m.id, e)} />
      ))}
    </group>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────

export function SphereObservations() {
  const showArgo = useOceanStore((s) => s.showArgoLayer);
  const showGlider = useOceanStore((s) => s.showGliderLayer);

  return (
    <group>
      {showArgo && <ArgoFloatsLayer />}
      {showGlider && <GliderTracksLayer />}
      <MooringsLayer />
    </group>
  );
}
