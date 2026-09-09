import { describe, it, expect } from 'vitest';
import { isOverOcean } from '@/data/geo';

describe('isOverOcean', () => {
  // Valid ocean points
  it('Indian Ocean near 70°E, 10°N → ocean', () => {
    expect(isOverOcean(10, 70)).toBe(true);
  });

  it('Arabian Sea near 65°E, 15°N → ocean', () => {
    expect(isOverOcean(15, 65)).toBe(true);
  });

  it('Bay of Bengal near 88°E, 15°N → ocean', () => {
    expect(isOverOcean(15, 88)).toBe(true);
  });

  it('Atlantic Ocean near 40°W, 20°N → ocean', () => {
    expect(isOverOcean(20, -40)).toBe(true);
  });

  it('Pacific Ocean near 150°W, 0° → ocean', () => {
    expect(isOverOcean(0, -150)).toBe(true);
  });

  it('Southern Ocean near 0°E, 60°S → ocean', () => {
    expect(isOverOcean(-60, 0)).toBe(true);
  });

  it('Coastal ocean — Indian coast near 15°N, 74°E → ocean', () => {
    expect(isOverOcean(15, 74)).toBe(true);
  });

  // Land points (India, Africa, Europe, etc.)
  it('India — Mumbai area 19°N, 73°E → land', () => {
    expect(isOverOcean(19, 73)).toBe(false);
  });

  it('India — Chennai area 13°N, 80°E → land', () => {
    expect(isOverOcean(13, 80)).toBe(false);
  });

  it('India — Delhi area 29°N, 77°E → land', () => {
    expect(isOverOcean(29, 77)).toBe(false);
  });

  it('Sri Lanka 8°N, 81°E → land', () => {
    expect(isOverOcean(8, 81)).toBe(false);
  });

  it('Europe — Madrid 40°N, 4°W → land', () => {
    expect(isOverOcean(40, -4)).toBe(false);
  });

  it('Africa — Cairo 30°N, 31°E → land', () => {
    expect(isOverOcean(30, 31)).toBe(false);
  });

  it('Africa — central Sahara 20°N, 12°E → land', () => {
    expect(isOverOcean(20, 12)).toBe(false);
  });

  it('North America — New York 41°N, 74°W → land', () => {
    expect(isOverOcean(41, -74)).toBe(false);
  });

  it('Australia — Sydney 34°S, 151°E → land', () => {
    expect(isOverOcean(-34, 151)).toBe(false);
  });

  it('Japan — Tokyo 36°N, 140°E → land', () => {
    expect(isOverOcean(36, 140)).toBe(false);
  });

  // Edge case: longitude wrapping
  it('wraps longitude correctly: 200°E ≡ 160°W → Pacific', () => {
    expect(isOverOcean(20, 200)).toBe(true);
  });

  it('wraps longitude correctly: -200°W ≡ 160°E → Indian Ocean', () => {
    expect(isOverOcean(20, -200)).toBe(true);
  });

  // Real glider start positions from backend
  it('Glider 1 start (7.05, 74.5) → ocean (just south of India)', () => {
    expect(isOverOcean(7.05, 74.5)).toBe(true);
  });

  it('Glider 2 start (10.05, 71.5) → ocean (Lakshadweep area)', () => {
    expect(isOverOcean(10.05, 71.5)).toBe(true);
  });

  it('Glider 3 start (13.05, 68.5) → ocean (Arabian Sea)', () => {
    expect(isOverOcean(13.05, 68.5)).toBe(true);
  });
});
