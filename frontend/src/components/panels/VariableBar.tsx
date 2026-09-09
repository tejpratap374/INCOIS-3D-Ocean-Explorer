import { useOceanStore } from '@/stores/oceanStore';
import { colorStopsFor, PALETTES, type ColorPalette } from '@/utils/colorScales';
import { useState, useRef, useEffect } from 'react';
import styles from './VariableBar.module.css';

const VARIABLES = [
  { id: 'temperature', name: 'Temperature', unit: '°C' },
  { id: 'salinity', name: 'Salinity', unit: 'PSU' },
  { id: 'speed', name: 'Current Speed', unit: 'm/s' },
  { id: 'chl', name: 'Chlorophyll', unit: 'mg/m³' },
];

export function VariableBar() {
  const variable = useOceanStore((s) => s.variable);
  const setVariable = useOceanStore((s) => s.setVariable);
  const setVariableBarOpen = useOceanStore((s) => s.setVariableBarOpen);
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

  const [stylePopupOpen, setStylePopupOpen] = useState(false);
  const [vminInput, setVminInput] = useState(resolvedVmin.toFixed(2));
  const [vmaxInput, setVmaxInput] = useState(resolvedVmax.toFixed(2));
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setStylePopupOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync input values when store values change (but not when user is typing)
  useEffect(() => {
    setVminInput(resolvedVmin.toFixed(2));
  }, [resolvedVmin]);

  useEffect(() => {
    setVmaxInput(resolvedVmax.toFixed(2));
  }, [resolvedVmax]);

  const handleVminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVminInput(e.target.value);
  };

  const handleVmaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVmaxInput(e.target.value);
  };

  const handleVminBlur = () => {
    const val = parseFloat(vminInput);
    if (!isNaN(val)) {
      setVmin(val);
    } else {
      setVminInput(resolvedVmin.toFixed(2));
    }
  };

  const handleVmaxBlur = () => {
    const val = parseFloat(vmaxInput);
    if (!isNaN(val)) {
      setVmax(val);
    } else {
      setVmaxInput(resolvedVmax.toFixed(2));
    }
  };

  const handleVminKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleVminBlur();
    }
  };

  const handleVmaxKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleVmaxBlur();
    }
  };

  return (
    <div className={styles.bar} role="region" aria-label="Variable selection">
      <div className={styles.inner}>
        {/* Close button */}
        <button
          className={styles.closeBtn}
          onClick={() => setVariableBarOpen(false)}
          title="Close variable bar"
          aria-label="Close variable bar"
        >
          ✕
        </button>

        {/* Variable selector group */}
        <div className={styles.varGroup}>
          <div className={styles.varSelector} role="radiogroup" aria-label="Select variable">
            {VARIABLES.map((v) => (
              <button
                key={v.id}
                className={`${styles.varBtn} ${variable === v.id ? styles.active : ''}`}
                onClick={() => setVariable(v.id)}
                role="radio"
                aria-checked={variable === v.id}
                aria-label={`${v.name} (${v.unit})`}
                title={`${v.name} (${v.unit})`}
              >
                <span className={styles.varName}>{v.name}</span>
                <span className={styles.varUnit}>{v.unit}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        {/* Variable Style trigger button */}
        <div className={styles.styleGroup}>
          <button
            ref={triggerRef}
            className={`${styles.styleTrigger} ${stylePopupOpen ? styles.active : ''}`}
            onClick={() => setStylePopupOpen(!stylePopupOpen)}
            aria-expanded={stylePopupOpen}
            aria-haspopup="dialog"
            aria-label="Variable Style"
            type="button"
          >
            <span className={styles.styleTriggerLabel}>Variable Style</span>
            <span className={styles.styleTriggerIcon}>{stylePopupOpen ? '▲' : '▼'}</span>
          </button>

          {/* Variable Style Popup */}
          {stylePopupOpen && (
            <div
              ref={popupRef}
              className={styles.stylePopup}
              role="dialog"
              aria-label="Variable Style"
            >
              <div className={styles.stylePopupContent}>
                {/* Palette - exactly 4 controls in one row */}
                <div className={styles.paletteRow}>
                  <span className={styles.paletteLabel}>Palette</span>
                  <div className={styles.paletteSelector}>
                    {PALETTES.slice(0, 4).map((p) => (
                      <button
                        key={p.id}
                        className={`${styles.paletteBtn} ${palette === p.id ? styles.active : ''}`}
                        style={{ background: colorStopsFor(p.id as ColorPalette, 16) }}
                        onClick={() => setPalette(p.id as ColorPalette)}
                        title={p.name}
                        aria-label={p.name}
                        aria-pressed={palette === p.id}
                      />
                    ))}
                  </div>
                </div>

                {/* Min/Max controls */}
                <div className={styles.controlRow}>
                  <label className={styles.rangeLabel}>
                    <span>Min</span>
                    <input
                      type="number"
                      className={styles.rangeInput}
                      value={vminInput}
                      step={0.1}
                      onChange={handleVminChange}
                      onBlur={handleVminBlur}
                      onKeyDown={handleVminKeyDown}
                    />
                  </label>
                  <label className={styles.rangeLabel}>
                    <span>Max</span>
                    <input
                      type="number"
                      className={styles.rangeInput}
                      value={vmaxInput}
                      step={0.1}
                      onChange={handleVmaxChange}
                      onBlur={handleVmaxBlur}
                      onKeyDown={handleVmaxKeyDown}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}