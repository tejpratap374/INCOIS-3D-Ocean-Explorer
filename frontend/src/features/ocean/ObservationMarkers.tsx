import { useMemo, useState } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { lonLatToXY, depthToZ, xyToLonLat } from '@/utils/geo';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export function ObservationMarkers() {
  const showArgo = useOceanStore((s) => s.showArgoLayer);
  const showGlider = useOceanStore((s) => s.showGliderLayer);
  const argoFloats = useOceanStore((s) => s.argoFloats);
  const gliderTracks = useOceanStore((s) => s.gliderTracks);
  const setSelectedArgoId = useOceanStore((s) => s.setSelectedArgoId);
  const setSelectedGliderId = useOceanStore((s) => s.setSelectedGliderId);
  const setDetailOpen = useOceanStore((s) => s.setDetailPanelOpen);
  const selectedArgoId = useOceanStore((s) => s.selectedArgoId);
  const selectedGliderId = useOceanStore((s) => s.selectedGliderId);
  const ve = useOceanStore((s) => s.verticalExaggeration);
  const depth = useOceanStore((s) => s.depth);

  return (
    <>
      {/* Argo float markers */}
      {showArgo && argoFloats.map((f) => {
        const { x, y } = lonLatToXY(f.longitude, f.latitude);
        const isSelected = selectedArgoId === f.float_id;
        return (
          <group
            key={f.float_id}
            position={[x, 0.02, y]}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedArgoId(f.float_id);
              setSelectedGliderId(null);
              setDetailOpen(true);
            }}
          >
            <mesh>
              <sphereGeometry args={[isSelected ? 0.025 : 0.015, 12, 12]} />
              <meshBasicMaterial
                color={f.status === 'active' ? '#ff7b3a' : '#884422'}
                transparent
                opacity={0.9}
              />
            </mesh>
            {isSelected && (
              <>
                <mesh>
                  <sphereGeometry args={[0.04, 12, 12]} />
                  <meshBasicMaterial color="#ff7b3a" transparent opacity={0.2} />
                </mesh>
                <mesh>
                  <sphereGeometry args={[0.035, 12, 12]} />
                  <meshBasicMaterial color="#ff7b3a" transparent opacity={0.08} />
                </mesh>
              </>
            )}
            <Text
              position={[0, 0.04, 0]}
              fontSize={0.018}
              color="#ff7b3a"
              anchorX="center"
              anchorY="bottom"
              outlineColor="#04080f"
              outlineWidth={0.002}
            >
              {f.float_id.replace('INCOIS', '')}
            </Text>
          </group>
        );
      })}

      {/* Glider tracks as 3D polylines */}
      {showGlider && gliderTracks.map((t) => {
        const firstObs = t.observations?.[0];
        if (!firstObs) return null;
        const { x: sx, y: sy } = lonLatToXY(firstObs.longitude, firstObs.latitude);
        const isSelected = selectedGliderId === t.glider_id;

        // Build track line
        const trackPoints = t.observations.map((obs) => {
          const { x, y } = lonLatToXY(obs.longitude, obs.latitude);
          // Gliders yo-yo in depth — show actual depth when >0, else surface
          const z = obs.depth > 0 ? depthToZ(obs.depth, ve) : 0.02;
          return new THREE.Vector3(x, z, y);
        });

        return (
          <group key={t.glider_id}>
            {/* Track polyline */}
            {trackPoints.length >= 2 && (
              <line>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    args={[new Float32Array(trackPoints.flatMap((v) => [v.x, v.y, v.z])), 3]}
                    count={trackPoints.length}
                  />
                </bufferGeometry>
                <lineBasicMaterial
                  color={isSelected ? '#b44fff' : '#7a22bb'}
                  transparent
                  opacity={isSelected ? 0.9 : 0.5}
                  linewidth={1}
                />
              </line>
            )}

            {/* Current position marker */}
            <group
              position={[sx, 0.03, sy]}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedGliderId(t.glider_id);
                setSelectedArgoId(null);
                setDetailOpen(true);
              }}
            >
              <mesh>
                <boxGeometry args={[0.02, 0.006, 0.02]} />
                <meshBasicMaterial
                  color={isSelected ? '#b44fff' : '#7a22bb'}
                  transparent
                  opacity={0.9}
                />
              </mesh>
              {isSelected && (
                <mesh>
                  <boxGeometry args={[0.03, 0.008, 0.03]} />
                  <meshBasicMaterial color="#b44fff" transparent opacity={0.15} />
                </mesh>
              )}
              <Text
                position={[0, 0.04, 0]}
                fontSize={0.018}
                color="#b44fff"
                anchorX="center"
                anchorY="bottom"
                outlineColor="#04080f"
                outlineWidth={0.002}
              >
                {t.name.split(' ')[0]}
              </Text>
            </group>
          </group>
        );
      })}
    </>
  );
}
