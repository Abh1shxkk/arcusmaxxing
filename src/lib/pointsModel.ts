import type { Bucket } from "./aggregate";
import type { FeeTier } from "./arcus";

// Arcus doesn't publish how points are calculated, so we learn it from the user's own weeks:
// fit points ≈ k × fees and points ≈ k × volume, and keep whichever explains the data better.

export type Driver = "fees" | "volume";

export interface Observation {
  start: number;
  volume: number;
  fees: number;
  points: number;
}

export interface Fit {
  rate: number; // points per $1 of the driver
  r2: number | null; // goodness of fit, null with fewer than 3 weeks
}

export interface PointsModel {
  weeks: number;
  totalPoints: number;
  totalFees: number;
  totalVolume: number;
  costPerPoint: number; // $ fees per point, historical
  byFees: Fit;
  byVolume: Fit;
  best: Driver;
  // Change in fee cost per point per week, as a fraction (0.05 = points getting 5% pricier weekly).
  weeklyCostTrend: number | null;
}

// Least squares through the origin: zero activity earns zero points.
function fitThroughOrigin(xs: number[], ys: number[]): Fit {
  const sxy = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sxx = xs.reduce((s, x) => s + x * x, 0);
  const rate = sxx > 0 ? sxy / sxx : 0;
  if (xs.length < 3) return { rate, r2: null };
  const mean = ys.reduce((s, y) => s + y, 0) / ys.length;
  const ssTot = ys.reduce((s, y) => s + (y - mean) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - rate * xs[i]) ** 2, 0);
  return { rate, r2: ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : null };
}

// Slope of log(cost per point) over week index → compounded weekly change.
function costTrend(obs: Observation[]): number | null {
  const pts = obs.filter((o) => o.fees > 0 && o.points > 0).sort((a, b) => a.start - b.start);
  if (pts.length < 3) return null;
  const xs = pts.map((o) => (o.start - pts[0].start) / (7 * 86_400_000));
  const ys = pts.map((o) => Math.log(o.fees / o.points));
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = ys.reduce((s, y) => s + y, 0) / ys.length;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den > 0 ? Math.exp(num / den) - 1 : null;
}

export function buildModel(weeks: (Bucket & { points?: number })[]): PointsModel | null {
  const obs: Observation[] = weeks
    .filter((w) => w.points && w.points > 0 && w.volume > 0)
    .map((w) => ({ start: w.start, volume: w.volume, fees: w.fees, points: w.points! }));
  if (obs.length === 0) return null;

  const pts = obs.map((o) => o.points);
  const byFees = fitThroughOrigin(obs.map((o) => o.fees), pts);
  const byVolume = fitThroughOrigin(obs.map((o) => o.volume), pts);
  const totalPoints = pts.reduce((s, p) => s + p, 0);
  const totalFees = obs.reduce((s, o) => s + o.fees, 0);
  const totalVolume = obs.reduce((s, o) => s + o.volume, 0);

  return {
    weeks: obs.length,
    totalPoints,
    totalFees,
    totalVolume,
    costPerPoint: totalFees / totalPoints,
    byFees,
    byVolume,
    best: (byVolume.r2 ?? 0) > (byFees.r2 ?? 0) ? "volume" : "fees",
    weeklyCostTrend: costTrend(obs),
  };
}

/** The tier a steady weekly volume would land in, from its implied 30-day volume. */
export function tierForWeeklyVolume(tiers: FeeTier[], weeklyVolume: number): FeeTier | undefined {
  const rolling = (weeklyVolume * 30) / 7;
  return [...tiers].reverse().find((t) => rolling >= t.volumeThreshold) ?? tiers[0];
}

export function feesFor(volume: number, makerShare: number, tier: FeeTier) {
  return (volume * (makerShare * tier.makerFeePpm + (1 - makerShare) * tier.takerFeePpm)) / 1e6;
}
