import { useEffect, useState, useRef, useCallback } from 'react';
import { useOceanStore } from '@/stores/oceanStore';
import { observationsApi, dataApi } from '@/services/api';
import { MOORING_BUOYS } from '@/config/moorings';
import type { ArgoProfile, DepthProfile } from '@/types';
import styles from './DetailPanel.module.css';

// ─── SVG ICONS ─────────────────────────────────────────────────────────────────

function BuoyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6M8 8h8M6 14a6 6 0 0 0 12 0M2 18c2 1 4 1 6 0s4-1 6 0 4 1 6 0" />
    </svg>
  );
}

function ArgoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="16" rx="3" />
      <path d="M12 18v4M9 22h6M12 6h.01" />
    </svg>
  );
}

function GliderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12l20-5-5 12-5-4-6 2z" />
    </svg>
  );
}

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function OperationalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

// ─── MAIN DETAIL PANEL COMPONENT ─────────────────────────────────────────────

export function DetailPanel() {
  const setDetailOpen = useOceanStore((s) => s.setDetailPanelOpen);
  const selectedArgoId = useOceanStore((s) => s.selectedArgoId);
  const selectedGliderId = useOceanStore((s) => s.selectedGliderId);
  const argoFloats = useOceanStore((s) => s.argoFloats);
  const gliderTracks = useOceanStore((s) => s.gliderTracks);

  const [argoProfile, setArgoProfile] = useState<ArgoProfile | null>(null);
  const [modelProfile, setModelProfile] = useState<DepthProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartVar, setChartVar] = useState<'temperature' | 'salinity' | 'chl' | 'currents'>('temperature');

  // Lookup selected device
  const isMooring = Boolean(selectedArgoId?.startsWith('MOORING_'));
  const mooringId = isMooring && selectedArgoId ? selectedArgoId.replace('MOORING_', '') : null;
  const mooring = MOORING_BUOYS.find((m) => m.id === mooringId);

  const argoFloat = argoFloats.find((f) => f.float_id === selectedArgoId);
  const gliderTrack = gliderTracks.find((t) => t.glider_id === selectedGliderId);

  const handleClose = () => {
    setDetailOpen(false);
    useOceanStore.setState({ selectedArgoId: null, selectedGliderId: null });
  };

  // Device lat/lon coordinates
  const lat = argoFloat?.latitude ?? mooring?.lat ?? gliderTrack?.observations?.[0]?.latitude ?? 15.0;
  const lon = argoFloat?.longitude ?? mooring?.lon ?? gliderTrack?.observations?.[0]?.longitude ?? 75.0;

  // Fetch real ocean model profile + real float profile for this exact (lat, lon)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const promises: Promise<any>[] = [];

    // 1. Fetch real ocean model profile at (lat, lon) from backend /api/profile
    promises.push(
      dataApi
        .getProfile({ variable: chartVar, latitude: lat, longitude: lon })
        .then((p) => {
          if (!cancelled) setModelProfile(p);
        })
        .catch(() => {
          if (!cancelled) setModelProfile(null);
        })
    );

    // 2. If Argo Float selected, fetch float's measured profile from backend /api/observations/argo/{id}/profile
    if (selectedArgoId && !isMooring) {
      promises.push(
        observationsApi
          .getArgoProfile(selectedArgoId)
          .then((p) => {
            if (!cancelled) setArgoProfile(p);
          })
          .catch(() => {
            if (!cancelled) setArgoProfile(null);
          })
      );
    } else {
      setArgoProfile(null);
    }

    Promise.allSettled(promises).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedArgoId, selectedGliderId, isMooring, chartVar, lat, lon]);

  if (!selectedArgoId && !selectedGliderId) return null;

  const unitMap = {
    temperature: '°C',
    salinity: 'PSU',
    chl: 'mg/m³',
    currents: 'm/s',
  };

  // Real surface value from ocean model profile
  const surfaceVal = modelProfile?.values?.[0] !== undefined
    ? `${modelProfile.values[0].toFixed(2)} ${unitMap[chartVar]}`
    : '–';

  const maxModelDepth = modelProfile?.depth?.length
    ? `0 – ${modelProfile.depth[modelProfile.depth.length - 1]} m`
    : '–';

  const deviceName = isMooring
    ? `MOORING BUOY — ${mooring?.name || mooringId}`
    : argoFloat
    ? `ARGO FLOAT — ${argoFloat.float_id.replace('INCOIS_ARGO_', '#')}`
    : selectedArgoId
    ? `ARGO FLOAT — ${selectedArgoId}`
    : `GLIDER — ${gliderTrack?.name || selectedGliderId}`;

  const deviceId = isMooring
    ? mooring?.id
    : argoFloat
    ? argoFloat.float_id
    : gliderTrack?.glider_id || 'INCOIS_DEV_01';

  return (
    <div className={styles.panel}>
      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.avatarIcon}>
            {isMooring ? <BuoyIcon /> : argoFloat ? <ArgoIcon /> : <GliderIcon />}
          </div>
          <div>
            <div className={styles.headerTitle}>{deviceName}</div>
            <div className={styles.headerSubtitle}>In-situ Ocean Observation</div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.statusBadge}>
            <span className={styles.statusDot} /> ACTIVE
          </span>
          <button className={styles.closeBtn} onClick={handleClose} title="Close Panel">✕</button>
        </div>
      </div>

      <div className={styles.body}>
        {/* CARD 1: LOCATION & DEVICE */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderLeft}>
              <LocationIcon className={styles.cardIcon} />
              <span className={styles.cardTitle}>Location & Device</span>
            </div>
          </div>
          <div className={styles.grid4}>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Latitude</span>
              <span className={styles.metricVal}>{lat.toFixed(3)}° N</span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Longitude</span>
              <span className={styles.metricVal}>{lon.toFixed(3)}° E</span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Device Type</span>
              <span className={styles.metricVal}>
                {isMooring ? `${mooring?.type} Mooring Array` : argoFloat ? 'Argo Profiler' : 'Underwater Glider'}
              </span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Device ID</span>
              <span className={styles.metricVal}>{deviceId}</span>
            </div>
          </div>
        </div>

        {/* CARD 2: OPERATIONAL DETAILS */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderLeft}>
              <OperationalIcon className={styles.cardIcon} />
              <span className={styles.cardTitle}>Operational Details</span>
            </div>
          </div>
          <div className={styles.grid2}>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Current Operating Depth</span>
              <span className={styles.metricValHighlight}>
                {mooring
                  ? `0 – ${mooring.depth}`
                  : argoFloat
                  ? (argoFloat.last_depth ? `${argoFloat.last_depth} m` : `0 – ${argoFloat.depth_max} m`)
                  : '0 – 1,000 m'}
              </span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Observed Variables</span>
              <span className={styles.metricVal}>
                {mooring?.sensorTypes?.join(', ') ?? argoFloat?.variables.join(', ') ?? 'Temp, Salinity, Chl, Currents'}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: INCOIS ROMS OCEAN MODEL */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderLeft}>
              <DatabaseIcon className={styles.cardIconPurple} />
              <span className={styles.cardTitle}>INCOIS ROMS Ocean Model</span>
            </div>
            <span className={styles.modelBadge}>Real GODAS / ROMS</span>
          </div>
          <div className={styles.grid2}>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Surface Value ({chartVar.toUpperCase()})</span>
              <span className={styles.metricValCyan}>{surfaceVal}</span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Operating Depth Range</span>
              <span className={styles.metricVal}>{maxModelDepth}</span>
            </div>
          </div>
        </div>

        {/* CARD 4: VERTICAL DEPTH PROFILE GRAPH */}
        <div className={styles.card}>
          <div className={styles.chartCardHeader}>
            <div className={styles.cardHeaderLeft}>
              <ChartIcon className={styles.cardIconCyan} />
              <span className={styles.cardTitle}>Vertical Depth Profile</span>
            </div>
            <div className={styles.chartTabs}>
              <button
                className={`${styles.tabBtn} ${chartVar === 'temperature' ? styles.tabActive : ''}`}
                onClick={() => setChartVar('temperature')}
              >
                Temperature
              </button>
              <button
                className={`${styles.tabBtn} ${chartVar === 'salinity' ? styles.tabActive : ''}`}
                onClick={() => setChartVar('salinity')}
              >
                Salinity
              </button>
              <button
                className={`${styles.tabBtn} ${chartVar === 'chl' ? styles.tabActive : ''}`}
                onClick={() => setChartVar('chl')}
              >
                Chl
              </button>
              <button
                className={`${styles.tabBtn} ${chartVar === 'currents' ? styles.tabActive : ''}`}
                onClick={() => setChartVar('currents')}
              >
                Currents
              </button>
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingBox}>
              <div className={styles.pulseSpinner} />
              <span>Fetching NetCDF Profile...</span>
            </div>
          ) : (
            <RealDepthProfileChart
              variable={chartVar}
              modelProfile={modelProfile}
              argoProfile={argoProfile}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── INTERACTIVE REAL DEPTH PROFILE CHART COMPONENT ─────────────────────────────

function RealDepthProfileChart({
  variable,
  modelProfile,
  argoProfile,
}: {
  variable: 'temperature' | 'salinity' | 'chl' | 'currents';
  modelProfile: DepthProfile | null;
  argoProfile: ArgoProfile | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverData, setHoverData] = useState<{
    x: number;
    y: number;
    depth: number;
    modelVal: number | null;
    argoVal: number | null;
  } | null>(null);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pw = canvas.offsetWidth;
    const ph = canvas.offsetHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = pw * dpr;
    canvas.height = ph * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, pw, ph);
    ctx.fillStyle = '#091322';
    ctx.fillRect(0, 0, pw, ph);

    const padL = 50;
    const padR = 20;
    const padT = 20;
    const padB = 45;

    const chartW = pw - padL - padR;
    const chartH = ph - padT - padB;

    const modelDepths = modelProfile?.depth ?? [];
    const modelVals = modelProfile?.values ?? [];

    const argoDepths = argoProfile?.depth ?? [];
    const argoRawVals =
      variable === 'temperature'
        ? argoProfile?.temperature
        : variable === 'salinity'
        ? argoProfile?.salinity
        : variable === 'chl'
        ? argoProfile?.chlorophyll
        : null;

    // Pair each observed value WITH ITS EXACT CORRESPONDING DEPTH at the same array index
    const validArgoPts: { depth: number; val: number }[] = [];
    if (argoDepths.length > 0 && Array.isArray(argoRawVals)) {
      for (let i = 0; i < argoDepths.length; i++) {
        const d = argoDepths[i];
        const v = argoRawVals[i];
        if (d != null && !isNaN(d) && v != null && typeof v === 'number' && !isNaN(v)) {
          validArgoPts.push({ depth: d, val: v });
        }
      }
    }

    const hasModelData = modelDepths.length > 0 && modelVals.length > 0;
    const hasArgoData = validArgoPts.length > 0;

    if (!hasModelData && !hasArgoData) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No real depth profile cached for this location.', pw / 2, ph / 2);
      return;
    }

    const allVals = [
      ...(hasModelData ? modelVals : []),
      ...validArgoPts.map((p) => p.val),
    ];
    const allDepths = [
      ...(hasModelData ? modelDepths : []),
      ...validArgoPts.map((p) => p.depth),
    ];

    let minV = Math.min(...allVals);
    let maxV = Math.max(...allVals);
    if (minV === maxV) {
      minV -= 0.5;
      maxV += 0.5;
    }
    const maxD = Math.max(...allDepths, 10);

    // 1. Draw Y-Axis Header
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Depth (m)', 4, 12);

    // 2. Draw Horizontal Grid Lines & Y Ticks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(pw - padR, y);
      ctx.stroke();

      const dVal = Math.round((maxD / 4) * i);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`${dVal}`, 4, y + 3);
    }

    // 3. Draw Vertical Grid Lines & Bottom X Ticks
    ctx.textAlign = 'center';
    const numXTicks = 4;
    for (let i = 0; i <= numXTicks; i++) {
      const x = padL + (chartW / numXTicks) * i;
      const vVal = minV + ((maxV - minV) / numXTicks) * i;

      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + chartH);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(vVal.toFixed(1), x, padT + chartH + 14);
    }

    ctx.setLineDash([]);

    // 4. Draw X-Axis Title
    const unitLabelMap = {
      temperature: 'Temperature (°C)',
      salinity: 'Salinity (PSU)',
      chl: 'Chlorophyll (mg/m³)',
      currents: 'Current Speed (m/s)',
    };

    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(unitLabelMap[variable], padL + chartW / 2, padT + chartH + 30);

    // 5. Draw Model Gradient & Spline Curve
    if (hasModelData) {
      const points = modelVals.map((v, i) => ({
        x: padL + ((v - minV) / (maxV - minV)) * chartW,
        y: padT + (modelDepths[i] / maxD) * chartH,
      }));

      // Draw Gradient Area Under Line
      const grad = ctx.createLinearGradient(padL, 0, pw - padR, 0);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.22)');
      grad.addColorStop(1, 'rgba(0, 229, 255, 0.02)');

      ctx.beginPath();
      ctx.moveTo(padL, padT);
      points.forEach((pt, i) => {
        if (i === 0) ctx.lineTo(pt.x, pt.y);
        else {
          const xc = (points[i - 1].x + pt.x) / 2;
          const yc = (points[i - 1].y + pt.y) / 2;
          ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
        }
      });
      ctx.lineTo(points[points.length - 1].x, padT + chartH);
      ctx.lineTo(padL, padT + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Draw Glowing Model Spline Line
      ctx.beginPath();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 8;

      points.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else {
          const xc = (points[i - 1].x + pt.x) / 2;
          const yc = (points[i - 1].y + pt.y) / 2;
          ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
        }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 6. Draw Argo Observation Spline Curve (Orange) with Exact Depths
    if (hasArgoData) {
      const argoPts = validArgoPts.map((pt) => ({
        x: padL + ((pt.val - minV) / (maxV - minV)) * chartW,
        y: padT + (pt.depth / maxD) * chartH,
      }));

      ctx.beginPath();
      ctx.strokeStyle = '#ff7b3a';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.shadowColor = '#ff7b3a';
      ctx.shadowBlur = 6;

      argoPts.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else {
          const xc = (argoPts[i - 1].x + pt.x) / 2;
          const yc = (argoPts[i - 1].y + pt.y) / 2;
          ctx.quadraticCurveTo(argoPts[i - 1].x, argoPts[i - 1].y, xc, yc);
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Draw glowing observation dots
      argoPts.forEach((pt) => {
        ctx.fillStyle = '#ff7b3a';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 7. Interactive Hover Crosshairs
    if (hoverData && hasModelData) {
      const hY = hoverData.y;
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);

      // Horizontal depth line
      ctx.beginPath();
      ctx.moveTo(padL, hY);
      ctx.lineTo(pw - padR, hY);
      ctx.stroke();

      // Glowing dot at hover depth on model curve
      if (hoverData.modelVal !== null) {
        const hX = padL + ((hoverData.modelVal - minV) / (maxV - minV)) * chartW;
        ctx.beginPath();
        ctx.arc(hX, hY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#00e5ff';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.setLineDash([]);
    }

    // 8. Legend
    ctx.font = '10px monospace';
    if (hasModelData) {
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(padL, ph - 10, 12, 3);
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.fillText('Model', padL + 18, ph - 6);
    }

    if (hasArgoData) {
      ctx.fillStyle = '#ff7b3a';
      ctx.fillRect(padL + 80, ph - 10, 12, 3);
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.fillText('Observed', padL + 98, ph - 6);
    }
  }, [variable, modelProfile, argoProfile, hoverData]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !modelProfile?.depth?.length) return;
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const mouseX = e.clientX - rect.left;

    const padT = 20;
    const padB = 45;
    const chartH = canvas.offsetHeight - padT - padB;

    if (mouseY < padT || mouseY > padT + chartH) {
      setHoverData(null);
      return;
    }

    const maxD = modelProfile.depth[modelProfile.depth.length - 1];
    const hoverDepth = Math.round(((mouseY - padT) / chartH) * maxD);

    // Find closest index in modelProfile
    let closestIdx = 0;
    let minDiff = Infinity;
    modelProfile.depth.forEach((d, i) => {
      const diff = Math.abs(d - hoverDepth);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    });

    const targetD = modelProfile.depth[closestIdx];
    const argoMatch = argoProfile?.depth?.length && argoProfile.temperature?.length
      ? argoProfile.temperature[argoProfile.depth.findIndex((d) => Math.abs(d - targetD) < 25)] ?? null
      : null;

    setHoverData({
      x: mouseX,
      y: mouseY,
      depth: targetD,
      modelVal: modelProfile.values[closestIdx] ?? null,
      argoVal: argoMatch,
    });
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  const unitMap = {
    temperature: '°C',
    salinity: 'PSU',
    chl: 'mg/m³',
    currents: 'm/s',
  };

  return (
    <div style={{ width: '100%', height: '230px', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
      />
      {hoverData && (
        <div
          style={{
            position: 'absolute',
            top: `${Math.max(10, hoverData.y - 45)}px`,
            left: `${Math.min(180, hoverData.x + 10)}px`,
            background: 'rgba(10, 18, 30, 0.92)',
            border: '1px solid rgba(0, 229, 255, 0.4)',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#f8fafc',
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 10,
          }}
        >
          <div>Depth: <strong style={{ color: '#00e5ff' }}>{hoverData.depth} m</strong></div>
          {hoverData.modelVal !== null && (
            <div>Model: <strong style={{ color: '#00e5ff' }}>{hoverData.modelVal.toFixed(2)} {unitMap[variable]}</strong></div>
          )}
          {hoverData.argoVal !== null && (
            <div>Obs: <strong style={{ color: '#ff7b3a' }}>{hoverData.argoVal.toFixed(2)} {unitMap[variable]}</strong></div>
          )}
        </div>
      )}
    </div>
  );
}
