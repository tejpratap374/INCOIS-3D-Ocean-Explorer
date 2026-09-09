// Color scale utilities for scientific visualization

export type RGB = [number, number, number];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

// Scientifically-grounded colormaps as piecewise linear interpolations
const STOPS: Record<string, RGB[]> = {
  windy: [
    [0.08, 0.12, 0.35],
    [0.00, 0.55, 0.85],
    [0.00, 0.85, 0.85],
    [0.20, 0.90, 0.40],
    [0.90, 0.90, 0.10],
    [0.98, 0.45, 0.10],
    [0.90, 0.10, 0.45],
    [1.00, 0.95, 0.95],
  ],
  magma: [
    [0.05, 0.02, 0.20],
    [0.22, 0.05, 0.45],
    [0.45, 0.08, 0.60],
    [0.68, 0.15, 0.55],
    [0.85, 0.25, 0.45],
    [0.95, 0.45, 0.35],
    [0.98, 0.70, 0.40],
    [0.99, 0.90, 0.65],
  ],
  thermal: [
    [0.0, 0.0, 0.3],
    [0.1, 0.0, 0.5],
    [0.3, 0.0, 0.7],
    [0.5, 0.0, 0.9],
    [0.7, 0.4, 0.9],
    [0.85, 0.8, 0.5],
    [1.0, 1.0, 0.0],
  ],
  viridis: [
    [0.267, 0.005, 0.329],
    [0.282, 0.140, 0.458],
    [0.254, 0.265, 0.530],
    [0.207, 0.372, 0.553],
    [0.164, 0.471, 0.558],
    [0.128, 0.567, 0.551],
    [0.135, 0.659, 0.518],
    [0.267, 0.749, 0.441],
    [0.478, 0.821, 0.318],
    [0.741, 0.873, 0.150],
    [0.993, 0.906, 0.144],
  ],
  plasma: [
    [0.050, 0.030, 0.528],
    [0.275, 0.011, 0.629],
    [0.491, 0.012, 0.659],
    [0.659, 0.110, 0.586],
    [0.799, 0.196, 0.470],
    [0.901, 0.290, 0.348],
    [0.969, 0.418, 0.222],
    [0.992, 0.561, 0.094],
    [0.988, 0.700, 0.080],
    [0.940, 0.975, 0.131],
  ],
  inferno: [
    [0.001, 0.000, 0.014],
    [0.117, 0.040, 0.232],
    [0.290, 0.020, 0.397],
    [0.456, 0.033, 0.448],
    [0.612, 0.090, 0.430],
    [0.741, 0.149, 0.378],
    [0.848, 0.219, 0.297],
    [0.929, 0.317, 0.197],
    [0.978, 0.456, 0.103],
    [0.987, 0.620, 0.039],
    [0.988, 0.992, 0.149],
  ],
  haline: [
    [0.022, 0.027, 0.243],
    [0.039, 0.198, 0.439],
    [0.067, 0.359, 0.553],
    [0.184, 0.490, 0.604],
    [0.412, 0.580, 0.580],
    [0.671, 0.659, 0.529],
    [0.871, 0.749, 0.482],
    [0.953, 0.851, 0.502],
    [0.910, 0.953, 0.694],
    [0.745, 0.984, 0.929],
  ],
  balance: [
    [0.020, 0.188, 0.380],
    [0.180, 0.380, 0.580],
    [0.420, 0.580, 0.690],
    [0.690, 0.745, 0.749],
    [0.890, 0.890, 0.890],
    [0.937, 0.749, 0.580],
    [0.890, 0.510, 0.380],
    [0.749, 0.270, 0.180],
    [0.580, 0.082, 0.082],
  ],
  algae: [
    [0.027, 0.106, 0.043],
    [0.063, 0.247, 0.122],
    [0.106, 0.396, 0.169],
    [0.184, 0.529, 0.184],
    [0.337, 0.659, 0.231],
    [0.553, 0.769, 0.337],
    [0.769, 0.871, 0.490],
    [0.910, 0.945, 0.682],
    [0.984, 0.984, 0.871],
  ],
  turbo: [
    [0.18995, 0.07176, 0.23217],
    [0.21616, 0.15418, 0.39313],
    [0.24452, 0.22777, 0.51053],
    [0.26930, 0.30115, 0.61041],
    [0.28593, 0.37721, 0.68804],
    [0.29107, 0.45744, 0.74562],
    [0.28043, 0.54060, 0.78320],
    [0.25326, 0.62483, 0.79887],
    [0.21516, 0.70913, 0.79067],
    [0.17313, 0.79091, 0.75868],
    [0.13915, 0.86608, 0.70556],
    [0.12217, 0.93100, 0.63718],
    [0.15838, 0.98318, 0.56118],
    [0.25245, 1.01867, 0.48306],
    [0.36102, 1.03465, 0.40814],
    [0.47781, 1.02921, 0.33341],
    [0.60140, 1.00495, 0.25721],
    [0.73109, 0.96217, 0.18073],
    [0.86616, 0.90113, 0.10747],
    [0.97681, 0.76971, 0.03616],
    [0.97659, 0.61982, 0.01650],
    [0.95242, 0.47015, 0.01542],
    [0.92168, 0.33454, 0.01872],
    [0.88928, 0.21719, 0.02136],
    [0.85423, 0.12268, 0.02332],
    [0.81690, 0.05776, 0.02458],
  ],
  coolwarm: [
    [0.023, 0.299, 0.754],  // deep blue
    [0.150, 0.400, 0.845],
    [0.224, 0.491, 0.884],
    [0.301, 0.574, 0.906],
    [0.382, 0.649, 0.912],
    [0.466, 0.717, 0.906],
    [0.551, 0.778, 0.887],
    [0.631, 0.829, 0.854],
    [0.706, 0.871, 0.808],
    [0.775, 0.904, 0.750],
    [0.838, 0.929, 0.683],
    [0.894, 0.945, 0.608],
    [0.941, 0.953, 0.525],
    [0.976, 0.952, 0.436],
    [0.994, 0.942, 0.343],
    [0.998, 0.923, 0.251],
    [0.997, 0.894, 0.161],
    [0.992, 0.856, 0.083],
    [0.981, 0.808, 0.021],
  ],
  ocean: [
    [0.0, 0.0, 0.3],       // dark blue
    [0.0, 0.0, 0.5],
    [0.0, 0.0, 0.7],
    [0.0, 0.3, 0.8],
    [0.0, 0.5, 0.9],
    [0.0, 0.7, 0.95],
    [0.0, 0.8, 0.9],
    [0.0, 0.9, 0.8],
    [0.0, 1.0, 0.7],
    [0.2, 1.0, 0.6],
    [0.4, 1.0, 0.5],
    [0.6, 1.0, 0.4],
    [0.8, 1.0, 0.3],
    [1.0, 1.0, 0.2],
  ],
};

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

export function colorFor(value: number, vmin: number, vmax: number, palette: ColorPalette, reverse = false, scale: 'linear' | 'log' = 'linear'): RGB {
  const stops = STOPS[palette] || STOPS.viridis;
  let t: number;
  if (vmin === vmax) t = 0.5;
  else if (scale === 'log') {
    const lv = Math.log(Math.max(value, 1e-6));
    const lmin = Math.log(Math.max(vmin, 1e-6));
    const lmax = Math.log(Math.max(vmax, 1e-6));
    t = (lv - lmin) / (lmax - lmin);
  } else {
    t = (value - vmin) / (vmax - vmin);
  }
  t = Math.max(0, Math.min(1, t));
  if (reverse) t = 1 - t;

  const n = stops.length - 1;
  const idx = Math.min(Math.floor(t * n), n - 1);
  const localT = t * n - idx;
  return lerpRGB(stops[idx], stops[idx + 1], localT);
}

export function rgbToCss([r, g, b]: RGB, alpha = 1): string {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

export function colorStopsFor(palette: ColorPalette, steps = 32, reverse = false): string {
  const stops: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const [r, g, b] = colorFor(t, 0, 1, palette, reverse, 'linear');
    stops.push(rgbToCss([r, g, b]));
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export const PALETTES: Array<{ id: ColorPalette; name: string; description: string }> = [
  { id: 'windy', name: 'Windy Waves', description: 'Windy.com Waves & Currents' },
  { id: 'magma', name: 'Magma', description: 'Deep purple → Magenta → Coral' },
  { id: 'thermal', name: 'Thermal', description: 'Blue → Red → Yellow' },
  { id: 'viridis', name: 'Viridis', description: 'Perceptually uniform' },
  { id: 'plasma', name: 'Plasma', description: 'High contrast' },
  { id: 'inferno', name: 'Inferno', description: 'Black → Red → Yellow' },
  { id: 'haline', name: 'Haline', description: 'Salinity scale' },
  { id: 'balance', name: 'Cool-Warm', description: 'Diverging scale' },
  { id: 'algae', name: 'Algae', description: 'Chlorophyll scale' },
  { id: 'turbo', name: 'Turbo', description: 'Google Turbo - high contrast' },
  { id: 'coolwarm', name: 'Cool-Warm', description: 'Diverging (matplotlib)' },
  { id: 'ocean', name: 'Ocean', description: 'Oceanographic standard' },
];
