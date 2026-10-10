"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { isPartialWeek, weekStart, type Bucket } from "@/lib/aggregate";
import type { PointsMap } from "@/lib/points";
import { num, shortDate, usd, weekLabel } from "@/lib/format";
import { Card, Empty, Pagination, Stat, usePagination } from "./ui";

export function PointsCard({
  address,
  weeks,
  points,
  onChange,
  readOnly = false,
  rangeStart,
  now,
  loading,
}: {
  address: string;
  weeks: Bucket[]; // oldest first
  points: PointsMap;
  onChange: (points: PointsMap) => void;
  readOnly?: boolean; // combined wallets: totals only, edit per wallet
  rangeStart: number;
  now: number;
  loading: boolean;
}) {
  const setWeek = (start: number, raw: string) => {
    const next = { ...points };
    const v = Number(raw);
    if (raw === "" || !Number.isFinite(v) || v < 0) delete next[start];
    else next[start] = v;
    onChange(next);
  };

  const currentWeek = weekStart(now);
  const rows = [...weeks].reverse().map((w) => {
    const p = points[w.start];
    const partial = isPartialWeek(w.start, rangeStart, now);
    return { ...w, points: p, feePerPoint: p ? w.fees / p : null, volumePerPoint: p ? w.volume / p : null, partial };
  });
  const paged = usePagination(rows, 8, weeks);
  const scored = rows.filter((r) => r.points);
  const totalPoints = scored.reduce((s, r) => s + (r.points ?? 0), 0);
  const scoredFees = scored.reduce((s, r) => s + r.fees, 0);
  const scoredVolume = scored.reduce((s, r) => s + r.volume, 0);
  const cheapest = scored.reduce<(typeof rows)[number] | null>(
    (best, r) => (best === null || (r.feePerPoint ?? Infinity) < (best.feePerPoint ?? Infinity) ? r : best),
    null,
  );
  const chartData = [...scored].reverse();

  return (
    <Card
      title="Points tracker"
      subtitle="Enter the points Arcus gave you each week to see what each point cost in fees."
      delay={120}
    >
      <div className="mb-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat label="Points entered" value={totalPoints ? num(totalPoints) : "—"} hint={`${scored.length} of ${rows.length} weeks`} />
        <Stat label="Avg. fee per point" tone="orange" value={totalPoints ? usd(scoredFees / totalPoints, { cents: true }) : "—"}
          hint="Across weeks with points" />
        <Stat label="Avg. volume per point" tone="accent" value={totalPoints ? usd(scoredVolume / totalPoints, { compact: true }) : "—"}
          hint="Notional traded per point" />
        <Stat label="Cheapest week" tone="green" value={cheapest?.feePerPoint != null ? usd(cheapest.feePerPoint, { cents: true }) : "—"}
          hint={cheapest ? `Week of ${shortDate(cheapest.start)}` : "Per point"} />
      </div>

      {chartData.length > 1 && (
        <div className="mb-6 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--hairline)" />
              <XAxis dataKey="start" tickFormatter={(v) => shortDate(v)} tick={{ fill: "var(--text-3)", fontSize: 11 }}
                axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => usd(v, { cents: true })} tick={{ fill: "var(--text-3)", fontSize: 11 }}
                axisLine={false} tickLine={false} width={64} />
              <Tooltip cursor={{ fill: "var(--fill-2)" }}
                content={({ active, payload }) => active && payload?.length ? (
                  <div className="tabular rounded-[12px] bg-card px-3 py-2 text-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.16)] ring-1 ring-hairline">
                    <p className="font-semibold">{weekLabel(payload[0].payload.start)}</p>
                    <p className="text-ink-2">{usd(payload[0].payload.feePerPoint, { cents: true })} per point</p>
                  </div>
                ) : null} />
              <Bar dataKey="feePerPoint" fill="var(--orange)" radius={[5, 5, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {loading && weeks.every((w) => w.trades === 0) ? (
        <div className="skeleton h-48 w-full" />
      ) : rows.length === 0 ? (
        <Empty>No weeks in range.</Empty>
      ) : (
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="tabular w-full min-w-[680px] text-[14px]">
            <thead>
              <tr className="text-left text-[12px] text-ink-2">
                <th className="px-5 pb-2 font-medium sm:px-6">Week (UTC)</th>
                <th className="pb-2 text-right font-medium">Volume</th>
                <th className="pb-2 text-right font-medium">Fees</th>
                <th className="pb-2 pl-4 font-medium">Points</th>
                <th className="pb-2 text-right font-medium">Fee / point</th>
                <th className="px-5 pb-2 text-right font-medium sm:px-6">Volume / point</th>
              </tr>
            </thead>
            <tbody>
              {paged.slice.map((r) => (
                <tr key={r.start} className="border-t border-hairline">
                  <td className="px-5 py-2 sm:px-6">
                    {weekLabel(r.start)}
                    {r.partial && (
                      <span className="ml-2 rounded-full bg-fill-2 px-2 py-0.5 text-[11px] text-ink-2">
                        {r.start === currentWeek ? "In progress" : "Partial"}
                      </span>
                    )}
                  </td>
                  <td className="text-right">{usd(r.volume, { compact: true })}</td>
                  <td className="text-right text-orange">{usd(r.fees, { cents: true })}</td>
                  <td className="pl-4">
                    {readOnly ? (
                      <span className="tabular font-medium">{r.points != null ? num(r.points) : "—"}</span>
                    ) : (
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      placeholder="Add"
                      aria-label={`Points for week of ${shortDate(r.start)}`}
                      defaultValue={r.points ?? ""}
                      key={`${address}-${r.start}-${r.points ?? ""}`}
                      onBlur={(e) => setWeek(r.start, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      className="h-8 w-28 rounded-[8px] bg-fill-2 px-2.5 text-[14px] outline-none transition focus:bg-card focus:ring-2 focus:ring-accent placeholder:text-ink-3"
                    />
                    )}
                  </td>
                  <td className="text-right font-medium">{r.feePerPoint != null ? usd(r.feePerPoint, { cents: true }) : "—"}</td>
                  <td className="px-5 text-right text-ink-2 sm:px-6">{r.volumePerPoint != null ? usd(r.volumePerPoint, { compact: true }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && <Pagination {...paged} noun="weeks" />}
      <p className="mt-4 text-[12px] text-ink-3">
        Arcus doesn&apos;t publish a points API, so points are typed in here and saved only in this browser.
      </p>
    </Card>
  );
}
