import { useOceanStore } from '@/stores/oceanStore';
import styles from './PanelSection.module.css';

export function VerticalExaggeration() {
  const ve = useOceanStore((s) => s.verticalExaggeration);
  const setVe = useOceanStore((s) => s.setVerticalExaggeration);
  return (
    <div className={styles.section}>
      <div className="panel-section-title">Vertical Exaggeration</div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Scale</span>
        <span className={styles.rowValue}>{ve.toFixed(1)}×</span>
      </div>
      <div className={styles.sliderWrapper}>
        <div className={styles.sliderLabel}>
          <span>1×</span>
          <span className={styles.sliderValue}>{ve.toFixed(1)}×</span>
          <span>10×</span>
        </div>
        <input
          type="range"
          className={styles.slider}
          min={1}
          max={10}
          step={0.5}
          value={ve}
          onChange={(e) => setVe(parseFloat(e.target.value))}
          aria-label="Vertical exaggeration"
        />
      </div>
    </div>
  );
}
