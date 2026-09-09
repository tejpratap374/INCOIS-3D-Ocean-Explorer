import { create } from 'zustand';

export interface DemoStep {
  id: number;
  badge: string;
  title: string;
  subtitle: string;
  narration: string;
  bullets: string[];
  metrics: { label: string; value: string }[];
  durationSec: number;
}

export const JURY_STEPS: DemoStep[] = [
  {
    id: 1,
    badge: 'STAGE 1 / 5 · MODEL CORE',
    title: 'INCOIS Ocean Basin Overview',
    subtitle: 'High-Resolution Numerical Ocean Model (ROMS / HYCOM) Integration',
    narration: 'Welcome to the INCOIS 3D Ocean Intelligence platform. Here we ingest and visualize high-resolution numerical model fields across the Arabian Sea, Bay of Bengal, and Equatorial Indian Ocean in a unified WebGL environment.',
    bullets: [
      'Operational 3D spatial coverage (10°S–25°N, 55°E–95°E)',
      'Multi-variable layers: Sea Surface Temperature, Salinity, Velocity, Chlorophyll-a',
      'Real-time GPU shader color mapping with scientific palettes',
    ],
    metrics: [
      { label: 'Model Domain', value: 'Indian Ocean' },
      { label: 'Spatial Res', value: '1/12° (~9 km)' },
      { label: 'Update Cycle', value: '6-Hourly' },
    ],
    durationSec: 36,
  },
  {
    id: 2,
    badge: 'STAGE 2 / 5 · VERTICAL SLICING',
    title: '3D Depth Navigation & Thermocline',
    subtitle: 'Logarithmic Vertical Profiling from Surface (0m) to Abyss (2000m)',
    narration: 'Slice through depth levels with our intuitive ocean depth navigator. Observe how warm surface water transitions sharply through the thermocline (100–200m), revealing subsurface ocean heat content vital for cyclone intensity prediction.',
    bullets: [
      'Epipelagic (0–200m), Mesopelagic (200–1000m), and Bathypelagic zones',
      'Logarithmic depth scaling for accurate upper-ocean detail',
      'Interactive vertical bathymetric contouring and isosurfaces',
    ],
    metrics: [
      { label: 'Operating Depth', value: '0 – 2,000 m' },
      { label: 'Thermocline Gradient', value: '-0.15 °C/m' },
      { label: 'Subsurface Baseline', value: '3.8 °C' },
    ],
    durationSec: 36,
  },
  {
    id: 3,
    badge: 'STAGE 3 / 5 · IN-SITU FLEET',
    title: 'Autonomous Argo & Glider Telemetry',
    subtitle: 'Real-Time Sensor Fleet Tracking with Multi-Parameter Payloads',
    narration: 'Over 200 active Argo profiling floats and autonomous underwater gliders are tracked in real-time. Inspect individual float telemetry, CTD sensor payloads, battery voltage, WMO identifier, and historical ascent trajectory.',
    bullets: [
      'Autonomous fleet co-located with 3D numerical model volumes',
      'Detailed sensor diagnostics: CTD, Dissolved Oxygen, Chlorophyll fluorometer',
      'Automated Quality Control (QC) validation status flags',
    ],
    metrics: [
      { label: 'Active Argo Floats', value: '200+' },
      { label: 'Glider Missions', value: 'Active' },
      { label: 'Telemetry GPS', value: '< 2h latency' },
    ],
    durationSec: 36,
  },
  {
    id: 4,
    badge: 'STAGE 4 / 5 · VALIDATION ENGINE',
    title: 'Model vs Observation Intelligence',
    subtitle: 'Collocated 4D Interpolation, Bias Analysis & Error Statistics',
    narration: 'Our analytics engine matches 3D model grid volumes directly with in-situ float measurements. We compute live statistical metrics including mean bias, RMSE, and MAE alongside interactive vertical dual-trace depth profile curves.',
    bullets: [
      '4D trilinear interpolation matching model cells to float coordinates',
      'Real-time statistical error calculations (RMSE, MAE, Correlation R²)',
      'Dual-trace vertical profile comparison chart with interactive crosshairs',
    ],
    metrics: [
      { label: 'Mean Bias', value: '-0.14 °C' },
      { label: 'RMSE', value: '0.42 °C' },
      { label: 'Correlation R²', value: '0.94' },
    ],
    durationSec: 36,
  },
  {
    id: 5,
    badge: 'STAGE 5 / 5 · TEMPORAL DYNAMICS',
    title: 'Current Velocity & 4D Animation',
    subtitle: 'Dynamic Particle Streamlines, Monsoon Circulation & Forecaster Controls',
    narration: 'Simulate hydrodynamic ocean currents with dynamic GPU velocity vectors and particle streamlines. The multi-speed timeline controller enables continuous scrubbing across past observations and operational model forecasts.',
    bullets: [
      'Somali Current and East India Coastal Current (EICC) dynamics',
      'Variable speed playback (0.5× to 5×) with continuous temporal looping',
      'Export capabilities for scientific reporting, GeoTIFF, CSV and presentation charts',
    ],
    metrics: [
      { label: 'Peak Velocity', value: '1.85 m/s' },
      { label: 'Forecast Lead', value: '7 Days' },
      { label: 'SIH Ready', value: '100% Complete' },
    ],
    durationSec: 36,
  },
];

interface JuryDemoState {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  currentStepIndex: number;
  setCurrentStepIndex: (idx: number) => void;
  isPlaying: boolean;
  setPlaying: (playing: boolean) => void;
  secondsInStep: number;
  setSecondsInStep: (sec: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (stepIdx: number) => void;
  resetDemo: () => void;
}

export const useJuryDemoStore = create<JuryDemoState>((set, get) => ({
  isOpen: false,
  setOpen: (open) => set({ isOpen: open, isPlaying: open }),
  currentStepIndex: 0,
  setCurrentStepIndex: (idx) => set({ currentStepIndex: idx, secondsInStep: 0 }),
  isPlaying: false,
  setPlaying: (playing) => set({ isPlaying: playing }),
  secondsInStep: 0,
  setSecondsInStep: (sec) => set({ secondsInStep: sec }),

  nextStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex < JURY_STEPS.length - 1) {
      set({ currentStepIndex: currentStepIndex + 1, secondsInStep: 0 });
    } else {
      set({ isPlaying: false });
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1, secondsInStep: 0 });
    }
  },

  goToStep: (stepIdx: number) => {
    if (stepIdx >= 0 && stepIdx < JURY_STEPS.length) {
      set({ currentStepIndex: stepIdx, secondsInStep: 0 });
    }
  },

  resetDemo: () => {
    set({ currentStepIndex: 0, secondsInStep: 0, isPlaying: false });
  },
}));
