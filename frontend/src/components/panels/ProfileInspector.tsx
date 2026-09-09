import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { dataApi } from '@/services/api';
import type { DepthProfile } from '@/types';
import styles from './PanelSection.module.css';
import { mapValueToX, mapDepthToY, ChartGeometry } from '@/utils/chartGeometry';

// Memoized ProfileChart component to prevent remounting on parent re-renders
export const ProfileChart = memo(function ProfileChart({ profile }: { profile: DepthProfile }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number; x: number; y: number; depth: number; value: number } | null>(null);

  const drawChart = useCallback((canvas: HTMLCanvasElement, hoveredIndex: number | null = null) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pw = canvas.offsetWidth;
    const ph = canvas.offsetHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = pw * dpr;
    canvas.height = ph * dpr;
    ctx.scale(dpr, dpr);

    const depths = profile.depth;
    const vals = profile.values;
    if (!vals || !vals.length) return;

    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const minD = Math.min(...depths);
    const maxD = Math.max(...depths);

    const style = getComputedStyle(canvas);
    const bgColor = style.getPropertyValue('--chart-bg').trim() || '#0b141e';
    const axisColor = style.getPropertyValue('--chart-axis-color').trim() || '#3a9b9e';
    const gridColor = style.getPropertyValue('--chart-grid-color').trim() || 'rgba(58,155,158,0.12)';
    const textColor = style.getPropertyValue('--chart-text-color').trim() || '#6d685b';

    ctx.clearRect(0, 0, pw, ph);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, pw, ph);

    // ===== EXPLICIT THREE-ZONE GEOMETRY =====
    // Zone 1: Y-axis title area (fixed width for rotated "Depth (m)")
    const titleAreaWidth = 42;
    // Zone 2: Depth tick label area (fixed width for "2000 m" etc.)
    const tickAreaWidth = 48;
    // Gap between tick labels and plot
    const tickGap = 8;

    // Margins
    const topMargin = 12;
    const bottomMargin = 56;
    const rightMargin = 16;

    // Calculate plot boundaries from three zones
    const plotLeft = titleAreaWidth + tickAreaWidth + tickGap;
    const plotRight = pw - rightMargin;
    const plotTop = topMargin;
    const plotBottom = ph - bottomMargin;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    // Skip if plot area is too small (minimum ~220px panel width)
    if (plotWidth < 50 || plotHeight < 50) return;

    // Tick positions using actual plot height
    const actualTickCount = Math.max(3, Math.min(6, Math.floor(plotHeight / 30)));
    const tickYPositions: number[] = [];
    const actualTickLabels: string[] = [];
    for (let i = 0; i <= actualTickCount; i++) {
      const y = plotTop + (plotHeight / actualTickCount) * i;
      tickYPositions.push(y);
      const d = (maxD - (maxD - minD) * (i / actualTickCount)).toFixed(0);
      actualTickLabels.push(d + ' m');
    }

    // ===== X POSITIONS FOR EACH ZONE =====
    // Title area center X (fixed)
    const titleCenterX = titleAreaWidth / 2; // 21px
    // Tick label area: right-aligned at plotLeft - tickGap
    const tickLabelX = plotLeft - tickGap;
    // Plot center X for X-axis title
    const plotCenterX = plotLeft + plotWidth / 2;
    // Plot vertical center for Y-axis title
    const plotVerticalCenterY = plotTop + plotHeight / 2;

    // ===== DRAW AXES =====
    ctx.strokeStyle = `${axisColor}33`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    // ===== GRID LINES (start at plotLeft, end at plotRight) =====
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (const y of tickYPositions) {
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();
    }

    // ===== DEPTH TICK LABELS (in tick label area, right-aligned) =====
    const tickLabelFont = '9px JetBrains Mono, monospace';
    ctx.fillStyle = textColor;
    ctx.font = tickLabelFont;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < actualTickLabels.length; i++) {
      ctx.fillText(actualTickLabels[i], tickLabelX, tickYPositions[i]);
    }

    // ===== Y-AXIS TITLE (in title area ONLY, centered, rotated) =====
    const titleFont = '9px Space Grotesk, sans-serif';
    ctx.save();
    ctx.fillStyle = textColor;
    ctx.font = titleFont;
    ctx.translate(titleCenterX, plotVerticalCenterY);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Depth (m)', 0, 0);
    ctx.restore();

    // ===== X-AXIS VALUE LABELS (min/max temperature) =====
    const valueFont = '9px JetBrains Mono, monospace';
    const maxVLabel = maxV.toFixed(2);
    const minVLabel = minV.toFixed(2);
    const unitLabel = profile.unit;

    ctx.fillStyle = textColor;
    ctx.font = valueFont;
    ctx.textBaseline = 'bottom';

    // Max value at top-left of plot
    ctx.textAlign = 'left';
    ctx.fillText(maxVLabel, plotLeft, plotTop - 4);

    // Min value at bottom-right of plot
    ctx.textAlign = 'right';
    ctx.fillText(minVLabel, plotRight, plotBottom + 16);

    // Unit label below min value
    ctx.textAlign = 'right';
    ctx.fillText(unitLabel, plotRight, plotBottom + 28);

    // ===== PROFILE LINE =====
    ctx.beginPath();
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.8;
    const points: Array<{ x: number; y: number; depth: number; value: number }> = [];
    for (let i = 0; i < depths.length; i++) {
      const x = mapValueToX(vals[i], minV, maxV, {
        plotLeft, plotRight, plotTop, plotBottom,
        plotWidth, plotHeight,
        canvasWidth: pw, canvasHeight: ph,
        left: titleAreaWidth + tickAreaWidth + tickGap, right: rightMargin, top: topMargin, bottom: bottomMargin
      });
      const y = mapDepthToY(depths[i], minD, maxD, {
        plotLeft, plotRight, plotTop, plotBottom,
        plotWidth, plotHeight,
        canvasWidth: pw, canvasHeight: ph,
        left: titleAreaWidth + tickAreaWidth + tickGap, right: rightMargin, top: topMargin, bottom: bottomMargin
      });
      points.push({ x, y, depth: depths[i], value: vals[i] });
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // ===== AREA FILL =====
    ctx.lineTo(plotRight, plotBottom);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.closePath();
    ctx.fillStyle = `${axisColor}1a`;
    ctx.fill();

    // ===== MARKERS =====
    ctx.fillStyle = axisColor;
    for (let i = 0; i < depths.length; i++) {
      const x = mapValueToX(vals[i], minV, maxV, {
        plotLeft, plotRight, plotTop, plotBottom,
        plotWidth, plotHeight,
        canvasWidth: pw, canvasHeight: ph,
        left: titleAreaWidth + tickAreaWidth + tickGap, right: rightMargin, top: topMargin, bottom: bottomMargin
      });
      const y = mapDepthToY(depths[i], minD, maxD, {
        plotLeft, plotRight, plotTop, plotBottom,
        plotWidth, plotHeight,
        canvasWidth: pw, canvasHeight: ph,
        left: titleAreaWidth + tickAreaWidth + tickGap, right: rightMargin, top: topMargin, bottom: bottomMargin
      });
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ===== HOVERED POINT HIGHLIGHT =====
    if (hoveredIndex !== null && hoveredIndex < points.length) {
      const hp = points[hoveredIndex];
      ctx.beginPath();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.arc(hp.x, hp.y, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 2;
      ctx.arc(hp.x, hp.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ===== X-AXIS TITLE (centered under plot) =====
    const xAxisTitle = profile.variable;
    ctx.fillStyle = textColor;
    ctx.font = titleFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(xAxisTitle, plotCenterX, plotBottom + 36);

    // Store points and geometry for tooltip
    (canvas as any).__chartPoints = points;
    (canvas as any).__chartGeometry = {
      left: titleAreaWidth + tickAreaWidth + tickGap,
      right: rightMargin,
      top: topMargin,
      bottom: bottomMargin,
      plotLeft, plotRight, plotTop, plotBottom,
      plotWidth, plotHeight,
      canvasWidth: pw, canvasHeight: ph
    };
  }, [profile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      drawChart(canvas, hoveredPoint?.index ?? null);
    });
    resizeObserver.observe(canvas);

    drawChart(canvas, hoveredPoint?.index ?? null);

    return () => resizeObserver.disconnect();
  }, [drawChart, hoveredPoint?.index]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const points = (canvas as any).__chartPoints;
    const geo = (canvas as any).__chartGeometry as ChartGeometry | undefined;

    if (!points || !geo) {
      setHoveredPoint(null);
      return;
    }

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < geo.plotLeft || x > geo.plotRight ||
        y < geo.plotTop || y > geo.plotBottom) {
      setHoveredPoint(null);
      return;
    }

    // Find closest point
    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.hypot(points[i].x - x, points[i].y - y);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }

    if (minDist < 16) {
      const cp = points[closestIdx];
      setHoveredPoint({ index: closestIdx, x: cp.x, y: cp.y, depth: cp.depth, value: cp.value });
    } else {
      setHoveredPoint(null);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null);
  }, []);

  // Compute tooltip position with edge avoidance
  const tooltipStyle = hoveredPoint ? (() => {
    const canvas = canvasRef.current;
    if (!canvas) return {};
    const containerRect = canvas.parentElement?.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const containerWidth = containerRect?.width ?? canvasRect.width;
    const containerHeight = containerRect?.height ?? canvasRect.height;

    const tooltipWidth = 160;
    const tooltipHeight = 56;

    let left = hoveredPoint.x;
    let top = hoveredPoint.y;
    let transform = 'translate(-50%, -100%)';

    if (left + tooltipWidth / 2 > containerWidth - 8) {
      left = containerWidth - tooltipWidth / 2 - 8;
      transform = 'translate(0%, -100%)';
    }
    if (left - tooltipWidth / 2 < 8) {
      left = tooltipWidth / 2 + 8;
      transform = 'translate(-100%, -100%)';
    }
    if (top - tooltipHeight - 8 < 0) {
      top = top + 16;
      transform = transform.replace('-100%', '0%');
    }

    return { left: `${left}px`, top: `${top}px`, transform };
  })() : {};

  return (
    <div className="chartContainer" style={{ position: 'relative', height: 200, marginTop: 4 }}>
      <canvas
        ref={canvasRef}
        className="chartCanvas"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        aria-label={`Depth profile for ${profile.variable}`}
      />
      {hoveredPoint && (
        <div
          className="chartTooltip"
          style={tooltipStyle}
        >
          <div>Depth: {hoveredPoint.depth.toFixed(0)} m</div>
          <div>{profile.variable}: {hoveredPoint.value.toFixed(2)} {profile.unit}</div>
        </div>
      )}
    </div>
  );
});

ProfileChart.displayName = 'ProfileChart';

export function ProfileInspector() {
  const probe = useOceanStore((s) => s.probeLocation);
  const setProbe = useOceanStore((s) => s.setProbeLocation);
  const variable = useOceanStore((s) => s.variable);
  const currentTime = useOceanStore((s) => s.currentTime);
  const profileLoading = useOceanStore((s) => s.profileLoading);
  const setProfileLoading = useOceanStore((s) => s.setProfileLoading);

  const [profile, setProfile] = useState<DepthProfile | null>(null);

  useEffect(() => {
    if (!probe) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    dataApi
      .getProfile({
        variable,
        time: currentTime,
        latitude: probe.lat,
        longitude: probe.lon,
      })
      .then((p) => setProfile(p))
      .catch((err) => console.error('Profile fetch failed', err))
      .finally(() => setProfileLoading(false));
  }, [probe, variable, currentTime, setProfileLoading]);

  if (!probe) {
    return (
      <div className={styles.section}>
        <div className="panel-section-title">Probe Inspector</div>
        <div className={styles.row}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Click on the ocean to inspect a location. A depth profile will appear here.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className="panel-section-title">
        Probe · {probe.lat.toFixed(2)}°N, {probe.lon.toFixed(2)}°E
        <button
          className="btn btn-icon btn-ghost"
          onClick={() => setProbe(null)}
          title="Clear"
          style={{ float: 'right', fontSize: 12 }}
        >
          ✕
        </button>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Variable</span>
        <span className={styles.rowValue}>{variable}</span>
      </div>
      {profileLoading ? (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div className="spinner" style={{ display: 'inline-block' }} />
        </div>
      ) : profile ? (
        <ProfileChart profile={profile} />
      ) : (
        <div style={{ padding: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
          No profile data
        </div>
      )}
    </div>
  );
}