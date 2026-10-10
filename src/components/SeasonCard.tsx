"use client";

import { useEffect, useState } from "react";
import { num } from "@/lib/format";
import { nextDistribution, POINTS_POST_URL, WEEKLY_POOL, weeksLeft } from "@/lib/season";
import { Card, Stat } from "./ui";

/** Arcus Points Season 1 at a glance, plus where the tracked wallet stands in the weekly pool. */
export function SeasonCard({ weeklyPoints }: { weeklyPoints: number[] }) {
  // Ticks every second for the live countdown; starts after hydration so server and client agree.
  const [now, setNow] = useState<number | null>(null);
  const [meta, setMeta] = useState<PointsMeta | null>(null);
  // Official schedule and season totals from Arcus's public points API (CORS-enabled, cached 30s).
  useEffect(() => {
    fetch("https://points-api.arcus.xyz/v1/meta")
      .then((r) => (r.ok ? r.json() : null))
      .then((m: PointsMeta | null) => m && setMeta(m))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const scored = weeklyPoints.filter((p) => p > 0);
  const avg = scored.length ? scored.reduce((s, p) => s + p, 0) / scored.length : null;
  const officialNext = meta?.next_drop_at ? Date.parse(meta.next_drop_at) : null;
  const next = officialNext && now && officialNext > now ? officialNext : now ? nextDistribution(now) : null;
  const left = now ? weeksLeft(now) : null;
  const remaining = next && now ? Math.max(0, next - now) : null;

  return (
    <Card title="Arcus Points · Season 1"
      subtitle="Points drop every Wednesday (19:00 UTC) from a fixed weekly pool. Copy yours from the Arcus Rewards page into the table below."
      action={<a href={POINTS_POST_URL} target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium text-accent hover:underline">Official rules ↗</a>}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <Stat label="Weekly pool" value={`${num(WEEKLY_POOL)} pts`} hint="Fixed — doesn't grow with users" />
        <Stat label="Next drop" tone="accent" value={remaining == null ? "…" : <Countdown ms={remaining} />}
          hint={next ? new Date(next).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : undefined} />
        <Stat label="Your share of the pool" tone="orange" value={avg ? `${((avg / WEEKLY_POOL) * 100).toFixed(avg / WEEKLY_POOL < 0.001 ? 4 : 3)}%` : "—"}
          hint={avg ? `${num(Math.round(avg))} pts a week on average` : "Enter weekly points below"} />
        <Stat label="At this pace" value={avg && left != null ? `${num(Math.round(avg * left))} pts` : "—"}
          hint={left != null ? `More by season end · ${left} weeks left at most` : undefined} />
      </div>
      {meta && (
        <p className="mt-5 rounded-[12px] bg-fill-2 px-3.5 py-2.5 text-[13px] text-ink-2">
          Live from Arcus: <span className="tabular font-medium text-ink">{num(meta.season_addresses)}</span> wallets have earned points
          in {meta.season.name}, with <span className="tabular font-medium text-ink">{num(meta.season_total_points)}</span> points
          handed out so far. Each points week runs Wednesday to Wednesday and drops at{" "}
          {new Date(meta.next_drop_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}.
        </p>
      )}
      <div className="mt-6 grid gap-3 border-t border-hairline pt-5 text-[13px] leading-relaxed sm:grid-cols-3">
        <div>
          <p className="font-semibold">Earns points</p>
          <p className="text-ink-2">How you trade (not just volume), making markets, keeping deposits on Arcus, and referrals.</p>
        </div>
        <div>
          <p className="font-semibold">Boosted right now</p>
          <p className="text-ink-2">Stock Tokens and other real-world assets — and RWA perps between 8PM and 4AM ET or on weekends.</p>
        </div>
        <div>
          <p className="font-semibold">Gets you cut</p>
          <p className="text-ink-2">Wash trading, self-matching, clustering and rapid deposit → trade → withdraw churning.</p>
        </div>
      </div>
    </Card>
  );
}

/** Live d / h / m / s boxes, ticking every second. */
function Countdown({ ms }: { ms: number }) {
  const total = Math.floor(ms / 1000);
  const parts: [number, string][] = [
    [Math.floor(total / 86_400), "d"],
    [Math.floor((total % 86_400) / 3_600), "h"],
    [Math.floor((total % 3_600) / 60), "m"],
    [total % 60, "s"],
  ];
  if (total === 0) return <span>Dropping now</span>;
  return (
    <span className="mt-1 flex items-end gap-1.5" role="timer" aria-live="off"
      aria-label={`${parts[0][0]} days ${parts[1][0]} hours ${parts[2][0]} minutes until the next drop`}>
      {parts.map(([v, unit]) => (
        <span key={unit} className="flex items-baseline rounded-[10px] bg-accent-soft px-2 py-1">
          <span className="tabular text-[24px] font-semibold leading-none">{String(v).padStart(2, "0")}</span>
          <span className="ml-0.5 text-[12px] font-medium text-ink-2">{unit}</span>
        </span>
      ))}
    </span>
  );
}

interface PointsMeta {
  season: { name: string; starts_at: string };
  latest_week: { week_start: string; distributed_at: string } | null;
  next_drop_at: string;
  season_addresses: number;
  season_total_points: number;
}
