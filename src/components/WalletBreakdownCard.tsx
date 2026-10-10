"use client";

import { useMemo } from "react";
import { bps } from "@/lib/aggregate";
import { bpsLabel, num, shortAddress, usd } from "@/lib/format";
import { useTracker } from "./TrackerProvider";
import { Card } from "./ui";
import { DegenAvatar } from "./DegenAvatar";

/** Each wallet's part of a combined view. Only shown when several wallets are combined. */
export function WalletBreakdownCard() {
  const { combined, addresses, walletStats, tiers, fillState, open } = useTracker();

  const trades = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of fillState.fills) if (f.wallet) m.set(f.wallet, (m.get(f.wallet) ?? 0) + 1);
    return m;
  }, [fillState.fills]);

  if (!combined) return null;
  const rows = addresses
    .map((a) => ({ address: a, stats: walletStats[a] }))
    .sort((a, b) => (b.stats?.rollingVolume ?? 0) - (a.stats?.rollingVolume ?? 0));
  const total = rows.reduce((s, r) => s + (r.stats?.rollingVolume ?? 0), 0);

  return (
    <Card title="By wallet" subtitle="How each wallet contributes over the last 30 days. Click one to view it on its own.">
      <div className="-mx-5 overflow-x-auto sm:-mx-6">
        <table className="tabular w-full min-w-[720px] text-[14px]">
          <thead>
            <tr className="text-left text-[12px] text-ink-2">
              <th className="px-5 pb-2 font-medium sm:px-6">Wallet</th>
              <th className="pb-2 font-medium">Share of volume</th>
              <th className="pb-2 text-right font-medium">30d volume</th>
              <th className="pb-2 text-right font-medium">30d fees</th>
              <th className="pb-2 text-right font-medium">Rate</th>
              <th className="pb-2 text-right font-medium">Tier</th>
              <th className="px-5 pb-2 text-right font-medium sm:px-6">Trades loaded</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ address, stats }) => {
              const share = total > 0 && stats ? stats.rollingVolume / total : 0;
              return (
                <tr key={address} className="border-t border-hairline">
                  <td className="px-5 py-2.5 sm:px-6">
                    <button onClick={() => open(address)} className="flex items-center gap-2 font-mono text-[13px] font-medium hover:text-accent">
                      <DegenAvatar address={address} size={26} />{shortAddress(address)}
                    </button>
                  </td>
                  <td className="w-[28%] pr-4">
                    {stats ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill-2">
                          <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(share * 100, 1)}%` }} />
                        </div>
                        <span className="w-10 text-right text-[12px] text-ink-2">{Math.round(share * 100)}%</span>
                      </div>
                    ) : <div className="skeleton h-2 w-full" />}
                  </td>
                  <td className="text-right font-medium">{stats ? usd(stats.rollingVolume, { compact: true }) : "…"}</td>
                  <td className="text-right">{stats ? usd(stats.rollingFeesPaid, { compact: true }) : "…"}</td>
                  <td className="text-right text-ink-2">{stats && stats.rollingVolume > 0 ? bpsLabel(bps(stats.rollingFeesPaid, stats.rollingVolume)) : "—"}</td>
                  <td className="text-right text-ink-2">{tiers?.find((t) => t.level === stats?.tier.level)?.name ?? "—"}</td>
                  <td className="px-5 text-right text-ink-2 sm:px-6">{num(trades.get(address) ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">
        Combined views use each wallet&apos;s main account. Fee tiers are per wallet — volume on one doesn&apos;t lower fees on another.
      </p>
    </Card>
  );
}
