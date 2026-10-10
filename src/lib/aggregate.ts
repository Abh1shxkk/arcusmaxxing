import type { Fill } from "./arcus";

export type Period = "day" | "week";

export interface Bucket {
  start: number; // epoch ms, UTC period start
  volume: number;
  fees: number; // net: fees paid minus rebates
  feesPaid: number; // gross positive fees
  rebates: number; // positive number
  makerVolume: number;
  takerVolume: number;
  trades: number;
}

const DAY_MS = 86_400_000;

export function dayStart(ms: number) {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

const WEEK_MS = 7 * DAY_MS;
/**
 * Weeks follow the Arcus points week: Wednesday 16:00 UTC to the next Wednesday 16:00 UTC, anchored
 * on the Season 1 start (points-api.arcus.xyz/v1/meta). Each week's points drop that Wednesday at 19:00 UTC.
 */
export const POINTS_WEEK_ANCHOR = Date.UTC(2026, 8, 30, 16);

export function weekStart(ms: number) {
  return POINTS_WEEK_ANCHOR + Math.floor((ms - POINTS_WEEK_ANCHOR) / WEEK_MS) * WEEK_MS;
}

/** A week only partly covered by the loaded data: the current week, or one cut off by the range start. */
export function isPartialWeek(start: number, rangeStartMs: number, nowMs: number) {
  return start === weekStart(nowMs) || start < rangeStartMs;
}

const emptyBucket =(start: number): Bucket => ({
  start,
  volume: 0,
  fees: 0,
  feesPaid: 0,
  rebates: 0,
  makerVolume: 0,
  takerVolume: 0,
  trades: 0,
});

/** Groups fills into contiguous day/week buckets (oldest first), including empty periods. */
export function bucketize(fills: Fill[], period: Period, rangeStartMs: number, nowMs: number): Bucket[] {
  const startOf = period === "day" ? dayStart : weekStart;
  const step = period === "day" ? DAY_MS : WEEK_MS;
  const map = new Map<number, Bucket>();
  for (let t = startOf(rangeStartMs); t <= nowMs; t += step) map.set(t, emptyBucket(t));

  for (const f of fills) {
    const ms = f.createdAt / 1000;
    const k = startOf(ms);
    let b = map.get(k);
    if (!b) map.set(k, (b = emptyBucket(k)));
    b.volume += f.notional;
    b.fees += f.fee;
    if (f.fee >= 0) b.feesPaid += f.fee;
    else b.rebates -= f.fee;
    if (f.role === "MAKER") b.makerVolume += f.notional;
    else b.takerVolume += f.notional;
    b.trades++;
  }
  return [...map.values()].sort((a, b) => a.start - b.start);
}

export interface Totals {
  volume: number;
  fees: number;
  rebates: number;
  makerVolume: number;
  takerVolume: number;
  trades: number;
  byMarket: { market: string; volume: number; fees: number }[];
}

export function totals(fills: Fill[]): Totals {
  const t: Totals = { volume: 0, fees: 0, rebates: 0, makerVolume: 0, takerVolume: 0, trades: 0, byMarket: [] };
  const m = new Map<string, { market: string; volume: number; fees: number }>();
  for (const f of fills) {
    t.volume += f.notional;
    t.fees += f.fee;
    if (f.fee < 0) t.rebates -= f.fee;
    if (f.role === "MAKER") t.makerVolume += f.notional;
    else t.takerVolume += f.notional;
    t.trades++;
    const e = m.get(f.market) ?? { market: f.market, volume: 0, fees: 0 };
    e.volume += f.notional;
    e.fees += f.fee;
    m.set(f.market, e);
  }
  t.byMarket = [...m.values()].sort((a, b) => b.volume - a.volume);
  return t;
}

/** Effective fee rate in basis points (1 bp = 0.01%). */
export const bps = (fees: number, volume: number) => (volume > 0 ? (fees / volume) * 1e4 : 0);

export interface HeatCell {
  day: number; // 0 = Monday
  hour: number; // 0–23 UTC
  volume: number;
  fees: number;
  trades: number;
}

/** Volume by weekday × hour (UTC), Monday first. */
export function activityGrid(fills: Fill[]): HeatCell[] {
  const cells: HeatCell[] = [];
  for (let day = 0; day < 7; day++)
    for (let hour = 0; hour < 24; hour++) cells.push({ day, hour, volume: 0, fees: 0, trades: 0 });
  for (const f of fills) {
    const d = new Date(f.createdAt / 1000);
    const c = cells[((d.getUTCDay() + 6) % 7) * 24 + d.getUTCHours()];
    c.volume += f.notional;
    c.fees += f.fee;
    c.trades++;
  }
  return cells;
}

export interface SizeBin {
  label: string;
  min: number;
  trades: number;
  volume: number;
  fees: number;
}

const SIZE_EDGES = [0, 100, 1_000, 10_000, 100_000, 1_000_000];
const SIZE_LABELS = ["< $100", "$100–1K", "$1K–10K", "$10K–100K", "$100K–1M", "$1M+"];

/** Trade count, volume and fees by notional size, on log-spaced bins. */
export function sizeBins(fills: Fill[]): SizeBin[] {
  const bins = SIZE_EDGES.map((min, i) => ({ label: SIZE_LABELS[i], min, trades: 0, volume: 0, fees: 0 }));
  for (const f of fills) {
    let i = SIZE_EDGES.length - 1;
    while (i > 0 && f.notional < SIZE_EDGES[i]) i--;
    bins[i].trades++;
    bins[i].volume += f.notional;
    bins[i].fees += f.fee;
  }
  return bins;
}
