import { POINTS_WEEK_ANCHOR } from "./aggregate";

// Shared by the browser and the /api/points route: what gets signed, and how it's checked.

export interface SyncWeek {
  start: number; // points-week start, UTC ms (Wednesday 16:00)
  points: number;
  fees: number; // USD paid that week
  volume: number; // USD traded that week
}

export interface SyncPayload {
  weeks: SyncWeek[];
}

export const SIGN_WINDOW_MS = 10 * 60_000;
export const MIN_CONTRIBUTORS = 3; // a week's community figure is hidden until this many wallets share it

export function signMessage(address: string, payloadHash: string, timestamp: number) {
  return [
    "ArcusMaxxing",
    "Save my weekly points.",
    "",
    `Wallet: ${address.toLowerCase()}`,
    `Data: ${payloadHash}`,
    `Time: ${new Date(timestamp).toISOString()}`,
  ].join("\n");
}

const WEEK = 7 * 86_400_000;

/** Returns an error message, or null if the payload is well-formed. */
export function validatePayload(p: unknown): string | null {
  if (!p || typeof p !== "object" || !Array.isArray((p as SyncPayload).weeks)) return "Malformed payload";
  const weeks = (p as SyncPayload).weeks;
  if (weeks.length > 104) return "Too many weeks";
  const seen = new Set<number>();
  for (const w of weeks) {
    if (![w.start, w.points, w.fees, w.volume].every((v) => typeof v === "number" && Number.isFinite(v))) return "Non-numeric values";
    if ((((w.start - POINTS_WEEK_ANCHOR) % WEEK) + WEEK) % WEEK !== 0) return "Weeks must start on Wednesday 16:00 UTC (the Arcus points week)";
    if (seen.has(w.start)) return "Duplicate week";
    seen.add(w.start);
    if (w.points < 0 || w.points > 1e9) return "Points out of range";
    if (Math.abs(w.fees) > 1e9 || w.volume < 0 || w.volume > 1e13) return "Fees or volume out of range";
  }
  return null;
}

export async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function quantile(values: number[], q: number) {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return null;
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
}
