import { useOceanStore } from '@/stores/oceanStore';
import styles from './DepthRuler.module.css';

export function DepthRuler() {
  const depth = useOceanStore((s) => s.depth);

  return (
    <div className={styles.ruler} aria-label="Depth ruler">
      <div className={styles.track}>
        <div className={styles.marker} style={{ bottom: `${Math.min(depth / 2000, 1) * 100}%` }} />
      </div>
      <div className={styles.labels}>
        <span>0 m</span>
        <span className={styles.currentDepth}>{depth} m</span>
        <span>2000 m</span>
      </div>
    </div>
  );
}