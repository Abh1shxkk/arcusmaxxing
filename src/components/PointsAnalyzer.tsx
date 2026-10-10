"use client";

import { useState, type ReactNode } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import type { FeeTier } from "@/lib/arcus";
import type { Bucket } from "@/lib/aggregate";
import { buildModel, feesFor, tierForWeeklyVolume, type Driver } from "@/lib/pointsModel";
import { num, pct, usd, weekLabel } from "@/lib/format";
import { Card, Segmented, Select, Stat } from "./ui";

const MILLION = 1_000_000;

export function PointsAnalyzer({
  weeks,
  tiers,
  hasAddress,
}: {
  weeks: (Bucket & { points?: number })[];
  tiers: FeeTier[] | null;
  hasAddress: boolean;
}) {
  const model = buildModel(weeks);

  // Inputs stay null until edited, so they follow the model's defaults as data loads.
  const [volumeIn, setVolumeIn] = useState<string | null>(null);
  const [makerIn, setMakerIn] = useState<number | null>(null);
  const [tierIn, setTierIn] = useState<number | "auto">("auto");
  const [driverIn, setDriverIn] = useState<Driver | null>(null);
  const [rateIn, setRateIn] = useState<string | null>(null);
  const [valueIn, setValueIn] = useState("");
  const [horizon, setHorizon] = useState("4");
  const [useTrend, setUseTrend] = useState(true);

  const observed = weeks.filter((w) => w.points && w.volume > 0);
  const avgVolume = observed.length ? observed.reduce((s, w) => s + w.volume, 0) / observed.length : MILLION;
  const avgMaker = observed.length
    ? observed.reduce((s, w) => s + w.makerVolume, 0) / observed.reduce((s, w) => s + w.volume, 0)
    : 0.2;

  const driver: Driver = driverIn ?? model?.best ?? "fees";
  const modelRate = model ? (driver === "fees" ? model.byFees.rate : model.byVolume.rate * MILLION) : null;
  const rateText = rateIn ?? (modelRate != null ? round(modelRate) : "");
  const rate = Number(rateText) || 0; // points per $1 fees, or per $1M volume
  const volume = Number(volumeIn ?? Math.round(avgVolume)) || 0;
  const makerShare = makerIn ?? Math.round(avgMaker * 100) / 100;
  const weeksAhead = Math.max(1, Math.min(52, Number(horizon) || 1));
  const value = valueIn === "" ? null : Number(valueIn);

  const autoTier = tiers?.length ? tierForWeeklyVolume(tiers, volume) : undefined;
  const tier = tierIn === "auto" ? autoTier : tiers?.find((t) => t.level === tierIn);
  const weeklyFees = tier ? feesFor(volume, makerShare, tier) : 0;
  const weeklyPoints = Math.max(0, driver === "fees" ? weeklyFees * rate : (volume / MILLION) * rate);

  // Optionally assume points keep getting pricier (or cheaper) at the observed weekly trend.
  const trend = useTrend && model?.weeklyCostTrend != null ? model.weeklyCostTrend : 0;
  let totalPoints = 0;
  for (let i = 0; i < weeksAhead; i++) totalPoints += weeklyPoints / (1 + trend) ** (i + 1);
  const totalFees = weeklyFees * weeksAhead;
  const costPerPoint = totalPoints > 0 ? totalFees / totalPoints : null;
  const net = value != null && Number.isFinite(value) ? totalPoints * value - totalFees : null;
  const roi = net != null && totalFees > 0 ? net / totalFees : null;

  const scatter = observed.map((w) => ({ x: driver === "fees" ? w.fees : w.volume / MILLION, y: w.points!, start: w.start }));
  const maxX = Math.max(0, ...scatter.map((p) => p.x));
  const fitLine = modelRate != null ? [{ x: 0, y: 0 }, { x: maxX, y: modelRate * maxX }] : [];
  const fit = model ? (driver === "fees" ? model.byFees : model.byVolume) : null;
  const xLabel = driver === "fees" ? "Fees paid" : "Volume ($M)";

  return (
    <Card
      id="points"
      title="Is farming points worth it?"
      subtitle="Learns how your fees turn into points, predicts future points, and weighs them against what you'd pay."
      delay={140}
    >
      {/* 1 — What the data says */}
      {model ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="grid grid-cols-2 content-start gap-x-6 gap-y-5">
            <Stat label="Points per $1 of fees" value={round(model.byFees.rate)}
              hint={model.byFees.r2 != null ? `Fit ${fitLabel(model.byFees.r2)}` : `From ${model.weeks} week${model.weeks > 1 ? "s" : ""}`} />
            <Stat label="Points per $1M volume" value={round(model.byVolume.rate * MILLION)}
              hint={model.byVolume.r2 != null ? `Fit ${fitLabel(model.byVolume.r2)}` : `From ${model.weeks} week${model.weeks > 1 ? "s" : ""}`} />
            <Stat label="Your cost per point" tone="orange" value={usd(model.costPerPoint, { cents: true })}
              hint={`${num(model.totalPoints)} points for ${usd(model.totalFees, { compact: true })}`} />
            <Stat
              label="Points are getting"
              tone={model.weeklyCostTrend == null ? "ink" : model.weeklyCostTrend > 0 ? "orange" : "green"}
              value={model.weeklyCostTrend == null ? "—" : model.weeklyCostTrend > 0 ? "Pricier" : "Cheaper"}
              hint={model.weeklyCostTrend == null
                ? "Needs 3+ weeks of points"
                : `${Math.abs(model.weeklyCostTrend * 100).toFixed(1)}% per week`}
            />
            <p className="col-span-2 rounded-[14px] bg-fill-2 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
              {model.byFees.r2 == null || model.byVolume.r2 == null ? (
                <>Add points for 3 or more full weeks to tell whether Arcus rewards fees or volume. Until then, predictions use fees.</>
              ) : (
                <>
                  Your points follow <span className="font-medium text-ink">{model.best}</span> most closely
                  ({fitLabel(model.best === "fees" ? model.byFees.r2 : model.byVolume.r2)} fit vs.{" "}
                  {fitLabel(model.best === "fees" ? model.byVolume.r2 : model.byFees.r2)} for {model.best === "fees" ? "volume" : "fees"}).
                </>
              )}
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-medium text-ink-2">Points vs. {driver === "fees" ? "fees" : "volume"}, each dot is a week</p>
              {fit?.r2 != null && <span className="text-[12px] text-ink-3">R² {fit.r2.toFixed(2)}</span>}
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="var(--hairline)" />
                  <XAxis type="number" dataKey="x" domain={[0, "auto"]} name={xLabel}
                    tickFormatter={(v) => (driver === "fees" ? usd(v, { compact: true }) : `${round(v)}M`)}
                    tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="number" dataKey="y" domain={[0, "auto"]} tickFormatter={(v) => num(v)}
                    tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip cursor={false} content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as { x: number; y: number; start?: number } | undefined;
                    if (!active || !p?.start) return null;
                    return (
                      <div className="tabular rounded-[12px] bg-card px-3 py-2 text-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.16)] ring-1 ring-hairline">
                        <p className="font-semibold">{weekLabel(p.start)}</p>
                        <p className="text-ink-2">{num(p.y)} points · {driver === "fees" ? usd(p.x, { cents: true }) + " fees" : `$${round(p.x)}M volume`}</p>
                      </div>
                    );
                  }} />
                  <Line data={fitLine} dataKey="y" stroke="var(--text-3)" strokeDasharray="5 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Scatter data={scatter} fill="var(--accent)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[16px] bg-fill-2 px-5 py-4 text-[14px] leading-relaxed text-ink-2">
          {hasAddress
            ? "Enter the points you received for at least one week in the Points tracker above. The model learns your points rate from those weeks."
            : "Track a wallet and enter its weekly points to learn your real points rate, or type your own rate below to try scenarios."}
        </div>
      )}

      {/* 2 — Plan & predict */}
      <div className="mt-8 grid gap-6 border-t border-hairline pt-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <h3 className="text-[15px] font-semibold">Your plan</h3>
          <Field label="Weekly volume" prefix="$">
            <input type="number" inputMode="decimal" min={0} value={volumeIn ?? Math.round(avgVolume)}
              onChange={(e) => setVolumeIn(e.target.value)} className={inputCls} />
          </Field>

          <div>
            <div className="flex justify-between text-[13px] font-medium text-ink-2">
              <label htmlFor="pa-maker">Maker share</label>
              <span className="tabular text-ink">{Math.round(makerShare * 100)}% maker · {100 - Math.round(makerShare * 100)}% taker</span>
            </div>
            <input id="pa-maker" type="range" min={0} max={100} step={5} value={Math.round(makerShare * 100)}
              onChange={(e) => setMakerIn(Number(e.target.value) / 100)} className="mt-2 w-full accent-[var(--accent)]" />
          </div>

          <div>
            <label htmlFor="pa-tier" className="text-[13px] font-medium text-ink-2">Fee tier</label>
            <Select id="pa-tier" label="Fee tier" value={String(tierIn)}
              onChange={(v) => setTierIn(v === "auto" ? "auto" : Number(v))}
              options={[
                { value: "auto", label: `Auto: ${autoTier?.name ?? "…"}`, detail: "from this weekly pace" },
                ...(tiers ?? []).map((t) => ({
                  value: String(t.level),
                  label: t.name,
                  detail: `${pct(t.makerFeePpm)} / ${pct(t.takerFeePpm)}`,
                })),
              ]} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink-2">Points rate</span>
              <Segmented label="Points based on" value={driver}
                onChange={(d) => { setDriverIn(d); setRateIn(null); }}
                options={[{ value: "fees", label: "Fees" }, { value: "volume", label: "Volume" }]} />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <input type="number" inputMode="decimal" min={0} value={rateText} placeholder="e.g. 0.5"
                onChange={(e) => setRateIn(e.target.value)} className={`${inputCls} rounded-[12px] bg-fill-2 px-3.5`}
                aria-label="Points rate" />
              <span className="shrink-0 text-[13px] text-ink-2">{driver === "fees" ? "pts per $1 fees" : "pts per $1M volume"}</span>
            </div>
            <p className="mt-1 text-[12px] text-ink-3">
              {rateIn != null && modelRate != null
                ? <button className="text-accent" onClick={() => setRateIn(null)}>Reset to your data ({round(modelRate)})</button>
                : modelRate != null ? "From your data. Edit to try your own." : "Enter a rate you know, e.g. from Arcus or other traders."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Value per point" prefix="$">
              <input type="number" inputMode="decimal" min={0} step="any" value={valueIn} placeholder="Your guess"
                onChange={(e) => setValueIn(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Weeks ahead">
              <input type="number" inputMode="numeric" min={1} max={52} value={horizon}
                onChange={(e) => setHorizon(e.target.value)} className={inputCls} />
            </Field>
          </div>
          {model?.weeklyCostTrend != null && (
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={useTrend} onChange={(e) => setUseTrend(e.target.checked)} className="accent-[var(--accent)]" />
              Assume points keep getting {model.weeklyCostTrend > 0 ? "pricier" : "cheaper"} by {Math.abs(model.weeklyCostTrend * 100).toFixed(1)}% a week
            </label>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-[15px] font-semibold">Prediction for {weeksAhead} week{weeksAhead > 1 ? "s" : ""}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Fees you'd pay" value={usd(totalFees, { compact: true })} sub={`${usd(weeklyFees, { compact: true })} a week · ${tier?.name ?? "—"} tier`} tone="text-orange" />
            <Tile label="Points you'd earn" value={num(Math.round(totalPoints))} sub={`≈ ${num(Math.round(weeklyPoints))} in week 1`} />
            <Tile label="Cost per point" value={costPerPoint != null ? usd(costPerPoint, { cents: true }) : "—"} sub="Fees ÷ points" />
            <Tile label="Break-even value" value={costPerPoint != null ? usd(costPerPoint, { cents: true }) : "—"} sub="A point must be worth this" />
          </div>

          <Verdict net={net} roi={roi} value={value} costPerPoint={costPerPoint} weeks={weeksAhead} weeklyFees={weeklyFees} />

          {costPerPoint != null && (
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-2">If a point ends up worth…</p>
              <table className="tabular w-full text-[14px]">
                <tbody>
                  {[0.5, 1, 1.5, 2, 3].map((m) => {
                    const v = costPerPoint * m;
                    const n = totalPoints * v - totalFees;
                    return (
                      <tr key={m} className="border-t border-hairline">
                        <td className="py-2">{usd(v, { cents: true })}</td>
                        <td className="text-ink-3">{m === 1 ? "break-even" : `${m}× break-even`}</td>
                        <td className={`text-right font-medium ${n > 0.005 ? "text-green" : n < -0.005 ? "text-red" : ""}`}>
                          {n >= 0 ? "+" : ""}{usd(n, { compact: true })}
                        </td>
                        <td className="w-16 text-right text-ink-2">{totalFees > 0 ? `${Math.round((n / totalFees) * 100)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <p className="mt-6 text-[12px] leading-relaxed text-ink-3">
        Estimates only. Arcus scores how you trade — not just fees or volume — and hasn&apos;t said what points will be worth, so this assumes your
        future weeks earn points like your past ones did. Counts trading fees only, not funding or trading profit and loss.
      </p>
    </Card>
  );
}

function Verdict({ net, roi, value, costPerPoint, weeks, weeklyFees }: {
  net: number | null; roi: number | null; value: number | null; costPerPoint: number | null; weeks: number; weeklyFees: number;
}) {
  let tone = "bg-fill-2 text-ink";
  let title: string;
  let body: ReactNode;
  if (weeklyFees <= 0) {
    title = "No fees, no fee-based points";
    body = "At this tier and maker share you earn rebates instead of paying fees. Switch points to volume if that's how Arcus rewards you.";
  } else if (costPerPoint == null) {
    title = "Add a points rate";
    body = "Enter how many points you get, or add weekly points in the tracker, to see a prediction.";
  } else if (net == null || value == null) {
    title = `Worth it if a point is worth more than ${usd(costPerPoint, { cents: true })}`;
    body = "Enter what you think a point will be worth to get a verdict.";
  } else if (net > 0) {
    tone = "bg-[color-mix(in_srgb,var(--green)_12%,transparent)] text-ink";
    title = `Worth it: +${usd(net, { compact: true })} over ${weeks} week${weeks > 1 ? "s" : ""}`;
    body = <>At {usd(value, { cents: true })} a point you get back {roi != null ? `${Math.round(roi * 100 + 100)}%` : "more than"} of what you pay in fees.</>;
  } else {
    tone = "bg-[color-mix(in_srgb,var(--red)_10%,transparent)] text-ink";
    title = `Not worth it: ${usd(net, { compact: true })} over ${weeks} week${weeks > 1 ? "s" : ""}`;
    body = <>Points would need to be worth at least {usd(costPerPoint, { cents: true })} each to cover your fees.</>;
  }
  return (
    <div className={`rounded-[16px] px-4 py-3.5 ${tone}`}>
      <p className="text-[16px] font-semibold tracking-tight">{title}</p>
      <p className="mt-0.5 text-[13px] text-ink-2">{body}</p>
    </div>
  );
}

const inputCls = "tabular h-11 w-full bg-transparent text-[16px] font-medium outline-none";

function Field({ label, prefix, children }: { label: string; prefix?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      <span className="mt-1.5 flex items-center rounded-[12px] bg-fill-2 px-3.5 focus-within:ring-2 focus-within:ring-accent">
        {prefix && <span className="mr-1 text-ink-3">{prefix}</span>}
        {children}
      </span>
    </label>
  );
}

function Tile({ label, value, sub, tone = "text-ink" }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="rounded-[16px] bg-card-2 p-3.5 ring-1 ring-hairline">
      <p className="text-[12px] font-medium text-ink-2">{label}</p>
      <p className={`tabular mt-0.5 truncate text-[22px] font-semibold tracking-tight ${tone}`}>{value}</p>
      <p className="truncate text-[11px] text-ink-3">{sub}</p>
    </div>
  );
}

function fitLabel(r2: number) {
  return r2 >= 0.8 ? "strong" : r2 >= 0.5 ? "moderate" : "weak";
}

function round(v: number) {
  if (v === 0) return "0";
  const digits = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 1 ? 2 : 4;
  return String(Number(v.toFixed(digits)));
}
