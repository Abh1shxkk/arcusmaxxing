"use client";

import type { Market } from "@/lib/arcus";
import { num, usd } from "@/lib/format";
import { Card, Stat } from "./ui";

export function exchangeTotals(markets: Market[] | null) {
  return {
    volume: markets?.reduce((s, m) => s + m.volume24h, 0) ?? 0,
    openInterest: markets?.reduce((s, m) => s + m.openInterest, 0) ?? 0,
    trades: markets?.reduce((s, m) => s + m.trades24h, 0) ?? 0,
  };
}

export function ExchangeCard({ markets }: { markets: Market[] | null }) {
  const t = exchangeTotals(markets);
  const top = (markets ?? []).slice(0, 4);
  return (
    <Card title="Exchange today" subtitle="All Arcus perpetual markets, last 24 hours." delay={60}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <Stat label="Volume" value={usd(t.volume, { compact: true })} loading={!markets} />
        <Stat label="Open interest" value={usd(t.openInterest, { compact: true })} loading={!markets} />
        <Stat label="Trades" value={num(t.trades)} loading={!markets} />
        <Stat label="Live markets" value={markets?.length ?? 0} loading={!markets} />
      </div>
      <div className="mt-6 space-y-2.5 border-t border-hairline pt-5">
        {top.map((m) => (
          <div key={m.name} className="tabular flex items-center gap-3 text-[13px]">
            <span className="w-14 shrink-0 font-medium">{m.name.replace("-USD", "")}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(m.volume24h / top[0].volume24h) * 100}%` }} />
            </div>
            <span className="w-16 text-right text-ink-2">{usd(m.volume24h, { compact: true })}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
