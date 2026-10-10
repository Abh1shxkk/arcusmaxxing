// Arcus has no public points API, so weekly points are entered by the user
// and kept in this browser's localStorage, keyed by address and week start (UTC ms).

export type PointsMap = Record<string, number>;

const storageKey = (address: string) => `arcus-points:${address.toLowerCase()}`;

export function loadPoints(address: string): PointsMap {
  try {
    return JSON.parse(localStorage.getItem(storageKey(address)) ?? "{}");
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
