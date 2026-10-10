"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Fill } from "@/lib/arcus";
import { bps, sizeBins, type SizeBin } from "@/lib/aggregate";
import { bpsLabel, num, usd } from "@/lib/format";
import { Card, Segmented } from "../ui";
import { ChartEmpty, gridProps, SERIES, TooltipCard, xAxisProps, yAxisProps } from "./kit";

type Metric = "trades" | "volume" | "fees";

export function TradeSizeCard({ fills }: { fills: Fill[] }) {
  const [metric, setMetric] = useState<Metric>("trades");
  const bins = useMemo(() => sizeBins(fills), [fills]);
  const total = bins.reduce((s, b) => s + b[metric], 0);
  const peak = bins.reduce((best, b, i) => (b[metric] > bins[best][metric] ? i : best), 0);
  const color = metric === "fees" ? SERIES.secondary : SERIES.primary;
  const fmt = (v: number) => (metric === "trades" ? num(v) : metric === "fees" ? usd(v, { cents: v < 100 }) : usd(v, { compact: true }));
  const avgSize = fills.length ? fills.reduce((s, f) => s + f.notional, 0) / fills.length : 0;

  return (
    <Card title="Trade sizes" subtitle={fills.length ? `Average trade ${usd(avgSize, { compact: true })}. Each bar is a size range.` : "Each bar is a size range."}
      delay={160}
      action={<Segmented label="Measure" value={metric} onChange={setMetric}
        options={[{ value: "trades", label: "Count" }, { value: "volume", label: "Volume" }, { value: "fees", label: "Fees" }]} />}>
      {fills.length === 0 ? (
        <ChartEmpty />
      ) : (
        <>
          <p className="mb-3 text-[13px] text-ink-2">
            Most {metric === "trades" ? "of your trades" : metric === "volume" ? "of your volume" : "of your fees"} come from{" "}
            <span className="font-medium text-ink">{bins[peak].label}</span> trades
            {total > 0 && <span className="tabular"> ({Math.round((bins[peak][metric] / total) * 100)}%)</span>}.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bins} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...xAxisProps} interval={0} />
                <YAxis {...yAxisProps} width={52} tickFormatter={(v) => (metric === "trades" ? num(v) : usd(v, { compact: true }))} />
                <Tooltip cursor={{ fill: "var(--fill-2)" }} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const b = payload[0].payload as SizeBin;
                  return (
                    <TooltipCard title={`${b.label} trades`} rows={[
                      { label: "Trades", value: num(b.trades) },
                      { label: "Volume", value: usd(b.volume, { compact: true }) },
                      { label: "Fees", value: usd(b.fees, { cents: true }) },
                      { label: "Rate", value: b.volume > 0 ? bpsLabel(bps(b.fees, b.volume)) : "—" },
                    ]} />
                  );
                }} />
                <Bar dataKey={metric} fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
                  <LabelList dataKey={metric} content={(p) => {
                    const { x, y, width, index, value } = p as { x: number; y: number; width: number; index: number; value: number };
                    if (index !== peak || !value) return null;
                    return (
                      <text x={x + width / 2} y={y - 7} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)">
                        {fmt(value)}
                      </text>
                    );
                  }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}
