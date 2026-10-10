"use client";

import { useState } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Totals } from "@/lib/aggregate";
import { bps } from "@/lib/aggregate";
import { bpsLabel, usd } from "@/lib/format";
import { Card, Segmented } from "../ui";
import { axisTick, ChartEmpty, SERIES, TooltipCard } from "./kit";

type Metric = "fees" | "volume";
const TOP = 7;

export function MarketFeesCard({ totals }: { totals: Totals }) {
  const [metric, setMetric] = useState<Metric>("fees");
  const sorted = [...totals.byMarket].sort((a, b) => b[metric] - a[metric]);
  const rest = sorted.slice(TOP);
  // Past seven markets the tail folds into "Other" rather than growing the chart.
  const rows = [
    ...sorted.slice(0, TOP).map((m) => ({ ...m, name: m.market.replace("-USD", ""), other: false })),
    ...(rest.length
      ? [{ market: `${rest.length} others`, name: "Other", volume: rest.reduce((s, m) => s + m.volume, 0), fees: rest.reduce((s, m) => s + m.fees, 0), other: true }]
      : []),
  ];
  const total = metric === "fees" ? totals.fees : totals.volume;
  const color = metric === "fees" ? SERIES.secondary : SERIES.primary;
  const fmt = (v: number) => (metric === "fees" ? usd(v, { cents: v < 100 }) : usd(v, { compact: true }));

  return (
    <Card title="By market" subtitle="Where your volume goes, and what each market costs you." delay={120}
      action={<Segmented label="Measure" value={metric} onChange={setMetric}
        options={[{ value: "fees", label: "Fees" }, { value: "volume", label: "Volume" }]} />}>
      {rows.length === 0 ? (
        <ChartEmpty />
      ) : (
        <div style={{ height: rows.length * 36 + 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 96, bottom: 0, left: 0 }} barCategoryGap={8}>
              {/* Maker rebates can make a market's net fees negative, so let the axis dip below zero. */}
              <XAxis type="number" hide domain={[(min: number) => Math.min(0, min), "dataMax"]} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={64}
                tick={{ ...axisTick, fill: "var(--text)", fontSize: 13 }} />
              <Tooltip cursor={{ fill: "var(--fill-2)" }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as (typeof rows)[number];
                return (
                  <TooltipCard title={r.market} rows={[
                    { label: "Volume", value: usd(r.volume, { compact: true }) },
                    { label: "Fees", value: usd(r.fees, { cents: true }) },
                    { label: "Rate", value: bpsLabel(bps(r.fees, r.volume)) },
                    { label: "Share", value: total > 0 ? `${((r[metric] / total) * 100).toFixed(1)}%` : "—" },
                  ]} />
                );
              }} />
              <Bar dataKey={metric} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
                {rows.map((r) => <Cell key={r.name} fill={r.other ? "var(--text-3)" : color} />)}
                <LabelList dataKey={metric} content={(p) => {
                  const { x, y, width, height, value } = p as { x: number; y: number; width: number; height: number; value: number };
                  const share = total > 0 ? Math.round((value / total) * 100) : 0;
                  return (
                    <text x={x + width + 8} y={y + height / 2} dominantBaseline="central" fontSize={12}>
                      <tspan fill="var(--text)" fontWeight={600}>{fmt(value)}</tspan>
                      <tspan fill="var(--text-3)" dx={6}>{share}%</tspan>
                    </text>
                  );
                }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
