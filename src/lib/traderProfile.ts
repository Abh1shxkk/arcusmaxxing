import type { AccountStats, Fill, Market } from "./arcus";
import { bps } from "./aggregate";

// Turns an account's numbers into a trader persona for the shareable card.
// Size class comes from 30-day volume; the adjective from what that volume cost in fees;
// traits from patterns in the loaded trade history.

export interface Creature {
  name: string;
  emoji: string;
  line: string;
  minVolume: number;
}

export const CREATURES: Creature[] = [
  { name: "Ghost", emoji: "👻", line: "No trades in 30 days. The chart misses you.", minVolume: 0 },
  { name: "Shrimp", emoji: "🦐", line: "Small, scrappy, still in the game.", minVolume: 1 },
  { name: "Crab", emoji: "🦀", line: "Sideways markets are your home.", minVolume: 10_000 },
  { name: "Dolphin", emoji: "🐬", line: "Smart, quick and always moving.", minVolume: 100_000 },
  { name: "Shark", emoji: "🦈", line: "You smell blood in the order book.", minVolume: 1_000_000 },
  { name: "Whale", emoji: "🐋", line: "When you move, the book moves.", minVolume: 10_000_000 },
  { name: "Kraken", emoji: "🦑", line: "Sea monster. Market makers fear you.", minVolume: 100_000_000 },
];

export interface Trait {
  name: string;
  emoji: string;
  why: string;
}

export interface TraderProfile {
  creature: Creature;
  next: Creature | null;
  adjective: string;
  title: string;
  degenScore: number; // 0–100
  scoreLabel: string;
  rateBps: number;
  traits: Trait[];
}

function adjectiveFor(rate: number, volume: number) {
  if (volume === 0) return "Sleeping";
  if (rate < 0) return "Rebate-Farming";
  if (rate < 0.5) return "Fee-Dodging";
  if (rate < 1.5) return "Balanced";
  return "Fee-Burning";
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** `rangeDays` is how many days the loaded fills actually cover (busy accounts may be capped short of the range). */
export function buildProfile(stats: AccountStats, fills: Fill[], markets: Market[] | null, rangeDays: number): TraderProfile {
  const volume = stats.rollingVolume;
  const rate = bps(stats.rollingFeesPaid, volume);
  const idx = CREATURES.reduce((best, c, i) => (volume >= c.minVolume ? i : best), 0);
  const creature = CREATURES[idx];
  const next = CREATURES[idx + 1] ?? null;
  const adjective = adjectiveFor(rate, volume);

  const traits: Trait[] = [];
  const n = fills.length;
  if (n >= 20) {
    const total = fills.reduce((s, f) => s + f.notional, 0);
    const share = (pred: (f: Fill) => boolean) => fills.reduce((s, f) => s + (pred(f) ? f.notional : 0), 0) / total;
    const hourOf = (f: Fill) => new Date(f.createdAt / 1000).getUTCHours();
    const dowOf = (f: Fill) => new Date(f.createdAt / 1000).getUTCDay();
    const days = new Set(fills.map((f) => Math.floor(f.createdAt / 86_400_000_000))).size;
    const byMarket = new Map<string, number>();
    for (const f of fills) byMarket.set(f.market, (byMarket.get(f.market) ?? 0) + f.notional);
    const [topMarket, topVol] = [...byMarket.entries()].sort((a, b) => b[1] - a[1])[0];
    const category = new Map(markets?.map((m) => [m.name, m.category]) ?? []);
    const crypto = share((f) => category.get(f.market) === "CRYPTO");
    const maker = share((f) => f.role === "MAKER");
    const avgSize = total / n;
    const perDay = n / Math.max(1, days);
    const netFees = fills.reduce((s, f) => s + f.fee, 0);

    if (netFees < 0) traits.push({ name: "Rebate Hunter", emoji: "💸", why: "Arcus pays you to trade" });
    if (maker >= 0.6) traits.push({ name: "Maker Maxi", emoji: "🧱", why: `${Math.round(maker * 100)}% of volume as maker` });
    if (maker <= 0.05) traits.push({ name: "Market-Order Merchant", emoji: "🔥", why: "Almost never waits for a fill" });
    if (perDay >= 50 && avgSize < 2_000) traits.push({ name: "Scalper", emoji: "⚡", why: `${Math.round(perDay)} trades a day` });
    if (avgSize >= 25_000) traits.push({ name: "Sniper", emoji: "🎯", why: `Average trade ${Math.round(avgSize / 1000)}K` });
    if (share((f) => hourOf(f) < 6) >= 0.4) traits.push({ name: "Night Owl", emoji: "🦉", why: "Most volume between 00:00 and 06:00 UTC" });
    if (share((f) => dowOf(f) === 0 || dowOf(f) === 6) >= 0.3) traits.push({ name: "Weekend Warrior", emoji: "🏝️", why: "Trades hard on Saturdays and Sundays" });
    if (days >= rangeDays * 0.8) traits.push({ name: "Grinder", emoji: "⛏️", why: `Active ${days} of ${rangeDays} days` });
    if (byMarket.size >= 10) traits.push({ name: "Market Hopper", emoji: "🦘", why: `${byMarket.size} markets traded` });
    if (topVol / total >= 0.8) {
      const t = topMarket.replace("-USD", "");
      traits.push({ name: t === "BTC" ? "BTC Maxi" : `${t} Loyalist`, emoji: "💍", why: `${Math.round((topVol / total) * 100)}% of volume in ${t}` });
    }
    if (markets && crypto <= 0.4) traits.push({ name: "Wall St Degen", emoji: "📈", why: `${Math.round((1 - crypto) * 100)}% in stocks, ETFs and commodities` });
    if (markets && crypto >= 0.9) traits.push({ name: "Crypto Native", emoji: "🪙", why: `${Math.round(crypto * 100)}% of volume in crypto` });
  }

  // Degen score: how hard you're sending it — size (log volume), cadence, fee burn and breadth.
  const sizeScore = clamp(Math.log10(Math.max(1, volume)) / 8); // $100M ≈ full marks
  const days = new Set(fills.map((f) => Math.floor(f.createdAt / 86_400_000_000))).size;
  const cadence = clamp(days / Math.max(1, rangeDays));
  const burn = clamp(rate / 2.25);
  const breadth = clamp(new Set(fills.map((f) => f.market)).size / 10);
  const degenScore = Math.round(100 * (0.55 * sizeScore + 0.2 * cadence + 0.1 * burn + 0.15 * breadth));
  const scoreLabel = degenScore >= 80 ? "Certified degen" : degenScore >= 60 ? "Full send" : degenScore >= 40 ? "Warming up" : degenScore >= 20 ? "Tourist" : "NPC";

  return {
    creature,
    next,
    adjective,
    title: volume === 0 ? "Ghost" : `${adjective} ${creature.name}`,
    degenScore,
    scoreLabel,
    rateBps: rate,
    traits: traits.slice(0, 5),
  };
}
