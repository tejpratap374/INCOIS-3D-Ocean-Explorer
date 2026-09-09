import axios from 'axios';
import type {
  Dataset,
  VariableInfo,
  OceanField,
  DepthProfile,
  TimeSeries,
  ComparisonResult,
  VectorField,
  ArgoFloat,
  ArgoProfile,
  GliderTrack,
  VolumeData,
  VerticalTransectData,
} from '@/types';

export interface Region {
  id: string;
  name: string;
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
}

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.response.use(
  (r) => r,
  (err) => {
    console.error('[API]', err?.response?.status, err?.config?.url, err?.message);
    return Promise.reject(err);
  }
);

// ----- Datasets -----
export const datasetsApi = {
  list: async (): Promise<Dataset[]> => {
    const r = await client.get<Dataset[] | { datasets: Dataset[] } | { items: Dataset[] }>('/datasets');
    const data = r.data as any;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.datasets)) return data.datasets;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  },
  get: async (id: string): Promise<Dataset> => {
    const r = await client.get<Dataset>(`/datasets/${id}`);
    return r.data;
  },
  variables: async (id: string): Promise<{ dataset_id: string; variables: VariableInfo[] }> => {
    const r = await client.get(`/datasets/${id}/variables`);
    return r.data;
  },
  times: async (id: string): Promise<{ dataset_id: string; times: string[] }> => {
    const r = await client.get(`/datasets/${id}/times`);
    return r.data;
  },
  depths: async (id: string): Promise<{ dataset_id: string; depths: number[]; min: number; max: number }> => {
    const r = await client.get(`/datasets/${id}/depths`);
    return r.data;
  },
  regions: async (): Promise<Region[]> => {
    const r = await client.get<Region[]>('/regions');
    return r.data;
  },
};

// In-memory response cache for smooth time-step animation playback
const fieldCache = new Map<string, Promise<OceanField>>();
const volumeCache = new Map<string, Promise<VolumeData>>();
const verticalCache = new Map<string, Promise<VerticalTransectData>>();
const vectorCache = new Map<string, Promise<VectorField>>();

function getCacheKey(prefix: string, params: any): string {
  return `${prefix}:${JSON.stringify(params)}`;
}

// ----- Data fields -----
export const dataApi = {
  getField: async (params: {
    dataset?: string;
    variable: string;
    time?: string;
    depth?: number;
    region?: string;
    lat_min?: number;
    lat_max?: number;
    lon_min?: number;
    lon_max?: number;
    resolution?: number;
  }): Promise<OceanField> => {
    const key = getCacheKey('field', params);
    if (fieldCache.has(key)) {
      return fieldCache.get(key)!;
    }
    const promise = client.get<OceanField>('/data', { params }).then((r) => r.data);
    fieldCache.set(key, promise);
    return promise;
  },

  getVolume: async (params: {
    dataset_id: string;
    variable: string;
    time?: string;
    lat_min: number;
    lat_max: number;
    lon_min: number;
    lon_max: number;
    depth_min?: number;
    depth_max?: number;
    depth_levels?: number;
  }): Promise<VolumeData> => {
    const key = getCacheKey('volume', params);
    if (volumeCache.has(key)) {
      return volumeCache.get(key)!;
    }
    const promise = client.post<VolumeData>('/data/query', params).then((r) => r.data);
    volumeCache.set(key, promise);
    return promise;
  },

  getVerticalTransect: async (params: {
    dataset_id: string;
    variable: string;
    time?: string;
    axis: 'lat' | 'lon';
    fixed_value: number;
    traverse_min: number;
    traverse_max: number;
    depth_min?: number;
    depth_max?: number;
    depth_levels?: number;
    traverse_points?: number;
  }): Promise<VerticalTransectData> => {
    const key = getCacheKey('vertical', params);
    if (verticalCache.has(key)) {
      return verticalCache.get(key)!;
    }
    const promise = client.get<VerticalTransectData>('/data/vertical', { params }).then((r) => r.data);
    verticalCache.set(key, promise);
    return promise;
  },
  getProfile: async (params: { variable: string; time?: string; latitude: number; longitude: number }): Promise<DepthProfile> => {
    const r = await client.get<DepthProfile>('/profile', { params });
    return r.data;
  },
  getTimeSeries: async (params: {
    variable: string;
    latitude: number;
    longitude: number;
    depth: number;
    start?: string;
    end?: string;
    steps?: number;
  }): Promise<TimeSeries> => {
    const r = await client.get<TimeSeries>('/timeseries', { params });
    return r.data;
  },
  getVectors: async (params: {
    time?: string;
    depth?: number;
    lat_min?: number;
    lat_max?: number;
    lon_min?: number;
    lon_max?: number;
    spacing?: number;
    region?: string;
  }): Promise<VectorField> => {
    const key = getCacheKey('vector', params);
    if (vectorCache.has(key)) {
      return vectorCache.get(key)!;
    }
    const promise = client.get<VectorField>('/vectors', { params }).then((r) => r.data);
    vectorCache.set(key, promise);
    return promise;
  },
  preloadFrames: async (paramsList: Array<{ fieldParams: any; vectorParams?: any }>) => {
    for (const p of paramsList) {
      if (p.fieldParams) {
        dataApi.getField(p.fieldParams).catch(() => {});
      }
      if (p.vectorParams) {
        dataApi.getVectors(p.vectorParams).catch(() => {});
      }
    }
  },
};

// ----- Observations -----
export const observationsApi = {
  getArgo: async (params: {
    lat_min?: number;
    lat_max?: number;
    lon_min?: number;
    lon_max?: number;
    status?: string;
    limit?: number;
  }): Promise<{ count: number; total: number; floats: ArgoFloat[] }> => {
    const r = await client.get('/observations/argo', { params });
    return r.data;
  },
  getArgoFloat: async (id: string): Promise<ArgoFloat> => {
    const r = await client.get<ArgoFloat>(`/observations/argo/${id}`);
    return r.data;
  },
  getArgoProfile: async (id: string, profile?: number): Promise<ArgoProfile> => {
    const r = await client.get<ArgoProfile>(`/observations/argo/${id}/profile`, { params: { profile } });
    return r.data;
  },
  getGliders: async (params: {
    lat_min?: number;
    lat_max?: number;
    lon_min?: number;
    lon_max?: number;
  }): Promise<{ count: number; tracks: GliderTrack[] }> => {
    const r = await client.get('/observations/gliders', { params });
    return r.data;
  },
  getGlider: async (id: string): Promise<GliderTrack> => {
    const r = await client.get<GliderTrack>(`/observations/gliders/${id}`);
    return r.data;
  },
  getStatus: async () => {
    const r = await client.get('/observations/status');
    return r.data;
  },
};

// ----- Analysis -----
export const analysisApi = {
  compare: async (params: {
    dataset?: string;
    variable?: string;
    time?: string;
    depth_min?: number;
    depth_max?: number;
    lat_min?: number;
    lat_max?: number;
    lon_min?: number;
    lon_max?: number;
  }): Promise<ComparisonResult> => {
    const r = await client.get<ComparisonResult>('/comparison', { params });
    return r.data;
  },
};

// ----- System -----
export const systemApi = {
  health: async () => {
    const r = await client.get('/health');
    return r.data;
  },
  metadata: async () => {
    const r = await client.get('/metadata');
    return r.data;
  },
  status: async () => {
    const r = await client.get('/system/status');
    return r.data;
  },
};

export default client;
