"use client";

import { useState } from "react";
import { fetchFunding, fetchTransfers } from "@/lib/arcus";
import { downloadCsv, fillsCsv, fundingCsv, transfersCsv, weeksCsv } from "@/lib/csv";
import { useTracker } from "./TrackerProvider";
import { Card } from "./ui";

export function ExportCard() {
  const { address, addresses, combined, fillState, funding, weeks, points, range, account, subaccounts } = useTracker();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!address) return null;

  // (wallet, subaccount) pairs in view: each wallet's main account when combined.
  const parts = combined
    ? addresses.map((a) => ({ address: a, index: 0 }))
    : (account === "all" ? (subaccounts ?? [0]) : [account]).map((i) => ({ address: addresses[0], index: i }));
  const stamp = new Date().toISOString().slice(0, 10);
  const name = (what: string) => `arcus-${what}-${combined ? `${addresses.length}-wallets` : address.slice(0, 8)}-${stamp}.csv`;

  const run = async (id: string, job: () => Promise<void>) => {
    setBusy(id);
    setError(null);
    try {
      await job();
    } catch {
      setError("Couldn't fetch that from Arcus. Try again in a minute.");
    } finally {
      setBusy(null);
    }
  };

  const items: { id: string; title: string; body: string; ready: boolean; action: () => void }[] = [
    {
      id: "trades",
      title: "Trades",
      body: `Every fill in the last ${range}: price, size, fee and realised PnL.`,
      ready: !fillState.loading && fillState.fills.length > 0,
      action: () => downloadCsv(name(`trades-${range}`), fillsCsv(fillState.fills)),
    },
    {
      id: "weeks",
      title: "Weekly summary",
      body: "Volume, maker/taker split, fees and the points you entered, per week.",
      ready: weeks.length > 0,
      action: () => downloadCsv(name("weekly"), weeksCsv(weeks.map((w) => ({ ...w, points: points[w.start] })))),
    },
    {
      id: "funding",
      title: `Funding, ${range}`,
      body: "Every funding payment you paid or received in the loaded range.",
      ready: funding !== null && funding.length > 0,
      action: () => funding && downloadCsv(name(`funding-${range}`), fundingCsv(funding)),
    },
    {
      id: "funding-year",
      title: "Funding, last 12 months",
      body: "A full year of funding payments — handy for taxes.",
      ready: true,
      action: () => run("funding-year", async () => {
        const from = (Date.now() - 365 * 86_400_000) * 1000;
        const lists = await Promise.all(parts.map((p) => fetchFunding(p.address, from, undefined, 200, p.index)));
        downloadCsv(name("funding-12m"), fundingCsv(lists.flat().sort((a, b) => b.time - a.time)));
      }),
    },
    {
      id: "transfers",
      title: "Deposits & withdrawals",
      body: "Every deposit, withdrawal, internal transfer and referral payout.",
      ready: true,
      action: () => run("transfers", async () => {
        const lists = await Promise.all(parts.map((p) => fetchTransfers(p.address, undefined, p.index)));
        downloadCsv(name("transfers"), transfersCsv(lists.flat().sort((a, b) => b.createdAt - a.createdAt)));
      }),
    },
  ];

  return (
    <Card title="Export your data" subtitle="CSV files that open in Excel, Google Sheets or your tax tool. Times are UTC.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((it) => (
          <button key={it.id} onClick={it.action} disabled={!it.ready || busy !== null}
            className="flex flex-col rounded-[16px] bg-card-2 p-4 text-left ring-1 ring-hairline transition hover:ring-accent disabled:opacity-50">
            <span className="flex items-center justify-between gap-2 text-[14px] font-semibold">
              {it.title}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent" aria-hidden>
                <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
              </svg>
            </span>
            <span className="mt-1 text-[12px] leading-relaxed text-ink-2">{busy === it.id ? "Fetching from Arcus…" : it.body}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-[13px] text-red">{error}</p>}
    </Card>
  );
}
