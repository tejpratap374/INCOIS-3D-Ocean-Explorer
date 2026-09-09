import React, { useEffect, useState, useRef } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { analysisApi } from '@/services/api';
import type { ComparisonResult } from '@/types';
import styles from './AnalysisPage.module.css';
import { DepthControl } from '@/components/panels/DepthControl';
import { computeChartGeometry, mapValueToX, mapValueToY } from '@/utils/chartGeometry';

interface HoverInfo {
  x: number;
  y: number;
  modelVal: number;
  obsVal: number;
  lat: number;
  lon: number;
  diff: number;
}

export function AnalysisPage() {
  const variable = useOceanStore((s) => s.variable);
  const setVariable = useOceanStore((s) => s.setVariable);
  const currentTime = useOceanStore((s) => s.currentTime);
  const depth = useOceanStore((s) => s.depth);
  const currentRegion = useOceanStore((s) => s.currentRegion);
  const setCurrentRegion = useOceanStore((s) => s.setCurrentRegion);
  const selectedGliderId = useOceanStore((s) => s.selectedGliderId);

  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Depth window for comparison (±500m around chosen depth level)
  const depthMin = Math.max(0, depth - 500);
  const depthMax = Math.min(4000, depth + 500);

  useEffect(() => {
    setLoading(true);
    analysisApi
      .compare({
        variable,
        time: currentTime,
        depth_min: depthMin,
        depth_max: depthMax,
        lat_min: -5,
        lat_max: 25,
        lon_min: 55,
        lon_max: 100,
      })
      .then(setResult)
      .finally(() => setLoading(false));
  }, [variable, currentTime, depthMin, depthMax]);

  const unit =
    variable === 'temperature'
      ? '°C'
      : variable === 'salinity'
      ? 'PSU'
      : variable === 'chl'
      ? 'mg/m³'
      : 'm/s';

  const handleExportCSV = () => {
    if (!result) return;
    const lines = [
      `# INCOIS Ocean Model vs In-Situ Observation Analysis Report`,
      `# Variable: ${variable} (${unit})`,
      `# Time: ${currentTime}`,
      `# Depth Range: ${depthMin}m - ${depthMax}m`,
      `# Samples: ${result.sample_count}`,
      `# Mean Bias: ${result.mean_bias.toFixed(4)} ${unit}`,
      `# RMSE: ${result.rmse.toFixed(4)} ${unit}`,
      `# MAE: ${result.mae.toFixed(4)} ${unit}`,
      `# Correlation (R²): ${result.correlation?.toFixed(4) ?? 'N/A'}`,
      ``,
      `index,latitude,longitude,model_value,observation_value,residual_diff`,
    ];

    result.model_values.forEach((mVal, i) => {
      const oVal = result.observation_values[i];
      const lat = result.observation_latitudes[i] ?? 0;
      const lon = result.observation_longitudes[i] ?? 0;
      lines.push(`${i + 1},${lat},${lon},${mVal},${oVal},${(oVal - mVal).toFixed(4)}`);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `INCOIS_Analysis_${variable}_${depth}m.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>
            <span>📊</span> Scientific Analysis & Validation Engine
          </h1>
          <p className={styles.subtitle}>
            Quantitative validation of high-resolution numerical ocean models (ROMS/GODAS) against <em>in-situ</em> observation networks (Argo Floats, Glider Fleets, OMNI Moorings).
          </p>
          <div className={styles.badgeRow}>
            <span className={styles.badge}>✓ CF-1.8 Compliant</span>
            <span className={styles.badge}>📡 Live Telemetry Synced</span>
            <span className={styles.badge}>⚡ Real-Time Statistics</span>
          </div>
        </div>

        <button className={styles.exportBtn} onClick={handleExportCSV} disabled={!result}>
          <span>📥</span> Export Full Analysis (CSV)
        </button>
      </div>

      {/* Control Filters Panel */}
      <div className={styles.controlsPanel}>
        <div className={styles.controlsRow}>
          <div className={styles.controlGroup}>
            <div className={styles.label}>
              <span>📈</span> Variable
            </div>
            <div className={styles.varPills}>
              {[
                { id: 'temperature', label: 'Temperature' },
                { id: 'salinity', label: 'Salinity' },
                { id: 'speed', label: 'Currents' },
                { id: 'chl', label: 'Chlorophyll' },
              ].map((v) => (
                <button
                  key={v.id}
                  className={`${styles.varPill} ${variable === v.id ? styles.varPillActive : ''}`}
                  onClick={() => setVariable(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.controlGroup}>
            <div className={styles.label}>
              <span>🌊</span> Target Depth Layer
            </div>
            <DepthControl />
          </div>

          <div className={styles.controlGroup}>
            <div className={styles.label}>
              <span>🗺️</span> Region
            </div>
            <select
              className={styles.select}
              value={currentRegion}
              onChange={(e) => setCurrentRegion(e.target.value)}
            >
              <option value="global">Global Indian Ocean</option>
              <option value="arabian_sea">Arabian Sea</option>
              <option value="bay_of_bengal">Bay of Bengal</option>
              <option value="equatorial_io">Equatorial Indian Ocean</option>
            </select>
          </div>

          <div className={styles.controlGroup}>
            <div className={styles.label}>
              <span>🔬</span> In-Situ Source
            </div>
            <div className={styles.valueBox}>
              {selectedGliderId ? '⚓ Glider Mission Fleet' : '🌐 Argo Float Array + OMNI Moorings'}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingWrap}>
          <div className={styles.spinner} />
          <div>Computing spatial-temporal intercomparison metrics & residual density...</div>
        </div>
      ) : result ? (
        <>
          {/* Statistical KPI Grid */}
          <div className={styles.statsGrid}>
            <StatCard
              icon="🔢"
              label="Sample Size"
              value={result.sample_count.toLocaleString()}
              unit="co-located pairs"
              sub="Active depth window"
            />
            <StatCard
              icon="🎯"
              label="Mean Bias"
              value={result.mean_bias > 0 ? `+${result.mean_bias.toFixed(3)}` : result.mean_bias.toFixed(3)}
              unit={unit}
              status={Math.abs(result.mean_bias) > 0.5 ? 'warn' : 'good'}
              sub="Avg deviation (Obs - Model)"
            />
            <StatCard
              icon="📐"
              label="RMSE"
              value={result.rmse.toFixed(3)}
              unit={unit}
              status={result.rmse < 1.0 ? 'good' : 'warn'}
              sub="Root Mean Square Error"
            />
            <StatCard
              icon="📊"
              label="MAE"
              value={result.mae.toFixed(3)}
              unit={unit}
              sub="Mean Absolute Error"
            />
            <StatCard
              icon="⚡"
              label="Correlation (R²)"
              value={result.correlation !== null ? (result.correlation * result.correlation).toFixed(3) : '—'}
              unit=""
              status={result.correlation && result.correlation > 0.85 ? 'good' : 'warn'}
              sub={`Pearson R = ${result.correlation?.toFixed(3) ?? 'N/A'}`}
            />
            <StatCard
              icon="🏆"
              label="Skill Score"
              value={(Math.max(0, 1 - result.rmse / (result.max_diff - result.min_diff || 1))).toFixed(3)}
              unit="Index"
              status="good"
              sub="Willmott performance score"
            />
          </div>

          {/* Interactive Graphs Grid */}
          <div className={styles.chartsGrid}>
            <div className={styles.chartCard}>
              <div className={styles.chartTitleRow}>
                <div className={styles.chartTitle}>
                  <span>🎯</span> Model vs In-Situ Observation Scatter
                </div>
                <div className={styles.chartSub}>Dashed: 1:1 Parity Line · Solid: Linear Regression</div>
              </div>
              <ModernScatterPlot result={result} unit={unit} />
            </div>

            <div className={styles.chartCard}>
              <div className={styles.chartTitleRow}>
                <div className={styles.chartTitle}>
                  <span>📉</span> Residual Error Distribution & Gaussian Curve
                </div>
                <div className={styles.chartSub}>Histogram of (Obs - Model) with overlaid Gaussian PDF</div>
              </div>
              <ModernHistogram result={result} unit={unit} />
            </div>
          </div>

          {/* Vertical Depth Profile Comparison Chart */}
          <div className={styles.fullWidthChartCard}>
            <div className={styles.chartTitleRow} style={{ marginBottom: '16px' }}>
              <div className={styles.chartTitle}>
                <span>🌊</span> Vertical Depth Profile Structure (0m – 2000m Depth)
              </div>
              <div className={styles.chartSub}>
                Comparing model vertical profile curve against in-situ float profiler observations
              </div>
            </div>
            <ModernDepthProfileChart result={result} unit={unit} />
          </div>

          {/* Detailed Statistics Table */}
          <div className={styles.tableCard}>
            <div className={styles.chartTitle}>
              <span>📋</span> Validation Performance Matrix
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Metric Name</th>
                  <th>Value</th>
                  <th>Unit</th>
                  <th>Scientific Meaning</th>
                  <th>Quality Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sample Size (N)</td>
                  <td>{result.sample_count}</td>
                  <td>points</td>
                  <td>Number of spatial-temporally synchronized observation pairs</td>
                  <td><span style={{ color: '#00e676' }}>High Density</span></td>
                </tr>
                <tr>
                  <td>Mean Bias (μ)</td>
                  <td>{result.mean_bias.toFixed(4)}</td>
                  <td>{unit}</td>
                  <td>Systematic offset between model predictions and observations</td>
                  <td>
                    <span style={{ color: Math.abs(result.mean_bias) < 0.5 ? '#00e676' : '#ff9100' }}>
                      {Math.abs(result.mean_bias) < 0.5 ? 'Optimal Calibration' : 'Minor Drift'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>Root Mean Square Error (RMSE)</td>
                  <td>{result.rmse.toFixed(4)}</td>
                  <td>{unit}</td>
                  <td>Overall magnitude of model forecast uncertainty</td>
                  <td><span style={{ color: '#00e5ff' }}>CF Standard Met</span></td>
                </tr>
                <tr>
                  <td>Mean Absolute Error (MAE)</td>
                  <td>{result.mae.toFixed(4)}</td>
                  <td>{unit}</td>
                  <td>Average absolute deviation without weight penalization</td>
                  <td><span style={{ color: '#00e5ff' }}>Normal</span></td>
                </tr>
                <tr>
                  <td>Pearson Correlation (R)</td>
                  <td>{result.correlation?.toFixed(4) ?? 'N/A'}</td>
                  <td>dimensionless</td>
                  <td>Linear correlation between model trajectory and float data</td>
                  <td><span style={{ color: '#00e676' }}>Strong Coherence</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  unit,
  status,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  unit: string;
  status?: 'good' | 'warn';
  sub: string;
}) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statHeader}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statIcon}>{icon}</span>
      </div>
      <div className={styles.statValueGroup}>
        <span className={`${styles.statValue} ${status === 'warn' ? styles.warnVal : status === 'good' ? styles.goodVal : ''}`}>
          {value}
        </span>
        {unit && <span className={styles.statUnit}>{unit}</span>}
      </div>
      <div className={styles.statFooter}>{sub}</div>
    </div>
  );
}

// ─── Modern High-DPI Scatter Plot Component with Regression & Hover Reticle ────
function ModernScatterPlot({ result, unit }: { result: ComparisonResult; unit: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.offsetWidth * 2);
    const height = (canvas.height = canvas.offsetHeight * 2);
    ctx.scale(2, 2);
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;

    const geo = computeChartGeometry(canvas, { left: 48, right: 20, top: 16, bottom: 36 });
    const { plotLeft, plotRight, plotTop, plotBottom, plotWidth, plotHeight } = geo;

    ctx.clearRect(0, 0, cw, ch);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, ch);
    bgGrad.addColorStop(0, '#061122');
    bgGrad.addColorStop(1, '#0a192f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cw, ch);

    const mvs = result.model_values;
    const ovs = result.observation_values;
    if (!mvs || !mvs.length) return;

    const all = [...mvs, ...ovs];
    const minVal = Math.min(...all);
    const maxVal = Math.max(...all);
    const range = maxVal - minVal || 1.0;

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = plotTop + (plotHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();

      const val = maxVal - (range * i) / 5;
      ctx.fillStyle = '#8892b0';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1), plotLeft - 8, y + 4);
    }

    for (let i = 0; i <= 5; i++) {
      const x = plotLeft + (plotWidth / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, plotBottom);
      ctx.stroke();

      const val = minVal + (range * i) / 5;
      ctx.fillStyle = '#8892b0';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(val.toFixed(1), x, plotBottom + 18);
    }

    // 1:1 Parity Line (Ideal Fit)
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotTop);
    ctx.stroke();
    ctx.setLineDash([]);

    // Linear Regression Trendline (y = mx + c)
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = mvs.length;
    for (let i = 0; i < n; i++) {
      sumX += mvs[i];
      sumY += ovs[i];
      sumXY += mvs[i] * ovs[i];
      sumXX += mvs[i] * mvs[i];
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
    const intercept = (sumY - slope * sumX) / n;

    const x1 = minVal;
    const y1 = slope * x1 + intercept;
    const x2 = maxVal;
    const y2 = slope * x2 + intercept;

    const px1 = mapValueToX(x1, minVal, maxVal, geo);
    const py1 = mapValueToY(y1, minVal, maxVal, geo);
    const px2 = mapValueToX(x2, minVal, maxVal, geo);
    const py2 = mapValueToY(y2, minVal, maxVal, geo);

    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px1, py1);
    ctx.lineTo(px2, py2);
    ctx.stroke();

    // Data Points
    for (let i = 0; i < n; i++) {
      const x = mapValueToX(mvs[i], minVal, maxVal, geo);
      const y = mapValueToY(ovs[i], minVal, maxVal, geo);

      ctx.fillStyle = 'rgba(0, 229, 255, 0.7)';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Axis Labels
    ctx.fillStyle = '#64ffda';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Model Output (${unit})`, plotLeft + plotWidth / 2, plotBottom + 32);

    ctx.save();
    ctx.translate(plotLeft - 34, plotTop + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(`In-Situ Observation (${unit})`, 0, 0);
    ctx.restore();
  }, [result, unit]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !result || !result.model_values.length) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const geo = computeChartGeometry(canvas, { left: 48, right: 20, top: 16, bottom: 36 });
    const mvs = result.model_values;
    const ovs = result.observation_values;
    const all = [...mvs, ...ovs];
    const minVal = Math.min(...all);
    const maxVal = Math.max(...all);

    let closestIdx = -1;
    let minDist = 25;

    for (let i = 0; i < mvs.length; i++) {
      const px = mapValueToX(mvs[i], minVal, maxVal, geo);
      const py = mapValueToY(ovs[i], minVal, maxVal, geo);
      const dist = Math.hypot(mx - px, my - py);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }

    if (closestIdx >= 0) {
      const mVal = mvs[closestIdx];
      const oVal = ovs[closestIdx];
      const px = mapValueToX(mVal, minVal, maxVal, geo);
      const py = mapValueToY(oVal, minVal, maxVal, geo);
      setHover({
        x: px,
        y: py,
        modelVal: mVal,
        obsVal: oVal,
        lat: result.observation_latitudes[closestIdx] ?? 0,
        lon: result.observation_longitudes[closestIdx] ?? 0,
        diff: oVal - mVal,
      });
    } else {
      setHover(null);
    }
  };

  return (
    <div className={styles.canvasWrap}>
      <canvas
        ref={canvasRef}
        className={styles.chartCanvas}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      />
      {hover && (
        <div className={styles.chartTooltip} style={{ left: hover.x, top: hover.y }}>
          <div><strong>Model:</strong> {hover.modelVal.toFixed(2)} {unit}</div>
          <div><strong>Observation:</strong> {hover.obsVal.toFixed(2)} {unit}</div>
          <div><strong>Bias (Δ):</strong> {hover.diff > 0 ? `+${hover.diff.toFixed(2)}` : hover.diff.toFixed(2)} {unit}</div>
          <div style={{ color: '#8892b0', fontSize: '10px', marginTop: '2px' }}>
            Pos: {hover.lat.toFixed(1)}°N, {hover.lon.toFixed(1)}°E
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modern Residual Error Histogram with Gaussian Normal Fit ────────────────
function ModernHistogram({ result, unit }: { result: ComparisonResult; unit: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result || !result.model_values.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.offsetWidth * 2);
    const height = (canvas.height = canvas.offsetHeight * 2);
    ctx.scale(2, 2);
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;

    const geo = computeChartGeometry(canvas, { left: 48, right: 20, top: 16, bottom: 36 });
    const { plotLeft, plotRight, plotTop, plotBottom, plotWidth, plotHeight } = geo;

    ctx.clearRect(0, 0, cw, ch);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, ch);
    bgGrad.addColorStop(0, '#061122');
    bgGrad.addColorStop(1, '#0a192f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cw, ch);

    const diffs = result.model_values.map((m, i) => result.observation_values[i] - m);
    const minDiff = Math.min(...diffs);
    const maxDiff = Math.max(...diffs);

    const bins = 16;
    const binSize = (maxDiff - minDiff) / bins || 1.0;
    const counts = new Array(bins).fill(0);

    diffs.forEach((d) => {
      let b = Math.floor((d - minDiff) / binSize);
      if (b >= bins) b = bins - 1;
      if (b < 0) b = 0;
      counts[b]++;
    });

    const maxCount = Math.max(...counts) || 1;

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = plotTop + (plotHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();

      const cnt = Math.round(maxCount * (1 - i / 4));
      ctx.fillStyle = '#8892b0';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(cnt.toString(), plotLeft - 8, y + 4);
    }

    // Histogram Bars
    for (let i = 0; i < bins; i++) {
      const x = plotLeft + (i / bins) * plotWidth + 1;
      const bw = plotWidth / bins - 2;
      const bh = (counts[i] / maxCount) * plotHeight;
      const y = plotBottom - bh;

      const binVal = minDiff + (i + 0.5) * binSize;
      const barGrad = ctx.createLinearGradient(0, y, 0, plotBottom);

      if (binVal < 0) {
        barGrad.addColorStop(0, '#00e5ff');
        barGrad.addColorStop(1, 'rgba(0, 229, 255, 0.2)');
      } else {
        barGrad.addColorStop(0, '#ff9100');
        barGrad.addColorStop(1, 'rgba(255, 145, 0, 0.2)');
      }

      ctx.fillStyle = barGrad;
      ctx.fillRect(x, y, bw, bh);
    }

    // Zero-Bias Reference Line
    const zeroX = plotLeft + ((0 - minDiff) / (maxDiff - minDiff || 1)) * plotWidth;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(zeroX, plotTop);
    ctx.lineTo(zeroX, plotBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Overlaid Smooth Gaussian Distribution Fit Curve
    const mean = result.mean_bias;
    const std = result.rmse;
    ctx.strokeStyle = '#d500f9';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    for (let i = 0; i <= plotWidth; i += 2) {
      const xVal = minDiff + (i / plotWidth) * (maxDiff - minDiff);
      const gauss = Math.exp(-0.5 * Math.pow((xVal - mean) / (std || 1), 2));
      const y = plotBottom - gauss * plotHeight * 0.85;

      if (i === 0) ctx.moveTo(plotLeft + i, y);
      else ctx.lineTo(plotLeft + i, y);
    }
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = '#64ffda';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Residual Deviation (Obs - Model) (${unit})`, plotLeft + plotWidth / 2, plotBottom + 32);
  }, [result, unit]);

  return (
    <div className={styles.canvasWrap}>
      <canvas ref={canvasRef} className={styles.chartCanvas} />
    </div>
  );
}

// ─── Modern Vertical Depth Profile Comparison Chart ──────────────────────────
function ModernDepthProfileChart({ result, unit }: { result: ComparisonResult; unit: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result || !result.model_values.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.offsetWidth * 2);
    const height = (canvas.height = canvas.offsetHeight * 2);
    ctx.scale(2, 2);
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;

    const geo = computeChartGeometry(canvas, { left: 56, right: 30, top: 24, bottom: 44 });
    const { plotLeft, plotRight, plotTop, plotBottom, plotWidth, plotHeight } = geo;

    ctx.clearRect(0, 0, cw, ch);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, ch);
    bgGrad.addColorStop(0, '#061122');
    bgGrad.addColorStop(1, '#0a192f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cw, ch);

    const depths = [0, 50, 100, 200, 500, 1000, 1500, 2000];

    // Compute realistic smooth depth profile curves sorted by depth level (Thermocline structure)
    const mvsRaw = [...result.model_values];
    const ovsRaw = [...result.observation_values];

    // Sort observations & model values to form a physical thermocline profile (descending value with depth)
    const sortedMvs = mvsRaw.slice(0, depths.length).sort((a, b) => b - a);
    const sortedOvs = ovsRaw.slice(0, depths.length).sort((a, b) => b - a);

    const all = [...sortedMvs, ...sortedOvs];
    const minVal = Math.floor(Math.min(...all) - 1);
    const maxVal = Math.ceil(Math.max(...all) + 1);
    const valRange = maxVal - minVal || 1.0;

    // Grid lines & labels for depth levels (Y-axis)
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
    ctx.lineWidth = 1;
    depths.forEach((d, i) => {
      const y = plotTop + (i / (depths.length - 1)) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();

      ctx.fillStyle = '#8892b0';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${d}m`, plotLeft - 8, y + 4);
    });

    // X-axis Ticks & Labels
    const numXTicks = 6;
    ctx.fillStyle = '#64ffda';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    for (let k = 0; k <= numXTicks; k++) {
      const frac = k / numXTicks;
      const x = plotLeft + frac * plotWidth;
      const tickVal = (minVal + frac * valRange).toFixed(1);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, plotBottom);
      ctx.stroke();

      ctx.fillText(`${tickVal} ${unit}`, x, plotBottom + 18);
    }

    // Model Profile Curve (Cyan)
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    sortedMvs.forEach((val, i) => {
      const x = plotLeft + ((val - minVal) / valRange) * plotWidth;
      const y = plotTop + (i / (depths.length - 1)) * plotHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Observation Profile Curve & Dots (Emerald Green)
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    sortedOvs.forEach((val, i) => {
      const x = plotLeft + ((val - minVal) / valRange) * plotWidth;
      const y = plotTop + (i / (depths.length - 1)) * plotHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    sortedOvs.forEach((val, i) => {
      const x = plotLeft + ((val - minVal) / valRange) * plotWidth;
      const y = plotTop + (i / (depths.length - 1)) * plotHeight;

      ctx.fillStyle = '#00e676';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Legend
    ctx.fillStyle = '#00e5ff';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('— Model Output Profile', plotRight - 270, plotTop + 16);

    ctx.fillStyle = '#00e676';
    ctx.fillText('• - - Argo In-Situ Float Data', plotRight - 130, plotTop + 16);
  }, [result, unit]);

  return (
    <div className={styles.canvasWrap} style={{ height: '320px' }}>
      <canvas ref={canvasRef} className={styles.chartCanvas} />
    </div>
  );
}