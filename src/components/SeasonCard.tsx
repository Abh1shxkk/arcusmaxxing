"use client";

import { useEffect, useState } from "react";
import { num } from "@/lib/format";
import { nextDistribution, POINTS_POST_URL, WEEKLY_POOL, weeksLeft } from "@/lib/season";
import { Card, Stat } from "./ui";

/** Arcus Points Season 1 at a glance, plus where the tracked wallet stands in the weekly pool. */
export function SeasonCard({ weeklyPoints }: { weeklyPoints: number[] }) {
  // Ticks once a minute for the countdown; starts after hydration so server and client agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const scored = weeklyPoints.filter((p) => p > 0);
  const avg = scored.length ? scored.reduce((s, p) => s + p, 0) / scored.length : null;
  const next = now ? nextDistribution(now) : null;
  const left = now ? weeksLeft(now) : null;
  const until = next && now ? countdown(next - now) : "…";

  return (
    <Card title="Arcus Points · Season 1"
      subtitle="Points drop every Wednesday at 3PM ET from a fixed weekly pool. Copy yours from the Arcus Points Dashboard into the table below."
      action={<a href={POINTS_POST_URL} target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium text-accent hover:underline">Official rules ↗</a>}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <Stat label="Weekly pool" value={`${num(WEEKLY_POOL)} pts`} hint="Fixed — doesn't grow with users" />
        <Stat label="Next drop" tone="accent" value={until}
          hint={next ? new Date(next).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : undefined} />
        <Stat label="Your share of the pool" tone="orange" value={avg ? `${((avg / WEEKLY_POOL) * 100).toFixed(avg / WEEKLY_POOL < 0.001 ? 4 : 3)}%` : "—"}
          hint={avg ? `${num(Math.round(avg))} pts a week on average` : "Enter weekly points below"} />
        <Stat label="At this pace" value={avg && left != null ? `${num(Math.round(avg * left))} pts` : "—"}
          hint={left != null ? `More by season end · ${left} weeks left at most` : undefined} />
      </div>
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

function countdown(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  return d >= 1 ? `${d}d ${h % 24}h` : `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}
