"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Fill, FundingPayment } from "@/lib/arcus";
import { dayStart, weekStart, type Period } from "@/lib/aggregate";
import { shortDate, usd, weekLabel } from "@/lib/format";
import { Card, Segmented, Stat } from "../ui";
import { activeDot, ChartEmpty, gridProps, SERIES, TooltipCard, xAxisProps, yAxisProps } from "./kit";

type View = "period" | "running" | "breakdown";

interface Row {
  start: number;
  gross: number; // realised trading PnL before fees
  fees: number;
  funding: number; // net, + received
  net: number;
}

const signed = (v: number) => `${v >= 0 ? "+" : "−"}${usd(Math.abs(v), { compact: Math.abs(v) >= 10_000, cents: Math.abs(v) < 10_000 })}`;

/** Realised trading PnL (Arcus `closedPnl`, already net of fees) plus funding, per period. */
export function ProfitCard({ fills, funding, rangeStart, now }: {
  fills: Fill[];
  funding: FundingPayment[] | null;
  rangeStart: number;
  now: number;
}) {
  const [period, setPeriod] = useState<Period>("week");
  const [view, setView] = useState<View>("period");

  const rows = useMemo<Row[]>(() => {
    const startOf = period === "day" ? dayStart : weekStart;
    const step = period === "day" ? 86_400_000 : 7 * 86_400_000;
    const map = new Map<number, Row>();
    for (let t = startOf(rangeStart); t <= now; t += step) map.set(t, { start: t, gross: 0, fees: 0, funding: 0, net: 0 });
    const row = (ms: number) => {
      const k = startOf(ms);
      let r = map.get(k);
      if (!r) map.set(k, (r = { start: k, gross: 0, fees: 0, funding: 0, net: 0 }));
      return r;
    };
    for (const f of fills) {
      const r = row(f.createdAt / 1000);
      r.net += f.pnl;
      r.fees += f.fee;
      r.gross += f.pnl + f.fee;
    }
    for (const p of funding ?? []) {
      if (p.time / 1000 < rangeStart) continue;
      const r = row(p.time / 1000);
      r.funding += p.payment;
      r.net += p.payment;
    }
    const sorted = [...map.values()].sort((a, b) => a.start - b.start);
    const first = sorted.findIndex((r) => r.gross !== 0 || r.fees !== 0 || r.funding !== 0);
    return sorted.slice(Math.max(0, first));
  }, [fills, funding, period, rangeStart, now]);

  const total = rows.reduce((t, r) => ({ gross: t.gross + r.gross, fees: t.fees + r.fees, funding: t.funding + r.funding, net: t.net + r.net }),
    { gross: 0, fees: 0, funding: 0, net: 0 });
  const running: (Row & { cum: number })[] = [];
  for (const r of rows) running.push({ ...r, cum: (running.at(-1)?.cum ?? 0) + r.net });
  const label = (s: number) => (period === "day" ? shortDate(s) : weekLabel(s));
  const greenWeeks = rows.filter((r) => r.net > 0).length;

  // Waterfall: each step floats from where the previous one ended.
  const steps = [
    { name: "Trading", value: total.gross },
    { name: "Fees", value: -total.fees },
    { name: "Funding", value: total.funding },
  ];
  const waterfall: { name: string; base: number; size: number; value: number; total: boolean }[] = [];
  let level = 0;
  for (const st of steps) {
    const from = level;
    level += st.value;
    waterfall.push({ name: st.name, base: Math.min(from, level), size: Math.abs(st.value), value: st.value, total: false });
  }
  waterfall.push({ name: "Net", base: Math.min(0, level), size: Math.abs(level), value: level, total: true });

  const tooltip = ({ active, payload }: { active?: boolean; payload?: readonly { payload?: Row }[] }) => {
    const r = payload?.[0]?.payload;
    if (!active || !r) return null;
    return (
      <TooltipCard title={label(r.start)} rows={[
        { label: "Trading, before fees", value: signed(r.gross) },
        { label: "Fees", value: signed(-r.fees) },
        { label: "Funding", value: signed(r.funding) },
        { label: "Net", value: signed(r.net) },
      ]} />
    );
  };

  return (
    <Card title="Profit after costs" subtitle="Realised trading profit, minus fees, plus or minus funding — what actually landed in your account." delay={60}>
      <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <Stat label="Trading, before fees" value={signed(total.gross)} loading={funding === null} />
        <Stat label="Fees" tone="orange" value={signed(-total.fees)} loading={funding === null} />
        <Stat label="Funding" value={signed(total.funding)} loading={funding === null} />
        <Stat label="Net result" tone={total.net >= 0 ? "green" : "orange"} value={signed(total.net)}
          hint={rows.length ? `${greenWeeks} of ${rows.length} ${period === "day" ? "days" : "weeks"} in profit` : undefined} loading={funding === null} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented label="Chart type" value={view} onChange={setView}
          options={[{ value: "period", label: "By period" }, { value: "running", label: "Running total" }, { value: "breakdown", label: "Breakdown" }]} />
        {view !== "breakdown" && (
          <div className="ml-auto">
            <Segmented label="Group by" value={period} onChange={setPeriod}
              options={[{ value: "day", label: "Daily" }, { value: "week", label: "Weekly" }]} />
          </div>
        )}
      </div>

      {funding === null ? <div className="skeleton h-64 w-full" /> : rows.length === 0 ? <ChartEmpty /> : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {view === "period" ? (
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="start" tickFormatter={(v) => shortDate(v)} {...xAxisProps} />
                <YAxis tickFormatter={(v) => usd(v, { compact: true })} {...yAxisProps} />
                <ReferenceLine y={0} stroke="var(--text-3)" strokeWidth={1} />
                <Tooltip cursor={{ fill: "var(--fill-2)" }} content={tooltip} />
                <Bar dataKey="net" maxBarSize={24} radius={4} isAnimationActive={false}>
                  {rows.map((r) => <Cell key={r.start} fill={r.net >= 0 ? SERIES.primary : SERIES.down} />)}
                </Bar>
              </BarChart>
            ) : view === "running" ? (
              <AreaChart data={running} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="start" tickFormatter={(v) => shortDate(v)} {...xAxisProps} />
                <YAxis tickFormatter={(v) => usd(v, { compact: true })} {...yAxisProps} />
                <ReferenceLine y={0} stroke="var(--text-3)" strokeWidth={1} />
                <Tooltip cursor={{ stroke: "var(--text-3)", strokeWidth: 1 }} content={({ active, payload }) => {
                  const r = payload?.[0]?.payload as (Row & { cum: number }) | undefined;
                  if (!active || !r) return null;
                  return <TooltipCard title={label(r.start)} rows={[{ label: "Net so far", value: signed(r.cum) }, { label: "This period", value: signed(r.net) }]} />;
                }} />
                <Area dataKey="cum" type="monotone" stroke={total.net >= 0 ? SERIES.primary : SERIES.down} strokeWidth={2}
                  fill={total.net >= 0 ? SERIES.primary : SERIES.down} fillOpacity={0.1} dot={false}
                  activeDot={activeDot(total.net >= 0 ? SERIES.primary : SERIES.down)} isAnimationActive={false} />
              </AreaChart>
            ) : (
              <BarChart data={waterfall} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...xAxisProps} />
                <YAxis tickFormatter={(v) => usd(v, { compact: true })} {...yAxisProps} />
                <ReferenceLine y={0} stroke="var(--text-3)" strokeWidth={1} />
                <Tooltip cursor={{ fill: "var(--fill-2)" }} content={({ active, payload }) => {
                  const r = payload?.[0]?.payload as (typeof waterfall)[number] | undefined;
                  if (!active || !r) return null;
                  return <TooltipCard title={r.name} rows={[{ label: r.total ? "Net result" : "Effect", value: signed(r.value) }]} />;
                }} />
                <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="size" stackId="w" maxBarSize={56} radius={4} isAnimationActive={false}>
                  {waterfall.map((w) => (
                    <Cell key={w.name} fill={w.total ? "var(--text-2)" : w.value >= 0 ? SERIES.primary : SERIES.down} />
                  ))}
                  <LabelList dataKey="value" content={(p) => {
                    const { x, y, width, value } = p as { x: number; y: number; width: number; value: number };
                    return <text x={x + width / 2} y={y - 7} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)">{signed(value)}</text>;
                  }} />
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-3 text-[12px] text-ink-3">
        Realised only: open positions aren&apos;t counted until they close. Trading profit uses Arcus&apos;s per-trade figure, which already
        subtracts each trade&apos;s fee.
      </p>
    </Card>
  );
}
