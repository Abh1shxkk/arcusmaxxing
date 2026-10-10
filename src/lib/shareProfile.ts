import { fetchAccountStats, fetchMarkets, streamFills } from "./arcus";
import { buildProfile, type TraderProfile } from "./traderProfile";
import type { AccountStats } from "./arcus";

// Server-side profile for share previews: stats plus one page of recent fills is enough for
// the title, creature, score and most stickers, and keeps preview generation fast.
export async function profileForShare(address: string): Promise<{ stats: AccountStats; profile: TraderProfile } | null> {
  try {
    const from = (Date.now() - 30 * 86_400_000) * 1000;
    const [stats, markets, page] = await Promise.all([
      fetchAccountStats(address),
      fetchMarkets().catch(() => null),
      streamFills({ address, fromUs: from, maxFills: 1000, onPage: () => {} }),
    ]);
    const oldest = page.fills.at(-1)?.createdAt;
    const coveredDays = oldest ? Math.max(1, Math.min(30, Math.round((Date.now() - oldest / 1000) / 86_400_000))) : 30;
    return { stats, profile: buildProfile(stats, page.fills, markets, coveredDays) };
  } catch {
    return null;
  }
}
