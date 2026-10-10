"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ActivitySummary } from "@/lib/activity";
import { num, shortAddress, usd } from "@/lib/format";
import { Card, Segmented, Stat } from "./ui";
import { DegenAvatar } from "./DegenAvatar";
import { gridProps, SERIES, TooltipCard, xAxisProps, yAxisProps } from "./charts/kit";

const DAY = 86_400_000;
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dayLabel = (d: string) => dayFmt.format(Date.parse(`${d}T00:00:00Z`));

/** Exact unique traders on Arcus by day, week and month, plus the most active wallets. */
export function ActiveTradersCard({ onSelect }: { onSelect: (address: string) => void }) {
  const [data, setData] = useState<ActivitySummary | null | undefined>(undefined);
  const [list, setList] = useState<"today" | "week">("today");

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d?.summary ?? null))
      .catch(() => setData(null));
  }, []);

  if (data === undefined) return <Card title="Active traders"><div className="skeleton h-64 w-full" /></Card>;
  if (data === null) {
    return (
      <Card title="Active traders" subtitle="Unique wallets trading on Arcus.">
        <p className="py-6 text-center text-[14px] text-ink-3">Collecting the first trades — check back in a few minutes.</p>
      </Card>
    );
  }

  const covered = data.coveredFrom ?? data.since ?? data.generatedAt;
  const todayStart = Date.parse(`${data.daily.at(-1)!.day}T00:00:00Z`);
  // A figure is complete only if every market's trades are recorded since that period began.
  const partial = (start: number) => covered > start;
  const hint = (start: number) => (partial(start) ? `Partial — counted since ${dayFmt.format(covered)}` : undefined);
  const chart = data.daily.filter((d) => d.traders > 0);
  const top = list === "today" ? data.topToday : data.topWeek;

  return (
    <Card title="Active traders"
      subtitle="Exact count of unique wallets that made or took at least one trade on Arcus. Days are UTC; updated every 10 minutes.">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <Stat label="Today so far" tone="accent" value={num(data.today)} hint={hint(todayStart) ?? "Since 00:00 UTC"} />
        <Stat label="Yesterday" value={num(data.yesterday)} hint={hint(todayStart - DAY) ?? "Full UTC day"} />
        <Stat label="Last 7 days" value={num(data.week)} hint={hint(todayStart - 6 * DAY) ?? "Unique across the week"} />
        <Stat label="Last 30 days" value={num(data.month)} hint={hint(todayStart - 29 * DAY) ?? "Unique across the month"} />
      </div>

      {chart.length > 1 && (
        <div className="mt-6 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="day" tickFormatter={dayLabel} {...xAxisProps} />
              <YAxis tickFormatter={(v) => num(v)} {...yAxisProps} width={48} />
              <Tooltip cursor={{ fill: "var(--fill-2)" }} content={({ active, payload }) => {
                const d = payload?.[0]?.payload as ActivitySummary["daily"][number] | undefined;
                if (!active || !d) return null;
                const start = Date.parse(`${d.day}T00:00:00Z`);
                return (
                  <TooltipCard title={dayLabel(d.day)} rows={[
                    { label: "Active traders", value: num(d.traders), color: SERIES.primary },
                    { label: "Trades", value: num(d.trades) },
                    { label: "Volume", value: usd(d.volume, { compact: true }) },
                  ]} note={partial(start) ? "Partial day — collection started mid-day" : start === todayStart ? "Today, so far" : undefined} />
                );
              }} />
              <Bar dataKey="traders" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
                {chart.map((d) => {
                  const start = Date.parse(`${d.day}T00:00:00Z`);
                  return <Cell key={d.day} fill={SERIES.primary} fillOpacity={partial(start) || start === todayStart ? 0.4 : 1} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-6 border-t border-hairline pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[15px] font-semibold">Most active wallets</p>
          <Segmented label="Period" value={list} onChange={setList}
            options={[{ value: "today", label: "Today" }, { value: "week", label: "7 days" }]} />
        </div>
        {top.length === 0 ? <p className="text-[14px] text-ink-3">No trades recorded yet.</p> : (
          <ol className="tabular grid gap-1 sm:grid-cols-2">
            {top.map((t, i) => (
              <li key={t.address}>
                <button onClick={() => onSelect(t.address)}
                  className="flex w-full items-center gap-3 rounded-[12px] px-2 py-1.5 text-left text-[14px] transition hover:bg-fill-2">
                  <span className={`w-6 text-center text-[13px] font-semibold ${i < 3 ? "text-ink" : "text-ink-3"}`}>{i + 1}</span>
                  <DegenAvatar address={t.address} size={26} />
                  <span className="flex-1 truncate font-mono text-[13px]">{shortAddress(t.address)}</span>
                  <span className="text-ink-2">{num(t.trades)} trades</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="mt-4 text-[12px] text-ink-3">
        Counted from every public trade on Arcus{data.since ? `, recorded since ${new Date(data.since).toUTCString().slice(5, 22)} UTC` : ""}.
        Older history is filled in automatically, up to 30 days.
      </p>
    </Card>
  );
}
