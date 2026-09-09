// Core types for the INCOIS Ocean Explorer

export interface Dataset {
  id: string;
  name: string;
  description: string;
  type: string;
  format: string;
  source: string;
  license: string;
  spatial_coverage: {
    lat_min: number;
    lat_max: number;
    lon_min: number;
    lon_max: number;
  };
  temporal_coverage: {
    start: string;
    end: string;
  };
  depth_coverage?: {
    min: number;
    max: number;
    levels: number[];
  };
  variables: string[];
  is_synthetic: boolean;
  status: string;
}

export interface VariableInfo {
  id: string;
  name: string;
  unit: string;
  valid_range: [number, number] | null;
  colormap: string;
}

export interface OceanField {
  variable: string;
  unit: string;
  time: string;
  depth: number | null;
  min_value: number;
  max_value: number;
  mean_value: number;
  latitude: number[];
  longitude: number[];
  data: number[][];
  is_synthetic: boolean;
  data_exists?: boolean;
  region_id?: string;
  coverage?: {
    lat_min: number;
    lat_max: number;
    lon_min: number;
    lon_max: number;
  };
}

export interface VolumeData {
  dataset_id: string;
  variable: string;
  units: string;
  time: string[];
  depth: number[];
  lat: number[];
  lon: number[];
  data: number[][][]; // [time][depth][space]
  valid_range: [number, number];
  is_synthetic: boolean;
  source: string;
}

export interface VerticalTransectData {
  dataset_id: string;
  variable: string;
  units: string;
  time: string;
  depth: number[];
  traverse_axis: string;
  traverse_coords: number[];
  fixed_axis: string;
  fixed_value: number;
  data: number[][]; // [depth][traverse]
  valid_range: [number, number];
  is_synthetic: boolean;
  source: string;
}

export interface ArgoFloat {
  float_id: string;
  wmo_number: number | null;
  latitude: number;
  longitude: number;
  last_timestamp: string;
  status: 'active' | 'inactive' | 'unknown';
  profile_count: number;
  variables: string[];
  cycle_number: number;
  depth_max: number;
  last_depth: number | null;
  last_lat: number | null;
  last_lon: number | null;
  position_str?: string;
}

export interface ArgoProfile {
  float_id: string;
  profile_number: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  depth: number[];
  temperature: number[] | null;
  salinity: number[] | null;
  chlorophyll: number[] | null;
  pressure: number[] | null;
}

export interface GliderTrack {
  glider_id: string;
  mission_id: string | null;
  name: string;
  start_time: string;
  end_time: string;
  observations: GliderObservation[];
  variables: string[];
  total_observations?: number;
  duration_hours?: number;
}

export interface GliderObservation {
  glider_id: string;
  mission_id: string | null;
  timestamp: string;
  latitude: number;
  longitude: number;
  depth: number;
  temperature: number | null;
  salinity: number | null;
  chlorophyll: number | null;
}

export interface DepthProfile {
  variable: string;
  unit: string;
  depth: number[];
  values: number[];
  latitude: number;
  longitude: number;
  time: string;
  is_synthetic: boolean;
}

export interface TimeSeries {
  variable: string;
  unit: string;
  latitude: number;
  longitude: number;
  depth: number;
  points: { time: string; value: number }[];
  is_synthetic: boolean;
}

export interface ComparisonResult {
  variable: string;
  depth_min: number;
  depth_max: number;
  time: string;
  sample_count: number;
  mean_bias: number;
  rmse: number;
  mae: number;
  min_diff: number;
  max_diff: number;
  correlation: number | null;
  model_values: number[];
  observation_values: number[];
  observation_latitudes: number[];
  observation_longitudes: number[];
}

export interface VectorPoint {
  lat: number;
  lon: number;
  u: number;
  v: number;
  speed: number;
}

export interface VectorField {
  time: string;
  depth: number | null;
  count: number;
  vectors: VectorPoint[];
}

export type VisualizationMode = '3d_volume' | 'depth_slice' | 'surface' | 'vectors' | 'particles' | 'isosurface';
export type ColorPalette =
  | 'windy'
  | 'magma'
  | 'thermal'
  | 'viridis'
  | 'plasma'
  | 'inferno'
  | 'haline'
  | 'balance'
  | 'algae'
  | 'turbo'
  | 'coolwarm'
  | 'ocean';
export type ColorScale = 'linear' | 'log';
