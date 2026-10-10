"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AccountStats, Fill } from "@/lib/arcus";
import { bucketize, type Bucket, type Period } from "@/lib/aggregate";
import { shortDate, usd, weekLabel } from "@/lib/format";
import { Card, Segmented } from "../ui";
import { ChartEmpty, gridProps, LegendKey, SERIES, TooltipCard, xAxisProps, yAxisProps } from "./kit";

type Mode = "volume" | "share";

export function MakerTakerCard({ fills, rangeStart, now, stats }: {
  fills: Fill[];
  rangeStart: number;
  now: number;
  stats: AccountStats | null;
}) {
  const [period, setPeriod] = useState<Period>("day");
  const [mode, setMode] = useState<Mode>("volume");

  const rows = useMemo(() => {
    const buckets = bucketize(fills, period, rangeStart, now);
    const first = buckets.findIndex((b) => b.trades > 0);
    return buckets.slice(Math.max(0, first));
  }, [fills, period, rangeStart, now]);

  const maker = fills.reduce((s, f) => s + (f.role === "MAKER" ? f.notional : 0), 0);
  const taker = fills.reduce((s, f) => s + (f.role === "TAKER" ? f.notional : 0), 0);
  const total = maker + taker;
  // What taking liquidity cost versus posting the same volume as maker orders, at the current tier.
  const extra = stats ? (taker * (stats.tier.takerFeePpm - stats.tier.makerFeePpm)) / 1e6 : null;
  const label = (s: number) => (period === "day" ? shortDate(s) : weekLabel(s));

  return (
    <Card title="Maker vs. taker" subtitle="Maker orders rest on the book and pay less. Taker orders fill instantly and pay more." delay={100}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Segmented label="Show" value={mode} onChange={setMode}
          options={[{ value: "volume", label: "Volume" }, { value: "share", label: "Share" }]} />
        <Segmented label="Group by" value={period} onChange={setPeriod}
          options={[{ value: "day", label: "Daily" }, { value: "week", label: "Weekly" }]} />
      </div>

      {fills.length === 0 ? (
        <ChartEmpty />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-4">
            <LegendKey color={SERIES.primary} label="Maker" value={`${Math.round((maker / total) * 100)}%`} />
            <LegendKey color={SERIES.secondary} label="Taker" value={`${Math.round((taker / total) * 100)}%`} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} stackOffset={mode === "share" ? "expand" : "none"} barCategoryGap="22%"
                margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="start" tickFormatter={(v) => shortDate(v)} {...xAxisProps} />
                <YAxis {...yAxisProps} width={52}
                  tickFormatter={(v) => (mode === "share" ? `${Math.round(v * 100)}%` : usd(v, { compact: true }))} />
                <Tooltip cursor={{ fill: "var(--fill-2)" }} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const b = payload[0].payload as Bucket;
                  const share = (v: number) => (b.volume > 0 ? ` · ${Math.round((v / b.volume) * 100)}%` : "");
                  return (
                    <TooltipCard title={label(b.start)} rows={[
                      { label: "Maker", value: `${usd(b.makerVolume, { compact: true })}${share(b.makerVolume)}`, color: SERIES.primary },
                      { label: "Taker", value: `${usd(b.takerVolume, { compact: true })}${share(b.takerVolume)}`, color: SERIES.secondary },
                    ]} />
                  );
                }} />
                {/* The 2px surface stroke is the gap between stacked segments. */}
                <Bar dataKey="makerVolume" stackId="v" fill={SERIES.primary} stroke="var(--card)" strokeWidth={2}
                  maxBarSize={24} isAnimationActive={false} />
                <Bar dataKey="takerVolume" stackId="v" fill={SERIES.secondary} stroke="var(--card)" strokeWidth={2}
                  radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {extra != null && extra > 0.005 && (
            <p className="mt-4 rounded-[12px] bg-fill-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2">
              Taking liquidity cost you <span className="tabular font-medium text-ink">{usd(extra, { cents: true })}</span> more
              than placing the same {usd(taker, { compact: true })} as maker orders would have at your current tier.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
