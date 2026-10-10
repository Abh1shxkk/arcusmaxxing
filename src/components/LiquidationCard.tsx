"use client";

import { useState } from "react";
import type { Market } from "@/lib/arcus";
import { liquidationPrice } from "@/lib/liquidation";
import { usd } from "@/lib/format";
import { Card, Segmented, Select } from "./ui";

const priceFmt = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: v < 1 ? 6 : v < 100 ? 4 : 2 })}`;

export function LiquidationCard({ markets }: { markets: Market[] | null }) {
  const [marketName, setMarketName] = useState<string | null>(null);
  const [side, setSide] = useState<"long" | "short">("long");
  const [entryIn, setEntryIn] = useState<string | null>(null);
  const [leverage, setLeverage] = useState(10);
  const [notional, setNotional] = useState("10000");

  const market = markets?.find((m) => m.name === marketName) ?? markets?.[0];
  const maxLev = market ? Math.max(1, Math.floor(1 / market.initialMarginFraction)) : 50;
  const lev = Math.min(leverage, maxLev);
  const entry = Number(entryIn ?? market?.markPrice ?? 0);
  const size = Number(notional) || 0;
  const result = market && entry > 0 && size > 0
    ? liquidationPrice({ side, entry, leverage: lev, notional: size, maintenanceFraction: market.maintenanceMarginFraction })
    : null;
  const risk = result ? (result.distance < 0.02 ? "red" : result.distance < 0.08 ? "gold" : "green") : "green";

  return (
    <Card id="liquidation" title="Liquidation calculator" subtitle="Where an isolated position gets liquidated, using each market's own margin rules.">
      {!markets ? <div className="skeleton h-80 w-full" /> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <div>
              <label htmlFor="liq-market" className="text-[13px] font-medium text-ink-2">Market</label>
              <Select id="liq-market" label="Market" value={market?.name ?? ""}
                onChange={(v) => { setMarketName(v); setEntryIn(null); }}
                options={markets.map((m) => ({ value: m.name, label: m.name.replace("-USD", ""), detail: `max ${Math.floor(1 / m.initialMarginFraction)}×` }))} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink-2">Side</span>
              <Segmented label="Side" value={side} onChange={setSide} options={[{ value: "long", label: "Long" }, { value: "short", label: "Short" }]} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[13px] font-medium text-ink-2">Entry price</span>
                <span className="mt-1.5 flex items-center rounded-[12px] bg-fill-2 px-3.5 focus-within:ring-2 focus-within:ring-accent">
                  <span className="mr-1 text-ink-3">$</span>
                  <input type="number" inputMode="decimal" min={0} step="any" value={entryIn ?? (market?.markPrice ?? "")}
                    onChange={(e) => setEntryIn(e.target.value)} className="tabular h-11 w-full bg-transparent text-[16px] font-medium outline-none" />
                </span>
              </label>
              <label className="block">
                <span className="text-[13px] font-medium text-ink-2">Position size</span>
                <span className="mt-1.5 flex items-center rounded-[12px] bg-fill-2 px-3.5 focus-within:ring-2 focus-within:ring-accent">
                  <span className="mr-1 text-ink-3">$</span>
                  <input type="number" inputMode="decimal" min={0} value={notional}
                    onChange={(e) => setNotional(e.target.value)} className="tabular h-11 w-full bg-transparent text-[16px] font-medium outline-none" />
                </span>
              </label>
            </div>
            <div>
              <div className="flex justify-between text-[13px] font-medium text-ink-2">
                <label htmlFor="liq-lev">Leverage</label>
                <span className="tabular text-ink">{lev}× <span className="text-ink-3">of {maxLev}× max</span></span>
              </div>
              <input id="liq-lev" type="range" min={1} max={maxLev} value={lev} onChange={(e) => setLeverage(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--accent)]" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-[16px] bg-card-2 p-5 ring-1 ring-hairline">
              <p className="text-[13px] text-ink-2">Liquidation price</p>
              <p className="tabular mt-1 text-[36px] font-semibold tracking-tight">{result ? priceFmt(result.price) : "—"}</p>
              {result && (
                <p className="mt-1 flex items-center gap-2 text-[14px]">
                  <span className={`h-2 w-2 rounded-full ${risk === "red" ? "bg-red" : risk === "gold" ? "bg-gold" : "bg-green"}`} aria-hidden />
                  {(result.distance * 100).toFixed(2)}% {side === "long" ? "below" : "above"} your entry
                  <span className="text-ink-3">· {risk === "red" ? "very tight" : risk === "gold" ? "tight" : "some room"}</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Margin you post" value={result ? usd(result.margin, { cents: true }) : "—"} />
              <Tile label="Maintenance at entry" value={result ? usd(result.maintenanceAtEntry, { cents: true }) : "—"}
                sub={market ? `${(market.maintenanceMarginFraction * 100).toFixed(2)}% of notional` : undefined} />
            </div>
            <p className="text-[12px] leading-relaxed text-ink-3">
              Estimate for isolated margin, before fees and funding, measured against the mark price. Cross-margin positions share your
              whole balance, so they usually liquidate further away. Stock and ETF markets need more margin to open outside regular hours.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[14px] bg-fill-2 p-3.5">
      <p className="text-[12px] text-ink-2">{label}</p>
      <p className="tabular mt-0.5 text-[18px] font-semibold">{value}</p>
      {sub && <p className="text-[11px] text-ink-3">{sub}</p>}
    </div>
  );
}
