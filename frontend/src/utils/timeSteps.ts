// Time-step generation for the ocean-data time animation.
// Generates UTC timestamps between a user-selected start and end date/time
// at a given interval. All work is done in UTC to stay consistent with the
// API and the backend synthetic generator (which varies fields by season).

export interface TimeStepRange {
  start: string;
  end: string;
  intervalMinutes: number;
  steps: string[];
}

/**
 * Normalize any time string into a canonical UTC ISO string ending with 'Z'.
 * Prevents browser Date.parse timezone offset bugs when strings lack 'Z'.
 */
export function normalizeISO(timeStr: string): string {
  if (!timeStr) return new Date().toISOString();
  const clean = timeStr.endsWith('Z') || timeStr.includes('+') ? timeStr : `${timeStr}Z`;
  const d = new Date(clean);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// Human-readable interval menu used by the TimeController UI.
// Each entry is a step-size in minutes.
export const TIME_STEP_INTERVALS: { label: string; minutes: number }[] = [
  { label: '1 hour', minutes: 60 },
  { label: '6 hours', minutes: 360 },
  { label: '12 hours', minutes: 720 },
  { label: '1 day', minutes: 1440 },
];

/**
 * Generate a UTC ISO timestamp sequence from `start` to `end` (inclusive)
 * stepping by `intervalMinutes`.
 *
 * - Returns `null` when `end` is not strictly after `start` (invalid range).
 * - Always includes the exact `end` timestamp as the last element, so the
 *   animation stops precisely at the user's chosen end time.
 * - Intermediates are aligned by walking the interval from `start`.
 */
export function generateTimeSteps(
  startISO: string,
  endISO: string,
  intervalMinutes: number
): string[] | null {
  const start = new Date(startISO);
  const end = new Date(endISO);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end <= start) return null;
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) return null;

  const stepMs = intervalMinutes * 60 * 1000;
  const steps: string[] = [];

  let t = start.getTime();
  for (let guard = 0; guard < 1_000_000 && t < end.getTime(); guard++) {
    steps.push(new Date(t).toISOString());
    t += stepMs;
  }

  // Always land exactly on the end time (do not exceed it accidentally).
  const last = steps[steps.length - 1];
  if (!last || new Date(last).getTime() !== end.getTime()) {
    steps.push(end.toISOString());
  }

  return steps;
}
