import { useState } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { colorStopsFor } from '@/utils/colorScales';
import styles from './RightSidebarPanel.module.css';

// ─── SVG ICONS ─────────────────────────────────────────────────────────────────

function GlobeInfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function CalendarClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M12 14v3l2 1" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function GridBoundsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

// ─── MAIN RIGHT SIDEBAR PANEL COMPONENT ───────────────────────────────────────

export function RightSidebarPanel() {
  const [isRegionOpen, setRegionOpen] = useState(true);
  const [isQuickViewOpen, setQuickViewOpen] = useState(true);
  const [isTimeOpen, setTimeOpen] = useState(true);

  const [quickViewMode, setQuickViewMode] = useState<'map' | 'vertical' | 'timeseries'>('map');
  const variable = useOceanStore((s) => s.variable);
  const setVariable = useOceanStore((s) => s.setVariable);
  const palette = useOceanStore((s) => s.palette);
  const vmin = useOceanStore((s) => s.vmin);
  const vmax = useOceanStore((s) => s.vmax);
  const field = useOceanStore((s) => s.field);

  const isPlaying = useOceanStore((s) => s.isPlaying);
  const setPlaying = useOceanStore((s) => s.setPlaying);
  const playbackSpeed = useOceanStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useOceanStore((s) => s.setPlaybackSpeed);

  const variableDefaults: Record<string, { min: number; max: number; unit: string }> = {
    temperature: { min: 0, max: 30, unit: '°C' },
    salinity: { min: 30, max: 38, unit: 'PSU' },
    currents: { min: 0, max: 1.5, unit: 'm/s' },
    chl: { min: 0, max: 3.0, unit: 'mg/m³' },
    ssh: { min: -0.3, max: 0.3, unit: 'm' },
  };

  const vConfig = variableDefaults[variable] || { min: 0, max: 30, unit: '°C' };
  const minV = vmin ?? field?.min_value ?? vConfig.min;
  const maxV = vmax ?? field?.max_value ?? vConfig.max;
  const unit = field?.unit || vConfig.unit;

  const legendTicks = Array.from({ length: 6 }, (_, i) => {
    const val = minV + ((maxV - minV) / 5) * i;
    return Number.isInteger(val) ? val.toString() : val.toFixed(1);
  });

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <aside className={styles.panel}>
      {/* WIDGET 1: REGION INFORMATION */}
      <div className={styles.widget}>
        <div className={styles.widgetHeader} onClick={() => setRegionOpen(!isRegionOpen)}>
          <div className={styles.widgetTitleGroup}>
            <GlobeInfoIcon className={styles.widgetIcon} />
            <span className={styles.widgetTitle}>Region Information</span>
          </div>
          <button className={`${styles.chevronBtn} ${!isRegionOpen ? styles.chevronRotated : ''}`}>
            <ChevronDownIcon />
          </button>
        </div>

        {isRegionOpen && (
          <div className={styles.widgetContent}>
            <div className={styles.regionSub}>Indian Ocean (Geographical Bounds)</div>

            {/* 3-Card Region Grid */}
            <div className={styles.regionGrid3}>
              <div className={styles.regionCard}>
                <PinIcon className={styles.regionCardIcon} />
                <div className={styles.regionCardBody}>
                  <span className={styles.regionCardLabel}>Latitude</span>
                  <span className={styles.regionCardVal}>60°S – 30°N</span>
                </div>
              </div>
              <div className={styles.regionCard}>
                <GlobeIcon className={styles.regionCardIcon} />
                <div className={styles.regionCardBody}>
                  <span className={styles.regionCardLabel}>Longitude</span>
                  <span className={styles.regionCardVal}>20°E – 120°E</span>
                </div>
              </div>
              <div className={styles.regionCard}>
                <GridBoundsIcon className={styles.regionCardIcon} />
                <div className={styles.regionCardBody}>
                  <span className={styles.regionCardLabel}>Area</span>
                  <span className={styles.regionCardVal}>70.6M km²</span>
                </div>
              </div>
            </div>

            {/* Authentic 2D World Satellite Map Inset */}
            <div className={styles.insetMapWrap}>
              <div className={styles.mapContainer}>
                <img
                  src="/assets/earth/albedo/earth_day_4096.jpg"
                  alt="2D World Map"
                  className={styles.worldMapImg}
                />
                <svg className={styles.insetSvg} viewBox="0 0 360 180">
                  {/* Lat/Lon Graticule Lines */}
                  <line x1="0" y1="30" x2="360" y2="30" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />
                  <line x1="0" y1="90" x2="360" y2="90" stroke="rgba(0,229,255,0.25)" strokeDasharray="4,4" />
                  <line x1="0" y1="150" x2="360" y2="150" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />
                  <line x1="60" y1="0" x2="60" y2="180" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />
                  <line x1="180" y1="0" x2="180" y2="180" stroke="rgba(0,229,255,0.25)" strokeDasharray="4,4" />
                  <line x1="300" y1="0" x2="300" y2="180" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />

                  {/* Vector Continent Outlines */}
                  <g fill="none" stroke="rgba(0, 229, 255, 0.45)" strokeWidth="0.9">
                    {/* Americas */}
                    <path d="M 25 35 L 55 20 L 75 18 L 105 20 L 140 18 L 120 30 L 100 45 L 90 75 L 82 68 L 40 40 Z M 98 78 L 125 80 L 145 95 L 130 135 L 110 135 L 98 88 Z" />
                    {/* Europe & Eurasia */}
                    <path d="M 172 48 L 195 20 L 215 32 L 285 20 L 350 25 L 340 45 L 290 55 L 258 84 L 222 58 Z" />
                    {/* Africa & Madagascar */}
                    <path d="M 170 55 L 212 62 L 230 78 L 200 122 L 180 98 L 165 68 Z M 225 105 L 234 118 L 228 120 Z" />
                    {/* Australia */}
                    <path d="M 293 112 L 332 110 L 334 125 L 305 128 Z" />
                    {/* Antarctica */}
                    <path d="M 10 162 L 180 162 L 350 162 L 350 178 L 10 178 Z" />
                  </g>

                  {/* Highlighted Cyan Bounding Box over Indian Ocean (20°E to 120°E, 60°S to 30°N) */}
                  <rect
                    x="200"
                    y="60"
                    width="100"
                    height="90"
                    fill="rgba(0, 229, 255, 0.18)"
                    stroke="#00e5ff"
                    strokeWidth="1.8"
                    strokeDasharray="4 2"
                    rx="3"
                  />
                  {/* Glowing Corner Handles */}
                  <circle cx="200" cy="60" r="2.5" fill="#00e5ff" />
                  <circle cx="300" cy="60" r="2.5" fill="#00e5ff" />
                  <circle cx="200" cy="150" r="2.5" fill="#00e5ff" />
                  <circle cx="300" cy="150" r="2.5" fill="#00e5ff" />

                  {/* Ocean Water Labels */}
                  <text x="70" y="110" fill="rgba(255,255,255,0.4)" fontSize="7" fontStyle="italic" fontWeight="bold" textAnchor="middle">ATLANTIC OCEAN</text>
                  <text x="250" y="105" fill="#00e5ff" fontSize="9" fontStyle="italic" fontWeight="bold" textAnchor="middle" letterSpacing="0.8">INDIAN OCEAN</text>
                  <text x="335" y="95" fill="rgba(255,255,255,0.4)" fontSize="7" fontStyle="italic" fontWeight="bold" textAnchor="middle">PACIFIC OCEAN</text>
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* WIDGET 2: QUICK VIEW */}
      <div className={styles.widget}>
        <div className={styles.widgetHeader} onClick={() => setQuickViewOpen(!isQuickViewOpen)}>
          <div className={styles.widgetTitleGroup}>
            <BarChartIcon className={styles.widgetIcon} />
            <span className={styles.widgetTitle}>Quick View</span>
          </div>
          <button className={`${styles.chevronBtn} ${!isQuickViewOpen ? styles.chevronRotated : ''}`}>
            <ChevronDownIcon />
          </button>
        </div>

        {isQuickViewOpen && (
          <div className={styles.widgetContent}>
            {/* Segmented Tab Buttons */}
            <div className={styles.tabsRow}>
              <button
                className={`${styles.tabBtn} ${quickViewMode === 'map' ? styles.activeTab : ''}`}
                onClick={() => setQuickViewMode('map')}
              >
                Map
              </button>
              <button
                className={`${styles.tabBtn} ${quickViewMode === 'vertical' ? styles.activeTab : ''}`}
                onClick={() => setQuickViewMode('vertical')}
              >
                Vertical Section
              </button>
              <button
                className={`${styles.tabBtn} ${quickViewMode === 'timeseries' ? styles.activeTab : ''}`}
                onClick={() => setQuickViewMode('timeseries')}
              >
                Time Series
              </button>
            </div>

            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Variable</span>
              <select
                className={styles.select}
                value={variable}
                onChange={(e) => setVariable(e.target.value)}
              >
                <option value="temperature">Sea Surface Temperature</option>
                <option value="salinity">Salinity</option>
                <option value="currents">Current Speed</option>
                <option value="chl">Chlorophyll</option>
                <option value="ssh">Sea Surface Height</option>
              </select>
            </div>

            {/* Dynamic Color Scale Legend Bar */}
            <div className={styles.colorBarWrap}>
              <div
                className={styles.thermalBar}
                style={{ background: colorStopsFor(palette) }}
              />
              <div className={styles.legendTicks}>
                {legendTicks.map((tick, idx) => (
                  <span key={idx}>
                    {tick}
                    {idx === legendTicks.length - 1 ? ` (${unit})` : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* WIDGET 3: TIME STEP (TEMPORAL CONTROLS) */}
      <div className={styles.widget}>
        <div className={styles.widgetHeader} onClick={() => setTimeOpen(!isTimeOpen)}>
          <div className={styles.widgetTitleGroup}>
            <CalendarClockIcon className={styles.widgetIcon} />
            <span className={styles.widgetTitle}>Time Step</span>
          </div>
          <button className={`${styles.chevronBtn} ${!isTimeOpen ? styles.chevronRotated : ''}`}>
            <ChevronDownIcon />
          </button>
        </div>

        {isTimeOpen && (
          <div className={styles.widgetContent}>
            <div className={styles.timeInputsRow}>
              <div className={styles.timeInputBox}>
                <span className={styles.inputLabel}>Start Date</span>
                <div className={styles.inputInner}>
                  <span>01 Sep 2025</span>
                  <CalendarIcon className={styles.inputInnerIcon} />
                </div>
              </div>
              <div className={styles.timeInputBox}>
                <span className={styles.inputLabel}>End Date</span>
                <div className={styles.inputInner}>
                  <span>30 Sep 2025</span>
                  <CalendarIcon className={styles.inputInnerIcon} />
                </div>
              </div>
            </div>

            {/* Range Slider */}
            <div className={styles.sliderWrap}>
              <span className={styles.sliderArrow}>‹</span>
              <input type="range" min="0" max="100" defaultValue="60" className={styles.timeRangeInput} />
              <span className={styles.sliderArrow}>›</span>
            </div>

            {/* Playback Control Bar */}
            <div className={styles.playRow}>
              <button className={styles.playBtn} title="Step Back">|◄</button>
              <button
                className={`${styles.playBtn} ${styles.playPrimary}`}
                onClick={() => setPlaying(!isPlaying)}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button className={styles.playBtn} title="Step Forward">►|</button>

              <select
                className={styles.speedSelect}
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={5}>5x</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
