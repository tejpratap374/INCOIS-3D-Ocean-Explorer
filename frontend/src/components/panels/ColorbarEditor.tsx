import { useOceanStore } from '@/stores/oceanStore';
import { colorStopsFor, PALETTES, type ColorPalette } from '@/utils/colorScales';
import styles from './ColorbarEditor.module.css';

export function ColorbarEditor() {
  const palette = useOceanStore((s) => s.palette);
  const setPalette = useOceanStore((s) => s.setPalette);
  const vmin = useOceanStore((s) => s.vmin);
  const vmax = useOceanStore((s) => s.vmax);
  const setVmin = useOceanStore((s) => s.setVmin);
  const setVmax = useOceanStore((s) => s.setVmax);
  const reverseScale = useOceanStore((s) => s.reverseScale);
  const setReverseScale = useOceanStore((s) => s.setReverseScale);
  const scale = useOceanStore((s) => s.scale);
  const setScale = useOceanStore((s) => s.setScale);
  const field = useOceanStore((s) => s.field);
  const opacity = useOceanStore((s) => s.opacity);
  const setOpacity = useOceanStore((s) => s.setOpacity);

  const resolvedVmin = vmin ?? field?.min_value ?? 0;
  const resolvedVmax = vmax ?? field?.max_value ?? 30;

  return (
    <div className={styles.section}>
      <div className="panel-section-title">Color Scale</div>

      <div className={styles.controlGroup}>
        <span className={styles.controlGroupLabel}>Range</span>
        <div className={styles.rangeRow}>
          <label className={styles.rangeLabel}>
            <span>Min</span>
            <input
              type="number"
              className={styles.rangeInput}
              value={resolvedVmin.toFixed(2)}
              step={0.1}
              onChange={(e) => setVmin(parseFloat(e.target.value) || null)}
            />
          </label>
          <label className={styles.rangeLabel}>
            <span>Max</span>
            <input
              type="number"
              className={styles.rangeInput}
              value={resolvedVmax.toFixed(2)}
              step={0.1}
              onChange={(e) => setVmax(parseFloat(e.target.value) || null)}
            />
          </label>
        </div>
      </div>

      <div className={styles.colorbarWrapper}>
        <div className={styles.colorbarPreview} style={{ background: colorStopsFor(palette, 16, reverseScale) }} />
      </div>
      <div className={styles.colorbarLabels}>
        <span>{resolvedVmin.toFixed(1)}</span>
        <span>{(resolvedVmin + (resolvedVmax - resolvedVmin) / 2).toFixed(1)}</span>
        <span>{resolvedVmax.toFixed(1)}</span>
      </div>

      <div className={styles.controlGroup}>
        <div className={styles.paletteHeader}>
          <span className={styles.controlGroupLabel}>Palette</span>
          <button
            className={styles.reverseBtn}
            onClick={() => setReverseScale(!reverseScale)}
            aria-pressed={reverseScale}
            title="Reverse color scale"
          >
            {reverseScale ? '⬍' : '⬌'}
          </button>
        </div>
        <div className={styles.paletteGrid}>
          {PALETTES.map((p) => (
            <button
              key={p.id}
              className={`${styles.palette} ${palette === p.id ? styles.active : ''}`}
              style={{ background: colorStopsFor(p.id as ColorPalette, 16) }}
              onClick={() => setPalette(p.id as ColorPalette)}
              title={p.name}
            />
          ))}
        </div>
      </div>

      <div className={styles.controlGroup}>
        <span className={styles.controlGroupLabel}>Scale</span>
        <div className={styles.scaleToggle}>
          <button className={scale === 'linear' ? styles.active : ''} onClick={() => setScale('linear')}>Linear</button>
          <button className={scale === 'log' ? styles.active : ''} onClick={() => setScale('log')}>Log</button>
        </div>
      </div>

      <div className={styles.controlGroup}>
        <span className={styles.controlGroupLabel}>Opacity</span>
        <div className={styles.sliderWrapper}>
          <div className={styles.sliderLabel}>
            <span>0%</span>
            <span className={styles.sliderValue}>{Math.round(opacity * 100)}%</span>
            <span>100%</span>
          </div>
          <input
            type="range"
            className={styles.slider}
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            aria-label="Opacity"
          />
        </div>
      </div>
    </div>
  );
}
