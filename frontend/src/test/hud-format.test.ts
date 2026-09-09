import { describe, it, expect } from 'vitest';
import { formatRegionBounds, formatLat, formatLon } from '@/config/regions';

describe('formatRegionBounds', () => {
  it('formats Indian Ocean correctly (S→N, E→E)', () => {
    expect(formatRegionBounds({ minLat: -5, maxLat: 25, minLon: 55, maxLon: 100 }))
      .toBe('55°E–100°E · 5°S–25°N');
  });

  it('formats Somali Jet correctly', () => {
    expect(formatRegionBounds({ minLat: -5, maxLat: 20, minLon: 45, maxLon: 78 }))
      .toBe('45°E–78°E · 5°S–20°N');
  });

  it('formats Equatorial Jet correctly', () => {
    expect(formatRegionBounds({ minLat: -5, maxLat: 10, minLon: 50, maxLon: 100 }))
      .toBe('50°E–100°E · 5°S–10°N');
  });

  it('formats Whole World', () => {
    expect(formatRegionBounds({ minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 }))
      .toBe('180°W–180°E · 90°S–90°N');
  });

  it('formats Atlantic with W longitudes', () => {
    expect(formatRegionBounds({ minLat: -40, maxLat: 65, minLon: -75, maxLon: 5 }))
      .toBe('75°W–5°E · 40°S–65°N');
  });

  it('formats Arctic (all N latitude)', () => {
    expect(formatRegionBounds({ minLat: 65, maxLat: 88, minLon: -180, maxLon: 180 }))
      .toBe('180°W–180°E · 65°N–88°N');
  });

  it('formats Southern Ocean (all S latitude)', () => {
    expect(formatRegionBounds({ minLat: -75, maxLat: -45, minLon: -180, maxLon: 180 }))
      .toBe('180°W–180°E · 75°S–45°S');
  });
});

describe('formatLat', () => {
  it('positive → N', () => {
    expect(formatLat(10)).toBe('10°N');
    expect(formatLat(25)).toBe('25°N');
  });
  it('negative → S', () => {
    expect(formatLat(-5)).toBe('5°S');
    expect(formatLat(-45)).toBe('45°S');
  });
  it('zero', () => {
    expect(formatLat(0)).toBe('0°');
  });
});

describe('formatLon', () => {
  it('positive → E', () => {
    expect(formatLon(72)).toBe('72°E');
  });
  it('negative → W', () => {
    expect(formatLon(-75)).toBe('75°W');
  });
  it('180 and -180 get hemisphere indicators', () => {
    expect(formatLon(180)).toBe('180°E');
    expect(formatLon(-180)).toBe('180°W');
  });
  it('zero', () => {
    expect(formatLon(0)).toBe('0°');
  });
});
