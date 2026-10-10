"use client";

import type { ReactNode } from "react";

// Shared chart chrome: recessive hairline axes and grid, solid tooltips, legend keys.
// Series colours come from the validated --chart-* tokens in globals.css.

export const SERIES = {
  primary: "var(--chart-1)",
  secondary: "var(--chart-2)",
  down: "var(--chart-down)",
} as const;

export const axisTick = { fill: "var(--text-3)", fontSize: 11 };

export const xAxisProps = {
  axisLine: { stroke: "var(--hairline)" },
  tickLine: false,
  tick: axisTick,
  minTickGap: 20,
} as const;

export const yAxisProps = {
  axisLine: false,
  tickLine: false,
  tick: axisTick,
  width: 64,
} as const;

export const gridProps = { vertical: false, stroke: "var(--hairline)" } as const;

/** Marker ring in the surface colour, so active dots stay legible over lines and bars. */
export const activeDot = (color: string) => ({ r: 5, fill: color, stroke: "var(--card)", strokeWidth: 2 });

export function TooltipCard({ title, rows, note }: {
  title: ReactNode;
  rows: { label: string; value: ReactNode; color?: string }[];
  note?: ReactNode;
}) {
  return (
    <div className="tabular min-w-[168px] rounded-[12px] bg-card px-3 py-2.5 text-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.16)] ring-1 ring-hairline">
      <p className="mb-1.5 font-semibold text-ink">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-6 py-[1px]">
          <span className="flex items-center gap-1.5 text-ink-2">
            {r.color && <span className="h-2 w-2 rounded-[2px]" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="font-medium text-ink">{r.value}</span>
        </p>
      ))}
      {note && <p className="mt-1.5 border-t border-hairline pt-1.5 text-[11px] text-ink-3">{note}</p>}
    </div>
  );
}

export function LegendKey({ color, label, value, line }: { color: string; label: string; value?: ReactNode; line?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
      <span className={line ? "h-[2px] w-3.5 rounded-full" : "h-2.5 w-2.5 rounded-[3px]"} style={{ background: color }} />
      {label}
      {value != null && <span className="tabular font-medium text-ink">{value}</span>}
    </span>
  );
}

export function ChartEmpty({ children = "No trades in this period." }: { children?: ReactNode }) {
  return <div className="grid h-56 place-items-center text-center text-[14px] text-ink-3">{children}</div>;
}
