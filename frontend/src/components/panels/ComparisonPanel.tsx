import { useEffect, useState, useRef } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { analysisApi } from '@/services/api';
import type { ComparisonResult } from '@/types';
import styles from './PanelSection.module.css';
import { computeChartGeometry, mapValueToX, mapValueToY, ChartGeometry } from '@/utils/chartGeometry';

export function ComparisonPanel() {
  const variable = useOceanStore((s) => s.variable);
  const currentTime = useOceanStore((s) => s.currentTime);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depthMin, setDepthMin] = useState(0);
  const [depthMax, setDepthMax] = useState(2000);

  useEffect(() => {
    setLoading(true);
    setError(null);
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
      .then((r) => setResult(r))
      .catch((e) => setError(e?.message ?? 'Comparison failed'))
      .finally(() => setLoading(false));
  }, [variable, currentTime, depthMin, depthMax]);

  return (
    <div className={styles.section}>
      <div className="panel-section-title">Model vs Observation</div>
      <div className={styles.controlGroup}>
        <span className={styles.controlGroupLabel}>Depth Range</span>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Min</span>
          <input
            type="number"
            className={styles.rangeInput}
            value={depthMin}
            step={50}
            min={0}
            max={4000}
            onChange={(e) => setDepthMin(Math.max(0, parseFloat(e.target.value) || 0))}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Max</span>
          <input
            type="number"
            className={styles.rangeInput}
            value={depthMax}
            step={50}
            min={0}
            max={4000}
            onChange={(e) => setDepthMax(parseFloat(e.target.value) || 2000)}
          />
        </div>
      </div>
      {loading ? (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div className="spinner" style={{ display: 'inline-block' }} />
        </div>
      ) : error ? (
        <div style={{ padding: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>{error}</div>
      ) : result ? (
        <ComparisonStats result={result} />
      ) : null}
    </div>
  );
}

function ComparisonStats({ result }: { result: ComparisonResult }) {
  return (
    <div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Samples</span>
        <span className={styles.rowValue}>{result.sample_count}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Mean bias</span>
        <span className={styles.rowValue} style={{ color: result.mean_bias > 0 ? 'var(--layer-argo)' : 'var(--layer-model)' }}>
          {result.mean_bias > 0 ? '+' : ''}
          {result.mean_bias.toFixed(3)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>RMSE</span>
        <span className={styles.rowValue}>{result.rmse.toFixed(3)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>MAE</span>
        <span className={styles.rowValue}>{result.mae.toFixed(3)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Min diff</span>
        <span className={styles.rowValue}>{result.min_diff.toFixed(3)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Max diff</span>
        <span className={styles.rowValue}>{result.max_diff.toFixed(3)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Correlation</span>
        <span className={styles.rowValue}>
          {result.correlation !== null ? result.correlation.toFixed(3) : '—'}
        </span>
      </div>
      <ScatterPlot result={result} />
      <DiffHistogram result={result} />
    </div>
  );
}

function ScatterPlot({ result }: { result: ComparisonResult }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width = c.offsetWidth * 2;
    const h = c.height = c.offsetHeight * 2;
    ctx.scale(2, 2);
    const cw = c.offsetWidth;
    const ch = c.offsetHeight;

    const geo = computeChartGeometry(c, { left: 48, right: 16, top: 12, bottom: 36 });
    const { plotLeft, plotRight, plotTop, plotBottom, plotWidth, plotHeight } = geo;

    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = getComputedStyle(c).getPropertyValue('--bg-tertiary').trim() || '#16253a';
    ctx.fillRect(0, 0, cw, ch);

    const mvs = result.model_values;
    const ovs = result.observation_values;
    if (!mvs.length) return;
    const all = [...mvs, ...ovs];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const range = hi - lo || 1;

    // Grid
    ctx.strokeStyle = 'rgba(180, 145, 60, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = plotTop + (plotHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();
      const val = hi - (range * i / 4);
      ctx.fillStyle = 'var(--text-tertiary)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(2), plotLeft - 8, y + 3);
    }

    // 1:1 line
    ctx.strokeStyle = 'rgba(180, 145, 60, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotTop);
    ctx.stroke();
    ctx.setLineDash([]);

    // Points
    for (let i = 0; i < mvs.length; i++) {
      const x = mapValueToX(mvs[i], lo, hi, geo);
      const y = mapValueToY(ovs[i], lo, hi, geo);
      ctx.fillStyle = 'rgba(200, 107, 46, 0.7)';
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Axes
    ctx.strokeStyle = 'rgba(180, 145, 60, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = 'var(--text-tertiary)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Model', plotLeft + plotWidth / 2, plotBottom + 24);
    ctx.save();
    ctx.translate(plotLeft - 32, plotTop + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Obs', 0, 0);
    ctx.restore();

    // Value labels at corners
    ctx.fillStyle = 'var(--text-tertiary)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(lo.toFixed(1), plotLeft, plotBottom + 14);
    ctx.textAlign = 'right';
    ctx.fillText(hi.toFixed(1), plotRight, plotBottom + 14);
  }, [result]);
  return (
    <div style={{ marginTop: 6 }}>
      <div className="text-label" style={{ fontSize: 10, marginBottom: 2 }}>Scatter (model vs obs)</div>
      <canvas ref={ref} style={{ width: '100%', height: 130 }} />
    </div>
  );
}

function DiffHistogram({ result }: { result: ComparisonResult }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width = c.offsetWidth * 2;
    const h = c.height = c.offsetHeight * 2;
    ctx.scale(2, 2);
    const cw = c.offsetWidth;
    const ch = c.offsetHeight;

    const geo = computeChartGeometry(c, { left: 48, right: 16, top: 12, bottom: 36 });
    const { plotLeft, plotRight, plotTop, plotBottom, plotWidth, plotHeight } = geo;

    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = getComputedStyle(c).getPropertyValue('--bg-tertiary').trim() || '#16253a';
    ctx.fillRect(0, 0, cw, ch);

    const mvs = result.model_values;
    const ovs = result.observation_values;
    if (!mvs.length) return;
    const diffs = mvs.map((v, i) => ovs[i] - v);
    const lo = Math.min(...diffs);
    const hi = Math.max(...diffs);
    const bins = 14;
    const binSize = (hi - lo) / bins || 1;
    const counts = new Array(bins).fill(0);
    for (const d of diffs) {
      let b = Math.floor((d - lo) / binSize);
      if (b >= bins) b = bins - 1;
      if (b < 0) b = 0;
      counts[b]++;
    }
    const maxC = Math.max(...counts) || 1;

    // Grid
    ctx.strokeStyle = 'rgba(180, 145, 60, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = plotTop + (plotHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();
    }

    // Bars
    for (let i = 0; i < bins; i++) {
      const x = plotLeft + (i / bins) * plotWidth;
      const bw = plotWidth / bins - 1;
      const bh = (counts[i] / maxC) * plotHeight;
      const y = plotBottom - bh;
      // Color by sign: teal (-) or argo (+)
      const midpoint = -lo / (hi - lo || 1);
      const t = i / (bins - 1);
      const isNeg = t < midpoint;
      ctx.fillStyle = isNeg ? 'rgba(58, 155, 158, 0.7)' : 'rgba(200, 107, 46, 0.7)';
      ctx.fillRect(x, y, bw, bh);
    }

    // Zero line
    const zeroX = plotLeft + (-lo / (hi - lo || 1)) * plotWidth;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(zeroX, plotTop);
    ctx.lineTo(zeroX, plotBottom);
    ctx.stroke();

    // Axes
    ctx.strokeStyle = 'rgba(180, 145, 60, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = 'var(--text-tertiary)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Obs − Model', plotLeft + plotWidth / 2, plotBottom + 24);
    ctx.save();
    ctx.translate(plotLeft - 32, plotTop + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Count', 0, 0);
    ctx.restore();

    // Value labels at corners
    ctx.fillStyle = 'var(--text-tertiary)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(lo.toFixed(2), plotLeft, plotBottom + 14);
    ctx.textAlign = 'right';
    ctx.fillText(hi.toFixed(2), plotRight, plotBottom + 14);
  }, [result]);
  return (
    <div style={{ marginTop: 6 }}>
      <div className="text-label" style={{ fontSize: 10, marginBottom: 2 }}>Residual distribution</div>
      <canvas ref={ref} style={{ width: '100%', height: 110 }} />
    </div>
  );
}