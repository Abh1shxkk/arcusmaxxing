// Arcus Points Season 1, from "Introducing Arcus Points" (arcus.xyz/blog, Oct 1 2026):
// a fixed 250K points per week, distributed Wednesdays 3PM ET, ending no later than the end of H1 2027.
// Boosts: real-world assets, and RWA perps outside regular hours (4AM–8PM ET on US trading days).

export const WEEKLY_POOL = 250_000;
export const SEASON_START = Date.UTC(2026, 9, 1); // Oct 1, 2026
export const SEASON_END_LATEST = Date.UTC(2027, 5, 30, 23, 59); // end of H1 2027
export const POINTS_POST_URL = "https://arcus.xyz/blog/introducing-arcus-points";

const ET = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", minute: "numeric" });

function etParts(ms: number) {
  const p = Object.fromEntries(ET.formatToParts(ms).map((x) => [x.type, x.value]));
  return { weekday: p.weekday as string, hour: Number(p.hour), minute: Number(p.minute) };
}

/**
 * True when a trade falls in Arcus's boost window: 8PM–4AM ET overnight, or any time on a weekend.
 * (US market holidays also count; they aren't modelled here.)
 */
export function isOffHoursET(ms: number) {
  const { weekday, hour } = etParts(ms);
  if (weekday === "Sat" || weekday === "Sun") return true;
  return hour < 4 || hour >= 20;
}

/** The next weekly distribution: Wednesday 3:00 PM America/New_York. */
export function nextDistribution(now: number) {
  // Walk forward in 15-minute steps to the next Wednesday 15:00 ET — simple and DST-proof.
  let t = Math.ceil(now / 900_000) * 900_000;
  for (let i = 0; i < 8 * 96; i++, t += 900_000) {
    const { weekday, hour, minute } = etParts(t);
    if (weekday === "Wed" && hour === 15 && minute === 0 && t > now) return t;
  }
  return now + 7 * 86_400_000;
}

export function weeksLeft(now: number) {
  return Math.max(0, Math.ceil((SEASON_END_LATEST - now) / (7 * 86_400_000)));
}
