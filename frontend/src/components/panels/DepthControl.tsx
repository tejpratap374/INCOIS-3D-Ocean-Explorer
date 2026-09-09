import { useState } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import styles from './DepthControl.module.css';

export function DepthControl() {
  const depth = useOceanStore((s) => s.depth);
  const setDepth = useOceanStore((s) => s.setDepth);
  const [customInput, setCustomInput] = useState('');

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomInput(value);

    if (value !== '') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        setDepth(Math.max(0, Math.min(4000, num)));
      }
    }
  };

  const handleCustomBlur = () => {
    if (customInput === '') {
      setDepth(0);
    }
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const num = parseFloat(customInput);
      if (!isNaN(num)) {
        setDepth(Math.max(0, Math.min(4000, num)));
      }
      setCustomInput('');
    }
  };

  return (
    <div className={styles.section}>
      <div className="panel-section-title">DEPTH</div>

      <div className={styles.customInputWrapper}>
        <div className={styles.customInputRow}>
          <input
            id="depth-custom"
            type="number"
            className={styles.customInput}
            value={customInput}
            placeholder="Depth (m)"
            min={0}
            max={4000}
            step={10}
            onChange={handleCustomChange}
            onBlur={handleCustomBlur}
            onKeyDown={handleCustomKeyDown}
            aria-label="Custom depth in meters"
          />
          <span className={styles.unit}>m</span>
        </div>
      </div>

      <div className={styles.sliderWrapper}>
        <div className={styles.sliderLabel}>
          <span>0 m</span>
          <span className={styles.sliderValue}>{depth} m</span>
          <span>2000 m</span>
        </div>

        <input
          type="range"
          className={styles.slider}
          min={0}
          max={2000}
          step={10}
          value={depth}
          onChange={(e) => {
            setDepth(parseInt(e.target.value));
            setCustomInput('');
          }}
          aria-label="Depth slider"
        />
      </div>
    </div>
  );
}