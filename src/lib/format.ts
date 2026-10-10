const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

export function usd(v: number, opts: { compact?: boolean; cents?: boolean } = {}) {
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (opts.compact && a >= 10_000) return `${sign}$${compact.format(a)}`;
  const digits = opts.cents || a < 100 ? 2 : 0;
  return `${sign}$${a.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export const num = (v: number) => (Math.abs(v) >= 10_000 ? compact.format(v) : v.toLocaleString("en-US"));

export const pct = (ppm: number) => `${ppm < 0 ? "−" : ""}${(Math.abs(ppm) / 1e4).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%`;

export const bpsLabel = (b: number) => `${b.toFixed(2)} bps`;

const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const shortDate = (ms: number) => dayFmt.format(ms);

export function weekLabel(startMs: number) {
  return `${shortDate(startMs)} – ${shortDate(startMs + 6 * 86_400_000)}`;
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
