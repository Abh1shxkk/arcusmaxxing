"use client";

import { useState } from "react";
import type { FeeTier } from "@/lib/arcus";
import { pct, usd } from "@/lib/format";
import { Card, Select } from "./ui";

const PRESETS = [100_000, 1_000_000, 10_000_000, 100_000_000];

export function CalculatorCard({ tiers, currentLevel }: { tiers: FeeTier[] | null; currentLevel: number }) {
  const [volume, setVolume] = useState(1_000_000);
  const [makerShare, setMakerShare] = useState(20);
  // Keyed by the account's tier in the parent, so this resets when the tier loads.
  const [level, setLevel] = useState(currentLevel);

  const feeAt = (t: FeeTier) => volume * ((makerShare / 100) * t.makerFeePpm + (1 - makerShare / 100) * t.takerFeePpm) / 1e6;
  const selected = tiers?.find((t) => t.level === level);
  const fee = selected ? feeAt(selected) : 0;
  const base = tiers?.[0] ? feeAt(tiers[0]) : 0;

  return (
    <Card id="calculator" title="Fee calculator" subtitle="Estimate what a given volume will cost you on each tier." delay={200}>
      {!tiers ? (
        <div className="skeleton h-64 w-full" />
      ) : (
        <div className="space-y-5">
          <div>
            <label htmlFor="calc-volume" className="text-[13px] font-medium text-ink-2">Trading volume</label>
            <div className="mt-1.5 flex items-center rounded-[12px] bg-fill-2 px-3.5 focus-within:ring-2 focus-within:ring-accent">
              <span className="text-[20px] text-ink-3">$</span>
              <input id="calc-volume" type="number" inputMode="decimal" min={0} value={volume || ""}
                onChange={(e) => setVolume(Math.max(0, Number(e.target.value)))}
                className="tabular h-12 w-full bg-transparent px-1 text-[20px] font-semibold outline-none" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => setVolume(p)}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                    volume === p ? "bg-accent text-on-accent" : "bg-fill-2 text-ink-2 hover:text-ink"}`}>
                  {usd(p, { compact: true })}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[13px] font-medium text-ink-2">
              <label htmlFor="calc-maker">Maker share</label>
              <span className="tabular text-ink">{makerShare}% maker · {100 - makerShare}% taker</span>
            </div>
            <input id="calc-maker" type="range" min={0} max={100} step={5} value={makerShare}
              onChange={(e) => setMakerShare(Number(e.target.value))} className="mt-2 w-full accent-[var(--accent)]" />
          </div>

          <div>
            <label htmlFor="calc-tier" className="text-[13px] font-medium text-ink-2">Tier</label>
            <Select id="calc-tier" label="Tier" value={String(level)} onChange={(v) => setLevel(Number(v))}
              options={tiers.map((t) => ({
                value: String(t.level),
                label: t.name,
                detail: `maker ${pct(t.makerFeePpm)} · taker ${pct(t.takerFeePpm)}`,
              }))} />
          </div>

          <div className="rounded-[16px] bg-card-2 p-4 ring-1 ring-hairline">
            <p className="text-[13px] text-ink-2">Estimated fees</p>
            <p className={`tabular text-[34px] font-semibold tracking-tight ${fee < 0 ? "text-green" : "text-orange"}`}>
              {fee < 0 ? `+${usd(-fee, { cents: true })} rebate` : usd(fee, { cents: true })}
            </p>
            {selected && selected.level > 0 && base > fee && (
              <p className="text-[13px] text-green">Saves {usd(base - fee, { cents: true })} vs. the Base tier</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
