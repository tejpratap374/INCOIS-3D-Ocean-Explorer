import { useOceanStore } from '@/stores/oceanStore';
import { colorStopsFor, PALETTES, type ColorPalette } from '@/utils/colorScales';
import { useState, useRef, useEffect } from 'react';
import styles from './VariableRibbon.module.css';

const VARIABLES = [
  { id: 'temperature', name: 'Temperature', unit: '°C' },
  { id: 'salinity', name: 'Salinity', unit: 'PSU' },
  { id: 'speed', name: 'Current Speed', unit: 'm/s' },
  { id: 'chl', name: 'Chlorophyll', unit: 'mg/m³' },
];

export function VariableRibbon() {
  const variable = useOceanStore((s) => s.variable);
  const setVariable = useOceanStore((s) => s.setVariable);
  const depth = useOceanStore((s) => s.depth);
  const currentTime = useOceanStore((s) => s.currentTime);
  const currentRegion = useOceanStore((s) => s.currentRegion);
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

  return (
    <div className={styles.ribbon} role="region" aria-label="Variable and context">
      <div className={styles.inner}>
        {/* Variable selector group */}
        <div className={styles.varGroup}>
          <span className={styles.varLabel}>VARIABLE</span>
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
            <span className={styles.styleTriggerLabel}>VARIABLE STYLE</span>
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
                {/* Range */}
                <div className={styles.controlRow}>
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

                {/* Palette */}
                <div className={styles.paletteRow}>
                  <span className={styles.paletteLabel}>Palette</span>
                  <div className={styles.paletteSelector}>
                    {PALETTES.map((p) => (
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

                {/* Scale & Opacity */}
                <div className={styles.controlRow}>
                  <div className={styles.scaleWrapper}>
                    <span className={styles.scaleLabel}>Scale</span>
                    <div className={styles.scaleToggle}>
                      <button
                        className={scale === 'linear' ? styles.scaleActive : ''}
                        onClick={() => setScale('linear')}
                        aria-pressed={scale === 'linear'}
                      >Linear</button>
                      <button
                        className={scale === 'log' ? styles.scaleActive : ''}
                        onClick={() => setScale('log')}
                        aria-pressed={scale === 'log'}
                      >Log</button>
                    </div>
                  </div>
                  <div className={styles.opacityWrapper}>
                    <span className={styles.opacityLabel}>Opacity</span>
                    <input
                      type="range"
                      className={styles.opacitySlider}
                      min={0}
                      max={1}
                      step={0.01}
                      value={opacity}
                      onChange={(e) => setOpacity(parseFloat(e.target.value))}
                      aria-label="Opacity"
                    />
                    <span className={styles.opacityValue}>{Math.round(opacity * 100)}%</span>
                  </div>
                </div>

                {/* Reverse */}
                <div className={styles.reverseWrapper}>
                  <button
                    className={styles.reverseBtn}
                    onClick={() => setReverseScale(!reverseScale)}
                    aria-pressed={reverseScale}
                    title="Reverse color scale"
                  >
                    {reverseScale ? '⬍' : '⬌'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.divider} aria-hidden="true" />

        {/* Context info group */}
        <div className={styles.contextGroup}>
          <div className={styles.contextItem}>
            <span className={styles.contextLabel}>Region</span>
            <span className={styles.contextValue}>{currentRegion.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
          </div>
          <div className={styles.contextItem}>
            <span className={styles.contextLabel}>Depth</span>
            <span className={styles.contextValue}>{depth === 0 ? 'Surface' : `${depth} m`}</span>
          </div>
          <div className={styles.contextItem}>
            <span className={styles.contextLabel}>Time</span>
            <span className={styles.contextValue}>{new Date(currentTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}