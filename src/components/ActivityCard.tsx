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
import type { Fill } from "@/lib/arcus";
import { bucketize, bps, weekStart, dayStart, type Bucket, type Period, type Totals } from "@/lib/aggregate";
import { bpsLabel, num, shortDate, usd, weekLabel } from "@/lib/format";
import { Card, Pagination, Segmented, usePagination } from "./ui";
import { activeDot, ChartEmpty, gridProps, SERIES, TooltipCard, xAxisProps, yAxisProps } from "./charts/kit";

type Metric = "volume" | "fees" | "rate" | "trades";
type View = "bars" | "line" | "cumulative" | "table";

// One measure at a time on one axis — volume and fees have different scales, so they never share a plot.
const METRICS: Record<Metric, { label: string; color: string; value: (b: Bucket) => number | null; fmt: (v: number) => string; tick: (v: number) => string }> = {
  volume: { label: "Volume", color: SERIES.primary, value: (b) => b.volume, fmt: (v) => usd(v, { compact: true }), tick: (v) => usd(v, { compact: true }) },
  fees: { label: "Fees", color: SERIES.secondary, value: (b) => b.fees, fmt: (v) => usd(v, { cents: true }), tick: (v) => usd(v, { compact: true }) },
  rate: { label: "Fee rate", color: SERIES.secondary, value: (b) => (b.volume > 0 ? bps(b.fees, b.volume) : null), fmt: bpsLabel, tick: (v) => `${v.toFixed(1)}` },
  trades: { label: "Trades", color: SERIES.primary, value: (b) => b.trades, fmt: (v) => num(Math.round(v)), tick: (v) => num(v) },
};

interface Row {
  start: number;
  value: number | null;
  partial: boolean;
  bucket: Bucket;
}

export function ActivityCard({
  fills,
  rangeStart,
  now,
  totals,
  loading,
}: {
  fills: Fill[];
  rangeStart: number;
  now: number;
  totals: Totals;
  loading: boolean;
}) {
  const [period, setPeriod] = useState<Period>("day");
  const [metric, setMetric] = useState<Metric>("volume");
  const [view, setView] = useState<View>("bars");
  const m = METRICS[metric];

  const rows = useMemo<Row[]>(() => {
    const buckets = bucketize(fills, period, rangeStart, now);
    // Skip the empty stretch before the first trade so the activity fills the plot.
    const first = buckets.findIndex((b) => b.trades > 0);
    const current = period === "day" ? dayStart(now) : weekStart(now);
    const out: Row[] = [];
    let cumVol = 0;
    let cumFees = 0;
    let cum = 0;
    for (const b of buckets.slice(Math.max(0, first))) {
      cumVol += b.volume;
      cumFees += b.fees;
      let value = m.value(b);
      if (view === "cumulative") {
        if (metric === "rate") value = cumVol > 0 ? bps(cumFees, cumVol) : null;
        else value = cum += value ?? 0;
      }
      out.push({ start: b.start, value, partial: b.start === current, bucket: b });
    }
    return out;
  }, [fills, period, rangeStart, now, view, metric, m]);

  const label = (start: number) => (period === "day" ? shortDate(start) : weekLabel(start));
  const complete = rows.filter((r) => !r.partial && r.value != null);
  const avg = metric === "rate"
    ? bps(totals.fees, totals.volume)
    : complete.length ? complete.reduce((s, r) => s + (r.value ?? 0), 0) / complete.length : 0;
  const peakIndex = rows.reduce((best, r, i) => ((r.value ?? -Infinity) > (rows[best]?.value ?? -Infinity) ? i : best), 0);
  const peak = rows[peakIndex];

  const tooltip = ({ active, payload }: { active?: boolean; payload?: readonly { payload?: Row }[] }) => {
    if (!active || !payload?.length) return null;
    const r = payload[0].payload;
    if (!r) return null;
    const b = r.bucket;
    return (
      <TooltipCard
        title={label(r.start)}
        rows={[
          { label: view === "cumulative" ? `${m.label}, running` : m.label, value: r.value == null ? "—" : m.fmt(r.value), color: m.color },
          ...(metric !== "volume" ? [{ label: "Volume", value: usd(b.volume, { compact: true }) }] : []),
          ...(metric !== "fees" ? [{ label: "Fees", value: usd(b.fees, { cents: true }) }] : []),
          ...(metric !== "rate" ? [{ label: "Rate", value: b.volume > 0 ? bpsLabel(bps(b.fees, b.volume)) : "—" }] : []),
          ...(metric !== "trades" ? [{ label: "Trades", value: num(b.trades) }] : []),
        ]}
        note={r.partial ? `${period === "day" ? "Today" : "This week"} is still in progress` : undefined}
      />
    );
  };

  return (
    <Card
      title="Volume & fees"
      subtitle={`${num(totals.trades)} trades · ${usd(totals.volume, { compact: true })} volume · ${usd(totals.fees, { compact: true })} fees · ${bpsLabel(bps(totals.fees, totals.volume))} average`}
      delay={80}
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Segmented label="Measure" value={metric} onChange={setMetric}
          options={[
            { value: "volume", label: "Volume" },
            { value: "fees", label: "Fees" },
            { value: "rate", label: "Fee rate" },
            { value: "trades", label: "Trades" },
          ]} />
        <Segmented label="Chart type" value={view} onChange={setView}
          options={[
            { value: "bars", label: "Bars" },
            { value: "line", label: "Line" },
            { value: "cumulative", label: "Running total" },
            { value: "table", label: "Table" },
          ]} />
        <div className="ml-auto">
          <Segmented label="Group by" value={period} onChange={setPeriod}
            options={[{ value: "day", label: "Daily" }, { value: "week", label: "Weekly" }]} />
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-72 w-full" />
      ) : fills.length === 0 ? (
        <ChartEmpty />
      ) : view === "table" ? (
        <ActivityTable rows={rows} label={label} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-[13px] text-ink-2">
            <span>
              {view === "cumulative"
                ? metric === "rate" ? "Average fee rate so far (bps)" : `${m.label} added up over time`
                : `${m.label} per ${period}${metric === "rate" ? " (bps)" : ""}`}
            </span>
            {peak?.value != null && view !== "cumulative" && (
              <span>
                Peak <span className="tabular font-medium text-ink">{m.fmt(peak.value)}</span> on {label(peak.start)}
              </span>
            )}
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {view === "bars" ? (
                <BarChart data={rows} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="start" tickFormatter={(v) => shortDate(v)} {...xAxisProps} />
                  <YAxis tickFormatter={m.tick} {...yAxisProps} />
                  <Tooltip cursor={{ fill: "var(--fill-2)" }} content={tooltip} />
                  {avg > 0 && (
                    <ReferenceLine y={avg} stroke="var(--text-3)" strokeWidth={1}
                      label={{ value: `avg ${m.fmt(avg)}`, position: "insideTopRight", fill: "var(--text-2)", fontSize: 11 }} />
                  )}
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
                    {rows.map((r) => (
                      <Cell key={r.start} fill={m.color} fillOpacity={r.partial ? 0.4 : 1} />
                    ))}
                    {/* Label only the peak — a value on every bar goes unread. */}
                    <LabelList dataKey="value" content={(p) => {
                      const { x, y, width, index, value } = p as { x: number; y: number; width: number; index: number; value: number };
                      if (index !== peakIndex || value == null) return null;
                      return (
                        <text x={x + width / 2} y={y - 7} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)">
                          {m.fmt(value)}
                        </text>
                      );
                    }} />
                  </Bar>
                </BarChart>
              ) : (
                <AreaChart data={rows} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="start" tickFormatter={(v) => shortDate(v)} {...xAxisProps} />
                  <YAxis tickFormatter={m.tick} {...yAxisProps} />
                  <Tooltip cursor={{ stroke: "var(--text-3)", strokeWidth: 1 }} content={tooltip} />
                  {view === "line" && avg > 0 && (
                    <ReferenceLine y={avg} stroke="var(--text-3)" strokeWidth={1}
                      label={{ value: `avg ${m.fmt(avg)}`, position: "insideTopRight", fill: "var(--text-2)", fontSize: 11 }} />
                  )}
                  <Area dataKey="value" type="monotone" stroke={m.color} strokeWidth={2} fill={m.color} fillOpacity={0.1}
                    connectNulls dot={false} activeDot={activeDot(m.color)} isAnimationActive={false} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
          {rows.some((r) => r.partial) && (
            <p className="mt-2 text-[12px] text-ink-3">
              {view === "bars" ? "The lighter bar is" : "The last point is"} {period === "day" ? "today" : "this week"}, still in progress.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function ActivityTable({ rows, label }: { rows: Row[]; label: (s: number) => string }) {
  const newestFirst = useMemo(() => [...rows].reverse(), [rows]);
  const paged = usePagination(newestFirst, 10);
  return (
    <>
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="tabular w-full min-w-[640px] text-[14px]">
        <thead>
          <tr className="text-left text-[12px] text-ink-2">
            <th className="px-5 pb-2 font-medium sm:px-6">Period</th>
            <th className="pb-2 text-right font-medium">Trades</th>
            <th className="pb-2 text-right font-medium">Volume</th>
            <th className="pb-2 text-right font-medium">Maker / Taker</th>
            <th className="pb-2 text-right font-medium">Fees</th>
            <th className="px-5 pb-2 text-right font-medium sm:px-6">Rate</th>
          </tr>
        </thead>
        <tbody>
          {paged.slice.map(({ bucket: b, partial }) => (
            <tr key={b.start} className="border-t border-hairline">
              <td className="px-5 py-2.5 sm:px-6">
                {label(b.start)}
                {partial && <span className="ml-2 rounded-full bg-fill-2 px-2 py-0.5 text-[11px] text-ink-2">In progress</span>}
              </td>
              <td className="text-right text-ink-2">{num(b.trades)}</td>
              <td className="text-right font-medium">{usd(b.volume, { compact: true })}</td>
              <td className="text-right text-ink-2">
                {b.volume > 0 ? `${Math.round((b.makerVolume / b.volume) * 100)}% / ${Math.round((b.takerVolume / b.volume) * 100)}%` : "—"}
              </td>
              <td className="text-right font-medium">{usd(b.fees, { cents: true })}</td>
              <td className="px-5 text-right text-ink-2 sm:px-6">{b.volume > 0 ? bpsLabel(bps(b.fees, b.volume)) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <Pagination {...paged} noun="periods" />
    </>
  );
}
