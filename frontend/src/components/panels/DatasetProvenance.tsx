import { useOceanStore } from '@/stores/oceanStore';
import styles from './PanelSection.module.css';

export function DatasetProvenance() {
  const field = useOceanStore((s) => s.field);
  const variable = useOceanStore((s) => s.variable);
  const depth = useOceanStore((s) => s.depth);
  const currentTime = useOceanStore((s) => s.currentTime);

  const unit = field?.unit ?? '';
  const vmin = field?.min_value ?? 0;
  const vmax = field?.max_value ?? 0;
  const vmean = field?.mean_value ?? 0;

  return (
    <div className={styles.section}>
      <div className="panel-section-title">Dataset Provenance</div>
      <div className={styles.controlGroup}>
        <span className={styles.controlGroupLabel}>Current Selection</span>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Variable</span>
          <span className={styles.rowValue}>{variable}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Time</span>
          <span className={styles.rowValue} style={{ fontSize: 10 }}>{new Date(currentTime).toLocaleString()}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Depth</span>
          <span className={styles.rowValue}>{depth} m</span>
        </div>
      </div>
      <div className={styles.controlGroup}>
        <span className={styles.controlGroupLabel}>Data Statistics</span>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Range</span>
          <span className={styles.rowValue} style={{ fontSize: 10 }}>
            {vmin.toFixed(2)} – {vmax.toFixed(2)}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Mean</span>
          <span className={styles.rowValue} style={{ fontSize: 10 }}>
            {vmean.toFixed(2)} {unit}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Grid</span>
          <span className={styles.rowValue} style={{ fontSize: 10 }}>
            {field?.latitude.length ?? 0}×{field?.longitude.length ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}