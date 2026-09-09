import { OutreachStoryMode } from '@/features/ocean/OutreachStoryMode';
import { useOceanStore } from '@/stores/oceanStore';
import { ProbePanel } from './ProbePanel';
import styles from './GlobeViewportOverlays.module.css';

export function GlobeViewportOverlays() {
  const probeLocation = useOceanStore((s) => s.probeLocation);

  return (
    <>
      {/* Floating Probe Panel (click-to-inspect value card) */}
      {probeLocation && <ProbePanel />}

      {/* Top Center / Floating: Guided Science Story Mode */}
      <OutreachStoryMode />

      {/* Top Right: Compass Rose */}
      <div className={styles.compassRose}>
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="26" fill="rgba(10, 18, 30, 0.6)" stroke="rgba(0, 229, 255, 0.3)" strokeWidth="1" />
          <path d="M 30 6 L 35 25 L 30 30 L 25 25 Z" fill="#00e5ff" />
          <path d="M 30 54 L 35 35 L 30 30 L 25 35 Z" fill="#475569" />
          <path d="M 54 30 L 35 35 L 30 30 L 35 25 Z" fill="#475569" />
          <path d="M 6 30 L 25 35 L 30 30 L 25 25 Z" fill="#475569" />
          <text x="30" y="14" fill="#00e5ff" fontSize="9" fontWeight="bold" textAnchor="middle">N</text>
          <text x="50" y="33" fill="#cbd5e1" fontSize="8" textAnchor="middle">E</text>
          <text x="30" y="50" fill="#cbd5e1" fontSize="8" textAnchor="middle">S</text>
          <text x="10" y="33" fill="#cbd5e1" fontSize="8" textAnchor="middle">W</text>
        </svg>
      </div>

      {/* Bottom Left: Observation Platforms Legend */}
      <div className={styles.observationLegend}>
        <div className={styles.legendHeader}>
          <span className={styles.legendDot}></span>
          OBSERVATION PLATFORMS
        </div>
        <div className={styles.legendItems}>
          <div className={styles.legendItem}>
            <span className={`${styles.markerShape} ${styles.argoShape}`}>●</span>
            <span className={styles.deviceTitle}>Argo Profiler</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.markerShape} ${styles.gliderShape}`}>▲</span>
            <span className={styles.deviceTitle}>Glider</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.markerShape} ${styles.omniShape}`}>◆</span>
            <span className={styles.deviceTitle}>OMNI / Mooring</span>
          </div>
        </div>
      </div>
    </>
  );
}
