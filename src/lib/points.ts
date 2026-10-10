// Arcus shows points on its own dashboard but offers no public per-wallet points API, so weekly
// points are entered by the user and kept in this browser's localStorage, keyed by address and
// points-week start (UTC ms).

import { POINTS_WEEK_ANCHOR, weekStart } from "./aggregate";

export type PointsMap = Record<string, number>;

const storageKey = (address: string) => `arcus-points:${address.toLowerCase()}`;
const WEEK = 7 * 86_400_000;

/**
 * Earlier versions keyed weeks by Monday 00:00 UTC. Move any such entry into the Arcus points week
 * (Wednesday 16:00 UTC → Wednesday) that the Monday falls in, keeping an existing value if both exist.
 */
export function migratePoints(points: PointsMap): { points: PointsMap; changed: boolean } {
  const out: PointsMap = {};
  let changed = false;
  for (const [key, value] of Object.entries(points)) {
    const start = Number(key);
    const aligned = ((((start - POINTS_WEEK_ANCHOR) % WEEK) + WEEK) % WEEK) === 0;
    const target = aligned ? start : weekStart(start);
    if (!aligned) changed = true;
    if (out[target] == null) out[target] = value;
  }
  return { points: out, changed };
}

export function loadPoints(address: string): PointsMap {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(address)) ?? "{}") as PointsMap;
    const { points, changed } = migratePoints(raw);
    if (changed) savePoints(address, points);
    return points;
  } catch {
    return {};
  }
}

export function savePoints(address: string, points: PointsMap) {
  try {
    localStorage.setItem(storageKey(address), JSON.stringify(points));
  } catch {
    // Storage can be unavailable (private mode); points just won't persist.
  }
}
