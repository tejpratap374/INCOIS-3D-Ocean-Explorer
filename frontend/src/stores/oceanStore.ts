import { create } from 'zustand';
import type { OceanField, VectorField, ArgoFloat, GliderTrack, ColorPalette, VisualizationMode, VolumeData } from '@/types';

interface WeatherData {
  region: string;
  location: string;
  coordinates: { lat: number; lon: number };
  temperature_c: number;
  temperature_f: number;
  condition: string;
  humidity: number;
  wind_kph: number;
  wind_dir: string;
  feels_like_c: number;
  icon: string;
  observation_time: string;
}

interface OceanState {
  // Dataset selection
  dataset: string;
  setDataset: (id: string) => void;

  // Variable
  variable: string;
  setVariable: (v: string) => void;

  // Depth (meters)
  depth: number;
  setDepth: (d: number) => void;

  // Time
  currentTime: string;
  setCurrentTime: (t: string) => void;
  availableTimes: string[];
  setAvailableTimes: (t: string[]) => void;

  // Time Range & Time Steps
  rangeStart: string | null;
  rangeEnd: string | null;
  setRangeStart: (t: string | null) => void;
  setRangeEnd: (t: string | null) => void;
  timeStart: string;
  timeEnd: string;
  timeStepInterval: number;
  timeSteps: string[];
  setTimeStart: (t: string) => void;
  setTimeEnd: (t: string) => void;
  setTimeStepInterval: (m: number) => void;
  setTimeSteps: (steps: string[]) => void;
  clearTimeSteps: () => void;

  // Visualization mode
  vizMode: VisualizationMode;
  setVizMode: (m: VisualizationMode) => void;
  isosurfaceValue: number;
  setIsosurfaceValue: (v: number) => void;

  // Colorbar
  palette: ColorPalette;
  setPalette: (p: ColorPalette) => void;
  vmin: number | null;
  vmax: number | null;
  setVmin: (v: number | null) => void;
  setVmax: (v: number | null) => void;
  reverseScale: boolean;
  setReverseScale: (r: boolean) => void;
  scale: 'linear' | 'log';
  setScale: (s: 'linear' | 'log') => void;
  opacity: number;
  setOpacity: (o: number) => void;

  // Vertical exaggeration
  verticalExaggeration: number;
  setVerticalExaggeration: (v: number) => void;

  // Camera
  cameraPreset: 'perspective' | 'top' | 'side' | 'india' | 'global';
  setCameraPreset: (p: 'perspective' | 'top' | 'side' | 'india' | 'global') => void;

  // Data
  field: OceanField | null;
  setField: (f: OceanField) => void;
  vectorField: VectorField | null;
  setVectorField: (v: VectorField | null) => void;
  volumeData: VolumeData | null;
  setVolumeData: (v: VolumeData | null) => void;
  volumeLoading: boolean;
  setVolumeLoading: (l: boolean) => void;
  isLoading: boolean;
  setLoading: (l: boolean) => void;
  error: string | null;
  setError: (e: string | null) => void;

  // Layers
  showModelLayer: boolean;
  setShowModelLayer: (s: boolean) => void;
  showArgoLayer: boolean;
  setShowArgoLayer: (s: boolean) => void;
  showGliderLayer: boolean;
  setShowGliderLayer: (s: boolean) => void;
  showHFRadar: boolean;
  setShowHFRadar: (s: boolean) => void;
  showADCP: boolean;
  setShowADCP: (s: boolean) => void;
  showCurrents: boolean;
  setShowCurrents: (s: boolean) => void;
  showParticles: boolean;
  setShowParticles: (s: boolean) => void;
  showCoastline: boolean;
  setShowCoastline: (s: boolean) => void;
  showLandMasses: boolean;
  setShowLandMasses: (s: boolean) => void;
  showAtmosphere: boolean;
  setShowAtmosphere: (s: boolean) => void;

  // Observations
  argoFloats: ArgoFloat[];
  setArgoFloats: (f: ArgoFloat[]) => void;
  selectedArgoId: string | null;
  setSelectedArgoId: (id: string | null) => void;
  gliderTracks: GliderTrack[];
  setGliderTracks: (t: GliderTrack[]) => void;
  selectedGliderId: string | null;
  setSelectedGliderId: (id: string | null) => void;

  // Playback
  isPlaying: boolean;
  setPlaying: (p: boolean) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (s: number) => void;

  // UI
  leftPanelOpen: boolean;
  setLeftPanelOpen: (b: boolean) => void;
  rightPanelOpen: boolean;
  setRightPanelOpen: (b: boolean) => void;
  bottomPanelOpen: boolean;
  setBottomPanelOpen: (b: boolean) => void;
  variableBarOpen: boolean;
  setVariableBarOpen: (b: boolean) => void;
  timeBarOpen: boolean;
  setTimeBarOpen: (b: boolean) => void;
  detailPanelOpen: boolean;
  setDetailPanelOpen: (b: boolean) => void;
  leftPanelWidth: number;
  setLeftPanelWidth: (n: number) => void;
  rightPanelWidth: number;
  setRightPanelWidth: (n: number) => void;

  // Click probe / profile
  probeLocation: { lat: number; lon: number } | null;
  setProbeLocation: (loc: { lat: number; lon: number } | null) => void;
  profileLoading: boolean;
  setProfileLoading: (l: boolean) => void;

  // Region
  currentRegion: string;
  setCurrentRegion: (r: string) => void;

  // Weather
  weather: WeatherData | null;
  setWeather: (w: WeatherData | null) => void;
  weatherLoading: boolean;
  setWeatherLoading: (b: boolean) => void;
  weatherError: string | null;
  setWeatherError: (e: string | null) => void;
  fetchWeather: (region: string) => Promise<void>;
}

export const useOceanStore = create<OceanState>((set, get) => ({
  dataset: 'incois_roms_io',
  setDataset: (id) => set({ dataset: id }),

  variable: 'temperature',
  setVariable: (v) => set({ variable: v, vmin: null, vmax: null }),

  depth: 0,
  setDepth: (d) => set({ depth: d }),

  currentTime: new Date().toISOString(),
  setCurrentTime: (t) => set({ currentTime: t }),
  availableTimes: [],
  setAvailableTimes: (t) => set({ availableTimes: t }),

  rangeStart: null,
  rangeEnd: null,
  setRangeStart: (t) => set({ rangeStart: t }),
  setRangeEnd: (t) => set({ rangeEnd: t }),

  timeStart: new Date(Date.now() - 7 * 86400000).toISOString(),
  timeEnd: new Date().toISOString(),
  timeStepInterval: 360, // 6 hours
  timeSteps: [],
  setTimeStart: (t) => set({ timeStart: t }),
  setTimeEnd: (t) => set({ timeEnd: t }),
  setTimeStepInterval: (m) => set({ timeStepInterval: m }),
  setTimeSteps: (steps) => set({ timeSteps: steps }),
  clearTimeSteps: () => set({ timeSteps: [] }),

  vizMode: 'surface',
  setVizMode: (m) => set({ vizMode: m }),
  isosurfaceValue: 20.0,
  setIsosurfaceValue: (v) => set({ isosurfaceValue: v }),

  palette: 'windy',
  setPalette: (p) => set({ palette: p }),
  vmin: null,
  vmax: null,
  setVmin: (v) => set({ vmin: v }),
  setVmax: (v) => set({ vmax: v }),
  reverseScale: false,
  setReverseScale: (r) => set({ reverseScale: r }),
  scale: 'linear',
  setScale: (s) => set({ scale: s }),
  opacity: 0.95,
  setOpacity: (o) => set({ opacity: o }),

  verticalExaggeration: 2.0,
  setVerticalExaggeration: (v) => set({ verticalExaggeration: v }),

  cameraPreset: 'perspective',
  setCameraPreset: (p) => set({ cameraPreset: p }),

  field: null,
  setField: (f) => set({ field: f }),
  vectorField: null,
  setVectorField: (v) => set({ vectorField: v }),
  volumeData: null,
  setVolumeData: (v) => set({ volumeData: v }),
  volumeLoading: false,
  setVolumeLoading: (l) => set({ volumeLoading: l }),
  isLoading: false,
  setLoading: (l) => set({ isLoading: l }),
  error: null,
  setError: (e) => set({ error: e }),

  showModelLayer: true,
  setShowModelLayer: (s) => set({ showModelLayer: s }),
  showArgoLayer: true,
  setShowArgoLayer: (s) => set({ showArgoLayer: s }),
  showGliderLayer: true,
  setShowGliderLayer: (s) => set({ showGliderLayer: s }),
  showHFRadar: true,
  setShowHFRadar: (s) => set({ showHFRadar: s }),
  showADCP: true,
  setShowADCP: (s) => set({ showADCP: s }),
  showCurrents: true,
  setShowCurrents: (s) => set({ showCurrents: s }),
  showParticles: true,
  setShowParticles: (s) => set({ showParticles: s }),
  showCoastline: true,
  setShowCoastline: (s) => set({ showCoastline: s }),
  showLandMasses: true,
  setShowLandMasses: (s) => set({ showLandMasses: s }),
  showAtmosphere: true,
  setShowAtmosphere: (s) => set({ showAtmosphere: s }),

  argoFloats: [],
  setArgoFloats: (f) => set({ argoFloats: f }),
  selectedArgoId: null,
  setSelectedArgoId: (id) => set({ selectedArgoId: id }),
  gliderTracks: [],
  setGliderTracks: (t) => set({ gliderTracks: t }),
  selectedGliderId: null,
  setSelectedGliderId: (id) => set({ selectedGliderId: id }),

  isPlaying: false,
  setPlaying: (p) => set({ isPlaying: p }),
  playbackSpeed: 1.0,
  setPlaybackSpeed: (s) => set({ playbackSpeed: s }),

  leftPanelOpen: true,
  setLeftPanelOpen: (b) => set({ leftPanelOpen: b }),
  rightPanelOpen: true,
  setRightPanelOpen: (b) => set({ rightPanelOpen: b }),
  bottomPanelOpen: true,
  setBottomPanelOpen: (b) => set({ bottomPanelOpen: b }),
  variableBarOpen: true,
  setVariableBarOpen: (b) => set({ variableBarOpen: b }),
  timeBarOpen: true,
  setTimeBarOpen: (b) => set({ timeBarOpen: b }),
  detailPanelOpen: false,
  setDetailPanelOpen: (b: boolean) => set({ detailPanelOpen: b }),
  leftPanelWidth: 300,
  setLeftPanelWidth: (n) => set({ leftPanelWidth: Math.min(480, Math.max(220, n)) }),
  rightPanelWidth: 300,
  setRightPanelWidth: (n) => set({ rightPanelWidth: Math.min(480, Math.max(220, n)) }),


  probeLocation: null,
  setProbeLocation: (loc) => set({ probeLocation: loc }),
  profileLoading: false,
  setProfileLoading: (l) => set({ profileLoading: l }),

  currentRegion: 'indian_ocean',
  setCurrentRegion: (r) => set({ currentRegion: r }),

  // Weather
  weather: null,
  setWeather: (w) => set({ weather: w }),
  weatherLoading: false,
  setWeatherLoading: (b) => set({ weatherLoading: b }),
  weatherError: null,
  setWeatherError: (e) => set({ weatherError: e }),
  fetchWeather: async (region: string) => {
    set({ weatherLoading: true, weatherError: null });
    try {
      const response = await fetch(`/api/weather?region=${encodeURIComponent(region)}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch weather' }));
        throw new Error(error.detail || 'Weather fetch failed');
      }
      const data = await response.json();
      set({ weather: data, weatherLoading: false });
    } catch (error) {
      set({ weatherError: error instanceof Error ? error.message : 'Unknown error', weatherLoading: false, weather: null });
    }
  },
}));