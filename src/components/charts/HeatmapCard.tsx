"use client";

import { useMemo, useState } from "react";
import type { Fill } from "@/lib/arcus";
import { activityGrid, bps, type HeatCell } from "@/lib/aggregate";
import { bpsLabel, num, usd } from "@/lib/format";
import { Card, Segmented } from "../ui";
import { ChartEmpty } from "./kit";

type Metric = "volume" | "trades";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Sequential: one hue stepping from the surface to full strength. Empty cells stay neutral.
const STEPS = [18, 36, 56, 78, 100];
const stepColor = (i: number) => `color-mix(in srgb, var(--chart-1) ${STEPS[i]}%, var(--card))`;
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function HeatmapCard({ fills }: { fills: Fill[] }) {
  const [metric, setMetric] = useState<Metric>("volume");
  const [hover, setHover] = useState<HeatCell | null>(null);
  const cells = useMemo(() => activityGrid(fills), [fills]);

  // Quantile thresholds over active cells, so a single huge hour doesn't wash out the rest.
  const values = cells.map((c) => c[metric]).filter((v) => v > 0).sort((a, b) => a - b);
  const cuts = STEPS.slice(0, -1).map((_, i) => values[Math.floor(((i + 1) / STEPS.length) * values.length)] ?? Infinity);
  const step = (v: number) => cuts.filter((c) => v >= c).length;
  const busiest = cells.reduce((a, b) => (b[metric] > a[metric] ? b : a), cells[0]);
  const shown = hover ?? busiest;
  const fmt = (v: number) => (metric === "volume" ? usd(v, { compact: true }) : `${num(v)} trades`);

  return (
    <Card title="When you trade" subtitle="Your activity by day of week and hour, in UTC." delay={140}
      action={<Segmented label="Measure" value={metric} onChange={setMetric}
        options={[{ value: "volume", label: "Volume" }, { value: "trades", label: "Trades" }]} />}>
      {values.length === 0 ? (
        <ChartEmpty />
      ) : (
        <>
          <p className="mb-3 min-h-[20px] text-[13px] text-ink-2">
            <span className="font-medium text-ink">{DAYS[shown.day]} {hourLabel(shown.hour)}</span>
            {hover ? " · " : " is your busiest hour · "}
            <span className="tabular">{fmt(shown[metric])}</span>
            {shown.volume > 0 && <span className="tabular text-ink-3"> · {usd(shown.fees, { cents: true })} fees · {bpsLabel(bps(shown.fees, shown.volume))}</span>}
          </p>
          <div className="overflow-x-auto">
            <div className="min-w-[520px]" onMouseLeave={() => setHover(null)}>
              <div className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[2px]">
                {DAYS.map((d, day) => (
                  <div key={d} className="contents">
                    <span className="self-center text-[11px] text-ink-3">{d}</span>
                    {cells.slice(day * 24, day * 24 + 24).map((c) => {
                      const v = c[metric];
                      return (
                        <button key={c.hour} type="button"
                          aria-label={`${d} ${hourLabel(c.hour)}: ${fmt(v)}`}
                          onMouseEnter={() => setHover(c)} onFocus={() => setHover(c)}
                          className={`aspect-square rounded-[4px] outline-none transition focus-visible:ring-2 focus-visible:ring-ink ${
                            hover === c ? "ring-2 ring-ink" : ""}`}
                          style={{ background: v > 0 ? stepColor(step(v)) : "var(--fill-2)" }} />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-1.5 grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[2px] text-[10px] text-ink-3">
                <span />
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="text-center">{h % 3 === 0 ? String(h).padStart(2, "0") : ""}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-1.5 text-[11px] text-ink-3">
            Less
            <span className="h-3 w-3 rounded-[3px] bg-fill-2" />
            {STEPS.map((_, i) => <span key={i} className="h-3 w-3 rounded-[3px]" style={{ background: stepColor(i) }} />)}
            More
          </div>
        </>
      )}
    </Card>
  );
}
