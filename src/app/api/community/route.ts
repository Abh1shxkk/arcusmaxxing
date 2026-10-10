import { kvConfigured, kvPipeline } from "@/lib/kv";
import { median, MIN_CONTRIBUTORS, quantile } from "@/lib/pointsSync";

const WEEKS = 16;

/**
 * Anonymous community cost per point, by week: the median (and middle-half range) of
 * fees ÷ points across every wallet that shared that week. Weeks with fewer than
 * MIN_CONTRIBUTORS wallets report only a count, so no single wallet can be singled out.
 */
export async function GET(request: Request) {
  void request; // reading per request keeps this route dynamic
  if (!kvConfigured) return Response.json({ configured: false }, { status: 501 });
  const [members] = await kvPipeline([["SMEMBERS", "community:weeks"]]);
  const starts = ((members as string[]) ?? []).map(Number).sort((a, b) => b - a).slice(0, WEEKS);
  const hashes = starts.length ? await kvPipeline(starts.map((s) => ["HVALS", `community:${s}`])) : [];

  const weeks = starts.map((start, i) => {
    const costs = ((hashes[i] as string[]) ?? [])
      .map((v) => JSON.parse(v) as { p: number; f: number })
      .filter((e) => e.p > 0 && e.f > 0)
      .map((e) => e.f / e.p);
    const enough = costs.length >= MIN_CONTRIBUTORS;
    return {
      start,
      contributors: costs.length,
      median: enough ? median(costs) : null,
      p25: enough ? quantile(costs, 0.25) : null,
      p75: enough ? quantile(costs, 0.75) : null,
    };
  });
  return Response.json({ configured: true, minContributors: MIN_CONTRIBUTORS, weeks: weeks.reverse() });
}
