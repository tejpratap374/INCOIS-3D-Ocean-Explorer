import { useOceanStore } from '@/stores/oceanStore';
import styles from './RightDepthRuler.module.css';

interface RightDepthRulerProps {
  className?: string;
}

export function RightDepthRuler({ className }: RightDepthRulerProps) {
  const depth = useOceanStore((s) => s.depth);
  const setDepth = useOceanStore((s) => s.setDepth);

  const handleSliderChange = (value: number) => {
    setDepth(Math.round(value));
  };

  return (
    <div className={`${styles.panel} ${className || ''}`} role="region" aria-label="Depth control">
      <div className={styles.header}>DEPTH (m)</div>
      <div className={styles.trackContainer}>
        <div className={styles.track}>
          <div
            className={styles.marker}
            style={{ bottom: `${Math.min(depth / 2000, 1) * 100}%` }}
            aria-label={`Current depth: ${depth} meters`}
          />
        </div>
        <input
          type="range"
          className={styles.slider}
          min={0}
          max={2000}
          step={10}
          value={depth}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          aria-label="Depth slider"
          aria-valuemin={0}
          aria-valuemax={2000}
          aria-valuenow={depth}
        />
        <div className={styles.labels}>
          <span>0 m</span>
          <span>500 m</span>
          <span>1000 m</span>
          <span>1500 m</span>
          <span>2000 m</span>
        </div>
      </div>
      <div className={styles.currentDepthDisplay}>
        <span className={styles.currentDepthLabel}>CURRENT</span>
        <span className={styles.currentDepthValue}>{depth} m</span>
      </div>
    </div>
  );
}