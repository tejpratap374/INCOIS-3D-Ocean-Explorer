import { useEffect, useMemo, useState } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { dataApi, observationsApi } from '@/services/api';
import { sampleFieldValue } from '@/utils/sampleField';
import { greatCircleDistance } from '@/utils/geo';
import { ProfileChart } from './ProfileInspector';
import type { DepthProfile, ArgoProfile } from '@/types';
import styles from './ProbePanel.module.css';

const VARIABLE_LABELS: Record<string, string> = {
  temperature: 'Sea Surface Temperature',
  salinity: 'Salinity',
  currents: 'Current Speed',
  chl: 'Chlorophyll',
  ssh: 'Sea Surface Height',
};

const VARIABLE_UNITS: Record<string, string> = {
  temperature: '°C',
  salinity: 'PSU',
  currents: 'm/s',
  chl: 'mg/m³',
  ssh: 'm',
};

const PROFILE_VARIABLES = new Set(['temperature', 'salinity', 'currents']);

// Map explorer variable -> field on ArgoProfile holding its measurements
const OBSERVED_MAP: Record<string, keyof Pick<ArgoProfile, 'temperature' | 'salinity' | 'chlorophyll'> | undefined> = {
  temperature: 'temperature',
  salinity: 'salinity',
  chl: 'chlorophyll',
};

const NEAREST_RADIUS_KM = 200;

export function ProbePanel() {
  const probe = useOceanStore((s) => s.probeLocation);
  const setProbe = useOceanStore((s) => s.setProbeLocation);
  const variable = useOceanStore((s) => s.variable);
  const field = useOceanStore((s) => s.field);
  const depth = useOceanStore((s) => s.depth);
  const currentTime = useOceanStore((s) => s.currentTime);
  const argoFloats = useOceanStore((s) => s.argoFloats);
  const gliderTracks = useOceanStore((s) => s.gliderTracks);

  const [profile, setProfile] = useState<DepthProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [nearest, setNearest] = useState<{ platformId: string; distanceKm: number; profile: ArgoProfile | null } | null>(null);
  const [nearestLoading, setNearestLoading] = useState(false);

  // Vertical model profile at the probe point (temperature/salinity/currents only)
  useEffect(() => {
    if (!probe || !PROFILE_VARIABLES.has(variable)) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    dataApi
      .getProfile({ variable, time: currentTime, latitude: probe.lat, longitude: probe.lon })
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [probe, variable, currentTime]);

  // Nearest Argo float to the probe (from already-loaded store data)
  const nearestFloat = useMemo(() => {
    if (!probe) return null;
    let best: { platformId: string; distanceKm: number } | null = null;
    for (const f of argoFloats) {
      const lat = f.latitude ?? f.last_lat;
      const lon = f.longitude ?? f.last_lon;
      if (lat == null || lon == null) continue;
      const d = greatCircleDistance(probe.lon, probe.lat, lon, lat);
      if (!best || d < best.distanceKm) best = { platformId: f.float_id, distanceKm: d };
    }
    return best && best.distanceKm <= NEAREST_RADIUS_KM ? best : null;
  }, [probe, argoFloats]);

  // Nearest glider observation to the probe
  const nearestGlider = useMemo(() => {
    if (!probe) return null;
    let best: { platformId: string; distanceKm: number } | null = null;
    for (const t of gliderTracks) {
      for (const o of t.observations) {
        const d = greatCircleDistance(probe.lon, probe.lat, o.longitude, o.latitude);
        if (!best || d < best.distanceKm) best = { platformId: t.glider_id, distanceKm: d };
      }
    }
    return best && best.distanceKm <= NEAREST_RADIUS_KM ? best : null;
  }, [probe, gliderTracks]);

  // Fetch the observed profile for the nearest platform, prefer whichever is closest
  useEffect(() => {
    if (!probe) {
      setNearest(null);
      return;
    }
    const argo = nearestFloat;
    const glider = nearestGlider;
    const useArgo = argo && (!glider || argo.distanceKm <= glider.distanceKm);
    const source = useArgo ? argo : glider;
    if (!source) {
      setNearest(null);
      return;
    }

    let cancelled = false;
    setNearestLoading(true);
    const setEmpty = () => {
      if (!cancelled) setNearest({ platformId: source.platformId, distanceKm: source.distanceKm, profile: null });
    };

    if (useArgo) {
      observationsApi
        .getArgoProfile(source.platformId)
        .then((p) => {
          if (!cancelled) setNearest({ platformId: source.platformId, distanceKm: source.distanceKm, profile: p });
        })
        .catch(setEmpty)
        .finally(() => {
          if (!cancelled) setNearestLoading(false);
        });
    } else {
      setNearest({ platformId: source.platformId, distanceKm: source.distanceKm, profile: null });
      setNearestLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [probe, nearestFloat, nearestGlider]);

  const modelValue = useMemo(
    () => (probe ? sampleFieldValue(field, probe.lat, probe.lon) : null),
    [field, probe]
  );
  const unit = field?.unit || VARIABLE_UNITS[variable] || '';

  if (!probe) return null;

  const dirLat = probe.lat >= 0 ? 'N' : 'S';
  const dirLon = probe.lon >= 0 ? 'E' : 'W';
  const coords = `${Math.abs(probe.lat).toFixed(2)}°${dirLat} · ${Math.abs(probe.lon).toFixed(2)}°${dirLon}`;

  const observedKey = OBSERVED_MAP[variable];
  const observedVal =
    observedKey && nearest?.profile && nearest.profile[observedKey]?.length
      ? nearest.profile[observedKey]![0]
      : null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Point Inspection</div>
          <div className={styles.subtitle}>{coords}</div>
        </div>
        <button
          className={styles.closeBtn}
          onClick={() => setProbe(null)}
          title="Clear probe"
          aria-label="Clear probe"
        >
          ✕
        </button>
      </div>

      <div className={styles.body}>
        {/* Model value at click */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            {VARIABLE_LABELS[variable] || variable}
            <span className={styles.badge}>MODEL</span>
          </div>
          <div className={styles.metricRow}>
            <span
              className={styles.metricVal}
              title={depth > 0 ? `Value at ${depth} m` : 'Surface value'}
            >
              {modelValue !== null ? `${modelValue.toFixed(2)} ${unit}` : '—'}
            </span>
            <span className={styles.depthTag}>{depth > 0 ? `${depth} m` : 'Surface'}</span>
          </div>
          {modelValue === null && (
            <div className={styles.hint}>No model data at this location</div>
          )}
        </div>

        {/* Vertical model profile */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Depth Profile</div>
          {PROFILE_VARIABLES.has(variable) ? (
            profileLoading ? (
              <div className={styles.loadingBox}>
                <div className={styles.spinner} />
                <span>Loading profile…</span>
              </div>
            ) : profile ? (
              <ProfileChart profile={profile} />
            ) : (
              <div className={styles.hint}>No profile data available</div>
            )
          ) : (
            <div className={styles.hint}>Depth profile unavailable for {VARIABLE_LABELS[variable] || variable}</div>
          )}
        </div>

        {/* Observed value */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            Nearest Observation
            <span className={`${styles.badge} ${styles.badgeObs}`}>OBSERVED</span>
          </div>
          {nearestLoading ? (
            <div className={styles.loadingBox}>
              <div className={styles.spinner} />
              <span>Locating observation…</span>
            </div>
          ) : nearest ? (
            <>
              <div className={styles.metricRow}>
                <span className={styles.metricVal}>
                  {observedVal !== null ? `${observedVal.toFixed(2)} ${unit}` : '—'}
                </span>
                <span className={styles.depthTag}>{nearest.distanceKm.toFixed(1)} km away</span>
              </div>
              <div className={styles.hint}>
                {nearest.platformId} · {nearest.profile ? `profile @ ${Math.abs(nearest.profile.latitude).toFixed(2)}°${nearest.profile.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(nearest.profile.longitude).toFixed(2)}°${nearest.profile.longitude >= 0 ? 'E' : 'W'}` : 'surface reading'}
              </div>
              {observedVal === null && (
                <div className={styles.hint}>No {VARIABLE_LABELS[variable] || variable} measurement on the closest platform</div>
              )}
            </>
          ) : (
            <div className={styles.hint}>No observation within {NEAREST_RADIUS_KM} km of this point</div>
          )}
        </div>
      </div>
    </div>
  );
}