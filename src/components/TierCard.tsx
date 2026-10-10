"use client";

import type { AccountStats, FeeTier } from "@/lib/arcus";
import { pct, usd } from "@/lib/format";
import { Card } from "./ui";

export function TierCard({ tiers, stats }: { tiers: FeeTier[] | null; stats: AccountStats | null }) {
  const level = stats?.tier.level ?? 0;
  const next = tiers?.find((t) => t.level === level + 1);
  const current = tiers?.find((t) => t.level === level);
  const vol = stats?.rollingVolume ?? 0;
  const progress = next && current ? Math.min(1, (vol - current.volumeThreshold) / (next.volumeThreshold - current.volumeThreshold)) : 1;

  return (
    <Card id="tiers" title="Fee tiers" subtitle="Tiers are set by trading volume over the last 30 days." delay={160}>
      {!tiers ? (
        <div className="skeleton h-64 w-full" />
      ) : (
        <>
          {stats && <div className="mb-5 rounded-[16px] bg-card-2 p-4 ring-1 ring-hairline">
            <div className="flex items-baseline justify-between">
              <span className="text-[22px] font-semibold tracking-tight">{current?.name}</span>
              {next && <span className="text-[13px] text-ink-2">Next: {next.name}</span>}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-fill">
              <div className="h-full rounded-full bg-accent transition-[width] duration-700"
                style={{ width: `${Math.max(progress, 0.02) * 100}%` }} />
            </div>
            <p className="tabular mt-2 text-[13px] text-ink-2">
              {next
                ? <>Trade <span className="font-medium text-ink">{usd(next.volumeThreshold - vol, { compact: true })}</span> more in 30 days to unlock {pct(next.takerFeePpm)} taker.</>
                : "You're on the best tier."}
            </p>
          </div>}

          <ul className="tabular text-[14px]">
            <li className="grid grid-cols-[1fr_auto_auto] gap-4 pb-2 text-[12px] text-ink-2">
              <span>Tier · 30-day volume</span>
              <span className="w-16 text-right">Maker</span>
              <span className="w-16 text-right">Taker</span>
            </li>
            {tiers.map((t) => (
              <li key={t.level}
                className={`grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-[10px] px-2 py-2 -mx-2 ${
                  stats && t.level === level ? "bg-accent-soft font-medium" : "border-t border-hairline"}`}>
                <span>
                  {t.name} <span className="text-ink-3">· {t.volumeThreshold ? `${usd(t.volumeThreshold, { compact: true })}+` : "Any"}</span>
                </span>
                <span className={`w-16 text-right ${t.makerFeePpm < 0 ? "text-green" : ""}`}>{pct(t.makerFeePpm)}</span>
                <span className="w-16 text-right">{pct(t.takerFeePpm)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
