"use client";

import { useEffect, useState } from "react";
import { fetchLeaderboard, type LeaderboardEntry } from "@/lib/arcus";
import { bps } from "@/lib/aggregate";
import { bpsLabel, shortAddress, usd } from "@/lib/format";
import { Card, Pagination, Segmented, usePagination } from "./ui";
import { DegenAvatar } from "./DegenAvatar";

const NO_ENTRIES: LeaderboardEntry[] = [];

type Sort = "fees" | "volume" | "pnl";
type Span = "24h" | "30d";

export function LeaderboardCard({
  onSelect,
  limit = 10,
  pageSize,
  wide = false,
}: {
  onSelect: (address: string) => void;
  limit?: number;
  pageSize?: number; // paginate the fetched rows client-side
  wide?: boolean; // full-page layout: adds the profit column and sort
}) {
  const [sortBy, setSortBy] = useState<Sort>("fees");
  const [span, setSpan] = useState<Span>("30d");
  const [result, setResult] = useState<{ key: string; entries: LeaderboardEntry[] } | null>(null);
  const key = `${sortBy}:${span}`;

  useEffect(() => {
    const ctrl = new AbortController();
    fetchLeaderboard(sortBy, span, limit, ctrl.signal)
      .then((entries) => setResult({ key: `${sortBy}:${span}`, entries }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [sortBy, span, limit]);

  const entries = result?.key === key ? result.entries : null;
  const paged = usePagination(entries ?? NO_ENTRIES, pageSize ?? limit);
  const cols = wide ? "grid-cols-[28px_1fr_auto_auto_auto]" : "grid-cols-[28px_1fr_auto_auto]";

  return (
    <Card
      title="Top traders"
      subtitle="Click a trader to see their fee breakdown."
      action={
        <div className="flex flex-wrap gap-2">
          <Segmented label="Rank by" value={sortBy} onChange={setSortBy}
            options={[
              { value: "fees", label: "Fees" },
              { value: "volume", label: "Volume" },
              ...(wide ? [{ value: "pnl" as const, label: "Profit" }] : []),
            ]} />
          <Segmented label="Window" value={span} onChange={setSpan}
            options={[{ value: "24h", label: "24h" }, { value: "30d", label: "30d" }]} />
        </div>
      }
    >
      {!entries ? (
        <div className="space-y-3">{Array.from({ length: Math.min(limit, 10) }, (_, i) => <div key={i} className="skeleton h-9 w-full" />)}</div>
      ) : (
        <>
        <div className={`grid ${cols} gap-3 pb-1.5 text-[12px] font-medium text-ink-2`}>
          <span className="text-center">#</span>
          <span>Trader</span>
          <span className="w-20 text-right">Volume</span>
          <span className="w-24 text-right">Fees · rate</span>
          {wide && <span className="w-24 text-right">Realised profit</span>}
        </div>
        <ol className="tabular -mx-2 text-[14px]">
          {paged.slice.map((e) => (
            <li key={e.address}>
              <button
                onClick={() => onSelect(e.address)}
                className={`grid w-full ${cols} items-center gap-3 rounded-[12px] px-2 py-2 text-left transition hover:bg-fill-2`}
              >
                <span className={`text-center text-[13px] font-semibold ${e.rank <= 3 ? "text-ink" : "text-ink-3"}`}>{e.rank}</span>
                <span className="flex min-w-0 items-center gap-2"><DegenAvatar address={e.address} size={26} /><span className="truncate font-mono text-[13px]">{shortAddress(e.address)}</span></span>
                <span className="w-20 text-right">{usd(e.volume, { compact: true })}</span>
                <span className="w-24 text-right">
                  <span className="font-medium text-orange">{usd(e.feesPaid, { compact: true })}</span>
                  <span className="block text-[11px] text-ink-3">{bpsLabel(bps(e.feesPaid, e.volume))}</span>
                </span>
                {wide && (
                  <span className={`w-24 text-right font-medium ${e.pnl >= 0 ? "text-green" : "text-red"}`}>
                    {e.pnl >= 0 ? "+" : ""}{usd(e.pnl, { compact: true })}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
        <Pagination {...paged} noun="traders" />
        </>
      )}
    </Card>
  );
}
