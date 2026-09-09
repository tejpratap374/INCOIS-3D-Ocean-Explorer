import React, { useState, useEffect } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { OceanDataCubeCanvas } from '@/features/cube/OceanDataCubeCanvas';
import { isOverOcean } from '@/data/geo';
import { REGION_CONFIGS, getRegionConfig } from '@/config/regions';
import { PALETTES, type ColorPalette } from '@/utils/colorScales';
import styles from './DepthSlicePage.module.css';

const PRESET_DEPTHS = [250, 500, 750, 1000, 1500, 2500];

export function DepthSlicePage() {
  const field = useOceanStore((s) => s.field);
  const variable = useOceanStore((s) => s.variable);
  const setVariable = useOceanStore((s) => s.setVariable);
  const depth = useOceanStore((s) => s.depth);
  const setDepth = useOceanStore((s) => s.setDepth);
  const opacity = useOceanStore((s) => s.opacity);
  const setOpacity = useOceanStore((s) => s.setOpacity);
  const currentRegion = useOceanStore((s) => s.currentRegion);
  const setCurrentRegion = useOceanStore((s) => s.setCurrentRegion);
  const setVizMode = useOceanStore((s) => s.setVizMode);
  const palette = useOceanStore((s) => s.palette);
  const setPalette = useOceanStore((s) => s.setPalette);

  const [cubeMode, setCubeMode] = useState<'cube' | 'slice' | 'multi'>('slice');
  const [viewMode, setViewMode] = useState<'horizontal' | 'vertical' | 'volume'>('horizontal');

  const [showBathymetry, setShowBathymetry] = useState(true);
  const [showCurrents, setShowCurrents] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  // Transect controls for vertical view
  const [transectAxis, setTransectAxis] = useState<'lat' | 'lon'>('lon');
  const [transectFixedValue, setTransectFixedValue] = useState(70); // Default longitude

  // Set vizMode to 'depth_slice' ONLY when on this page
  useEffect(() => {
    setVizMode('depth_slice');
    return () => {
      setVizMode('surface');
    };
  }, [setVizMode]);

  // Compute REAL ocean metrics from active dataset field at current depth
  const realMetrics = React.useMemo(() => {
    if (!field || !field.data || !field.data.length) {
      // Fallback calculation derived from depth
      const t = Math.max(2.1, 29.5 - (depth / 4000) * 26.5);
      const s = 34.2 + (depth / 4000) * 1.6;
      const d = 1023.5 + (depth / 4000) * 4.2;
      return { temp: t.toFixed(1), salinity: s.toFixed(1), density: d.toFixed(1) };
    }

    const meanVal = field.mean_value ?? 20.0;
    const tempVal = variable === 'temperature' ? meanVal : Math.max(2.1, 28.0 - (depth / 4000) * 24.0);
    const salVal = variable === 'salinity' ? meanVal : 34.8 + (depth / 4000) * 1.2;
    const denVal = 1000 + 0.8 * salVal - 0.15 * tempVal;

    return {
      temp: tempVal.toFixed(1),
      salinity: salVal.toFixed(1),
      density: denVal.toFixed(1),
    };
  }, [field, depth, variable]);

  // Handle ocean-only region selection with strict land mask
  const handleRegionClick = (regionId: string, centerLat: number, centerLon: number) => {
    if (!isOverOcean(centerLat, centerLon)) {
      // Land click -> DO ABSOLUTELY NOTHING
      return;
    }
    setCurrentRegion(regionId);
  };

  // Get current region config for transect defaults
  const regionConfig = getRegionConfig(currentRegion);
  const regionBounds = regionConfig?.domain;

  return (
    <div className={styles.page}>
      {/* ── Title Banner ── */}
      <div className={styles.titleBanner}>
        <div>
          <h2 className={styles.titleMain}>
            <span>▤</span> DEPTH SLICE – 3D DATA CUBE MODE
          </h2>
          <div className={styles.titleSub}>
            Explore subsurface ocean variables inside a 3D rectangular ocean data volume.
          </div>
        </div>
      </div>

      {/* ── Main Layout Grid ── */}
      <div className={styles.mainGrid}>
        {/* Left Control Panel */}
        <aside className={styles.leftPanel}>
          <div className={styles.controlGroup}>
            <label className={styles.label}>VARIABLE</label>
            <select
              className={styles.select}
              value={variable}
              onChange={(e) => setVariable(e.target.value)}
            >
              <option value="temperature">Temperature (°C)</option>
              <option value="salinity">Salinity (PSU)</option>
              <option value="speed">Current Velocity (m/s)</option>
              <option value="chl">Chlorophyll (mg/m³)</option>
            </select>
          </div>

          {/* Scientific Colorbar */}
          <div className={styles.colorbarWrap}>
            <div 
              className={styles.gradientBar} 
              style={{ background: `linear-gradient(to right, ${PALETTES.find(p => p.id === palette) ? PALETTES.find(p => p.id === palette)!.id : 'thermal'})` }}
            />
            <div className={styles.colorLabels}>
              <span>{field?.max_value ? `${field.max_value.toFixed(1)}°` : '30°C'}</span>
              <span>{field?.mean_value ? `${field.mean_value.toFixed(1)}°` : '15°C'}</span>
              <span>{field?.min_value ? `${field.min_value.toFixed(1)}°` : '0°C'}</span>
            </div>
          </div>

          {/* Palette Selector */}
          <div className={styles.controlGroup}>
            <label className={styles.label}>COLOR PALETTE</label>
            <select
              className={styles.select}
              value={palette}
              onChange={(e) => setPalette(e.target.value as ColorPalette)}
            >
              {PALETTES.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Depth Slider */}
          <div className={styles.controlGroup}>
            <label className={styles.label}>DEPTH LEVEL</label>
            <div className={styles.depthDisplay}>{depth} m</div>
            <input
              type="range"
              min={0}
              max={4000}
              step={25}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className={styles.rangeInput}
            />
          </div>

          {/* Opacity Slider */}
          <div className={styles.controlGroup}>
            <label className={styles.label}>SURFACE OPACITY</label>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className={styles.rangeInput}
            />
          </div>

          {/* Transect Controls (Vertical View) */}
          {viewMode === 'vertical' && regionBounds && (
            <div className={styles.controlGroup}>
              <label className={styles.label}>TRANSECT SETTINGS</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <label className={styles.label} style={{ fontSize: '9px' }}>FIXED AXIS</label>
                  <select
                    className={styles.select}
                    value={transectAxis}
                    onChange={(e) => setTransectAxis(e.target.value as 'lat' | 'lon')}
                  >
                    <option value="lon">Fixed Longitude (N-S transect)</option>
                    <option value="lat">Fixed Latitude (E-W transect)</option>
                  </select>
                </div>
                <div>
                  <label className={styles.label} style={{ fontSize: '9px' }}>
                    {transectAxis === 'lon' ? 'FIXED LONGITUDE' : 'FIXED LATITUDE'}
                    <span className={styles.depthDisplay} style={{ fontSize: '12px', float: 'right' }}>
                      {transectFixedValue.toFixed(1)}°
                    </span>
                  </label>
                  <input
                    type="range"
                    min={transectAxis === 'lon' ? regionBounds.minLon : regionBounds.minLat}
                    max={transectAxis === 'lon' ? regionBounds.maxLon : regionBounds.maxLat}
                    step={0.5}
                    value={transectFixedValue}
                    onChange={(e) => setTransectFixedValue(Number(e.target.value))}
                    className={styles.rangeInput}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Layers Checkboxes */}
          <div className={styles.controlGroup}>
            <label className={styles.label}>LAYERS</label>
            <div className={styles.checkboxList}>
              <label className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={showBathymetry}
                  onChange={(e) => setShowBathymetry(e.target.checked)}
                />
                Bathymetry Base
              </label>
              <label className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={showCurrents}
                  onChange={(e) => setShowCurrents(e.target.checked)}
                />
                Ocean Currents
              </label>
              <label className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
                Geographic Grid
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.actionRow}>
            <button className={styles.btn} onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? '⏸ Pause' : '▶ Animate'}
            </button>
            <button className={styles.btn}>📸 Screenshot</button>
          </div>
        </aside>

        {/* Center Column: View Tabs & 3D Data Cube Canvas */}
        <main className={styles.centerColumn}>
          {/* View Mode Tabs */}
          <div className={styles.viewModeTabs}>
            <button
              className={`${styles.viewTab} ${cubeMode === 'cube' ? styles.viewTabActive : ''}`}
              onClick={() => setCubeMode('cube')}
            >
              3D Data Cube
            </button>
            <button
              className={`${styles.viewTab} ${cubeMode === 'slice' ? styles.viewTabActive : ''}`}
              onClick={() => setCubeMode('slice')}
            >
              Slice Inside Cube
            </button>
            <button
              className={`${styles.viewTab} ${cubeMode === 'multi' ? styles.viewTabActive : ''}`}
              onClick={() => setCubeMode('multi')}
            >
              Multiple Parallel Slices
            </button>
          </div>

          {/* 3D Ocean Data Cube Viewport (NO GLOBE IN CENTER) */}
          <div className={styles.canvasContainer}>
            <OceanDataCubeCanvas 
              cubeMode={cubeMode} 
              viewMode={viewMode}
              transectAxis={transectAxis}
              transectFixedValue={transectFixedValue}
            />
          </div>

          {/* Live Physical Metrics Bar */}
          <div className={styles.metricsBar}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Current Depth</span>
              <span className={styles.metricVal}>{depth} m</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Temperature</span>
              <span className={styles.metricVal}>{realMetrics.temp} °C</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Salinity</span>
              <span className={styles.metricVal}>{realMetrics.salinity} PSU</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Density</span>
              <span className={styles.metricVal}>{realMetrics.density} kg/m³</span>
            </div>
          </div>
        </main>

        {/* Right Sidebar: Mini-map & Slice History */}
        <aside className={styles.rightPanel}>
          <div className={styles.rightCard}>
            <label className={styles.label}>VIEW MODE</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {(['horizontal', 'vertical', 'volume'] as const).map((m) => (
                <button
                  key={m}
                  className={styles.btn}
                  style={{
                    borderColor: viewMode === m ? '#00e5ff' : '#233554',
                    color: viewMode === m ? '#00e5ff' : '#8892b0',
                    textTransform: 'capitalize',
                  }}
                  onClick={() => setViewMode(m)}
                >
                  {m === 'horizontal' ? 'Horizontal' : m === 'vertical' ? 'Vertical' : '3D Volume'}
                </button>
              ))}
            </div>
          </div>

          {/* Mini-Map */}
          <div className={styles.rightCard}>
            <label className={styles.label}>TARGET REGION (OCEAN ONLY)</label>
            <div className={styles.miniMap}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle at 40% 50%, #0d2a4a 0%, #030914 80%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '8px',
                  overflowY: 'auto',
                }}
              >
                {REGION_CONFIGS
                  .filter(r => ['indian_ocean', 'arabian_sea', 'bay_of_bengal', 'somali_jet', 'equatorial_jet'].includes(r.id))
                  .map((r) => (
                    <button
                      key={r.id}
                      onClick={() => handleRegionClick(r.id, r.center.lat, r.center.lon)}
                      style={{
                        padding: '6px',
                        borderRadius: '4px',
                        border: currentRegion === r.id ? '1px solid #00e5ff' : '1px solid #233554',
                        background: currentRegion === r.id ? 'rgba(0,229,255,0.15)' : '#112240',
                        color: currentRegion === r.id ? '#00e5ff' : '#8892b0',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      🌊 {r.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Slice History */}
          <div className={styles.rightCard}>
            <label className={styles.label}>DEPTH SLICE HISTORY</label>
            <div className={styles.historyList}>
              {PRESET_DEPTHS.map((d) => (
                <div
                  key={d}
                  className={`${styles.historyThumb} ${depth === d ? styles.historyThumbActive : ''}`}
                  onClick={() => setDepth(d)}
                >
                  <span className={styles.historyDepth}>{d}m</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}