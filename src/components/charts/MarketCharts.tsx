"use client";

import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Market } from "@/lib/arcus";
import { usd } from "@/lib/format";
import { Card } from "../ui";
import { axisTick, SERIES, TooltipCard } from "./kit";

const COUNT = 12;
const short = (m: Market) => m.name.replace("-USD", "");
const pctChange = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(2)}%`;

function Skeleton() {
  return <div className="space-y-2.5">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-6 w-full" />)}</div>;
}

/** 24h price change for the most-traded markets — diverging around zero: up green, down red. */
export function MoversCard({ markets }: { markets: Market[] | null }) {
  const rows = (markets ?? []).slice(0, COUNT).map((m) => ({ ...m, label: short(m) })).sort((a, b) => b.change24h - a.change24h);
  return (
    <Card title="24h price change" subtitle={`The ${COUNT} most-traded markets, best to worst.`} delay={60}>
      {!markets ? <Skeleton /> : (
        <div style={{ height: rows.length * 30 + 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap={6}>
              {/* Always include zero, with headroom on each side for the outside-the-bar labels. */}
              <XAxis type="number" hide
                domain={[(min: number) => Math.min(0, min) * 1.45, (max: number) => Math.max(0, max) * 1.45]} />
              <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} width={56}
                tick={{ ...axisTick, fill: "var(--text)", fontSize: 12 }} />
              <ReferenceLine x={0} stroke="var(--text-3)" strokeWidth={1} />
              <Tooltip cursor={{ fill: "var(--fill-2)" }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const m = payload[0].payload as Market;
                return (
                  <TooltipCard title={m.assetName} rows={[
                    { label: "24h change", value: pctChange(m.change24h) },
                    { label: "Price", value: `$${m.price.toLocaleString("en-US", { maximumFractionDigits: 4 })}` },
                    { label: "Volume", value: usd(m.volume24h, { compact: true }) },
                  ]} />
                );
              }} />
              <Bar dataKey="change24h" maxBarSize={16} radius={4} isAnimationActive={false}>
                {rows.map((m) => <Cell key={m.name} fill={m.change24h >= 0 ? SERIES.primary : SERIES.down} />)}
                <LabelList dataKey="change24h" content={(p) => {
                  const { x, y, width, height, value } = p as { x: number; y: number; width: number; height: number; value: number };
                  // Outside the bar end: right of positive bars, left of negative ones.
                  const end = value >= 0 ? x + width + 6 : x + width - 6;
                  return (
                    <text x={end} y={y + height / 2} dominantBaseline="central" textAnchor={value >= 0 ? "start" : "end"}
                      fontSize={11} fontWeight={600} fill="var(--text)">{pctChange(value)}</text>
                  );
                }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-3 flex gap-4 text-[12px] text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SERIES.primary }} />Up</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SERIES.down }} />Down</span>
      </div>
    </Card>
  );
}

/** Where the exchange's 24h volume is concentrated. */
export function VolumeShareCard({ markets }: { markets: Market[] | null }) {
  const all = markets ?? [];
  const total = all.reduce((s, m) => s + m.volume24h, 0);
  const top = all.slice(0, COUNT - 1).map((m) => ({ label: short(m), name: m.assetName, volume: m.volume24h, other: false }));
  const rest = all.slice(COUNT - 1);
  const rows = rest.length
    ? [...top, { label: "Other", name: `${rest.length} other markets`, volume: rest.reduce((s, m) => s + m.volume24h, 0), other: true }]
    : top;
  const topShare = total > 0 && all.length >= 3 ? ((all[0].volume24h + all[1].volume24h + all[2].volume24h) / total) * 100 : 0;

  return (
    <Card title="Volume by market" subtitle={total > 0 ? `The top 3 markets carry ${Math.round(topShare)}% of 24h volume.` : "Share of 24h volume."} delay={100}>
      {!markets ? <Skeleton /> : (
        <div style={{ height: rows.length * 30 + 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 104, bottom: 0, left: 0 }} barCategoryGap={6}>
              <XAxis type="number" hide domain={[0, "dataMax"]} />
              <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} width={56}
                tick={{ ...axisTick, fill: "var(--text)", fontSize: 12 }} />
              <Tooltip cursor={{ fill: "var(--fill-2)" }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as (typeof rows)[number];
                return (
                  <TooltipCard title={r.name} rows={[
                    { label: "24h volume", value: usd(r.volume, { compact: true }) },
                    { label: "Share", value: `${((r.volume / total) * 100).toFixed(1)}%` },
                  ]} />
                );
              }} />
              <Bar dataKey="volume" maxBarSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {rows.map((r) => <Cell key={r.label} fill={r.other ? "var(--text-3)" : SERIES.primary} />)}
                <LabelList dataKey="volume" content={(p) => {
                  const { x, y, width, height, value } = p as { x: number; y: number; width: number; height: number; value: number };
                  return (
                    <text x={x + width + 6} y={y + height / 2} dominantBaseline="central" fontSize={11}>
                      <tspan fill="var(--text)" fontWeight={600}>{usd(value, { compact: true })}</tspan>
                      <tspan fill="var(--text-3)" dx={5}>{total > 0 ? Math.round((value / total) * 100) : 0}%</tspan>
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
