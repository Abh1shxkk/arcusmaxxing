"use client";

import { useEffect, useRef, useState } from "react";
import { fetchAccountStats, fetchLeaderboard, fetchVolumeRank, streamFills, type AccountStats, type Fill } from "@/lib/arcus";
import { bps } from "@/lib/aggregate";
import { buildProfile } from "@/lib/traderProfile";
import { bpsLabel, num, shortAddress, usd } from "@/lib/format";
import { PageHeader } from "../Account";
import { ADDRESS_RE, useTracker } from "../TrackerProvider";
import { Card } from "../ui";

const MAX = 4;
const SAMPLE = 1000; // recent fills per wallet: enough for style metrics without a long load

interface Row {
  address: string;
  stats: AccountStats | null;
  rank: number | null;
  fills: Fill[] | null;
  error?: string;
}

type Better = "high" | "low" | null;

export function CompareView() {
  const { wallets: saved, markets, tiers } = useTracker();
  const [list, setList] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Restore ?a=0x…,0x… from a shared comparison link (browser-only, after hydration).
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("a");
    const initial = (fromUrl?.split(",") ?? []).filter((a) => ADDRESS_RE.test(a)).map((a) => a.toLowerCase()).slice(0, MAX);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial.length) setList(initial);
  }, []);

  const requested = useRef(new Set<string>());
  useEffect(() => {
    window.history.replaceState(null, "", list.length ? `/compare?a=${list.join(",")}` : "/compare");
    for (const a of list) {
      if (requested.current.has(a)) continue; // each wallet is fetched once per visit
      requested.current.add(a);
      const from = (Date.now() - 30 * 86_400_000) * 1000;
      Promise.all([
        fetchAccountStats(a),
        fetchVolumeRank(a).catch(() => null),
        streamFills({ address: a, fromUs: from, maxFills: SAMPLE, onPage: () => {} }).then((p) => p.fills),
      ])
        .then(([stats, rank, fills]) => setRows((r) => ({ ...r, [a]: { address: a, stats, rank, fills } })))
        .catch(() => setRows((r) => ({ ...r, [a]: { address: a, stats: null, rank: null, fills: [], error: "Couldn't load" } })));
    }
  }, [list]);

  const add = (raw: string) => {
    const a = raw.trim().toLowerCase();
    if (!ADDRESS_RE.test(a)) return setError("Enter a valid wallet address — 0x followed by 40 hex characters.");
    if (list.includes(a)) return setError("That wallet is already in the comparison.");
    if (list.length >= MAX) return setError(`Compare up to ${MAX} wallets at a time.`);
    setError(null);
    setInput("");
    setList([...list, a]);
  };

  const addTop = async () => {
    const top = await fetchLeaderboard("volume", "30d", 10).catch(() => []);
    const next = top.find((e) => !list.includes(e.address));
    if (next) add(next.address);
  };

  const loaded = list.map((a) => rows[a]).filter(Boolean);

  const metrics: { label: string; better: Better; value: (r: Row) => number | null; fmt: (v: number) => string }[] = [
    { label: "30-day volume", better: "high", value: (r) => r.stats?.rollingVolume ?? null, fmt: (v) => usd(v, { compact: true }) },
    { label: "30-day fees", better: null, value: (r) => r.stats?.rollingFeesPaid ?? null, fmt: (v) => usd(v, { compact: true }) },
    { label: "Fee rate", better: "low", value: (r) => (r.stats && r.stats.rollingVolume > 0 ? bps(r.stats.rollingFeesPaid, r.stats.rollingVolume) : null), fmt: bpsLabel },
    { label: "Cost per $1M traded", better: "low", value: (r) => (r.stats && r.stats.rollingVolume > 0 ? (r.stats.rollingFeesPaid / r.stats.rollingVolume) * 1e6 : null), fmt: (v) => usd(v, { cents: true }) },
    { label: "Maker share", better: "high", value: (r) => share(r.fills, (f) => f.role === "MAKER"), fmt: (v) => `${Math.round(v * 100)}%` },
    { label: "Average trade", better: null, value: (r) => (r.fills?.length ? r.fills.reduce((s, f) => s + f.notional, 0) / r.fills.length : null), fmt: (v) => usd(v, { compact: true }) },
    { label: "Markets traded", better: "high", value: (r) => (r.fills ? new Set(r.fills.map((f) => f.market)).size : null), fmt: (v) => num(v) },
    { label: "Lifetime volume", better: "high", value: (r) => r.stats?.lifetimeVolume ?? null, fmt: (v) => usd(v, { compact: true }) },
    { label: "Rank, 30-day volume", better: "low", value: (r) => r.rank, fmt: (v) => `#${num(v)}` },
  ];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Compare" title="You vs. them.">
        Put up to {MAX} wallets side by side — fee rate, maker share, cost per $1M and more. Style metrics use each wallet&apos;s latest
        {" "}{num(SAMPLE)} trades.
      </PageHeader>

      <Card>
        <form onSubmit={(e) => { e.preventDefault(); add(input); }} className="flex flex-wrap gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add a wallet address (0x…)" spellCheck={false}
            aria-label="Wallet address to compare"
            className="h-11 min-w-[260px] flex-1 rounded-[12px] bg-fill-2 px-4 font-mono text-[14px] outline-none placeholder:font-sans placeholder:text-ink-3 focus:ring-2 focus:ring-accent" />
          <button type="submit" disabled={list.length >= MAX}
            className="h-11 rounded-[12px] bg-accent px-5 text-[15px] font-medium text-on-accent disabled:opacity-50">Add</button>
          {saved.some((w) => !list.includes(w)) && (
            <button type="button" disabled={list.length >= MAX}
              onClick={() => setList([...list, ...saved.filter((w) => !list.includes(w))].slice(0, MAX))}
              className="h-11 rounded-[12px] bg-fill-2 px-4 text-[14px] font-medium hover:bg-fill disabled:opacity-50">{saved.length > 1 ? "Add my wallets" : "Add my wallet"}</button>
          )}
          <button type="button" onClick={addTop} disabled={list.length >= MAX}
            className="h-11 rounded-[12px] bg-fill-2 px-4 text-[14px] font-medium hover:bg-fill disabled:opacity-50">Add a top trader</button>
        </form>
        {error && <p className="mt-2 text-[13px] text-red">{error}</p>}
      </Card>

      {list.length === 0 ? (
        <Card><p className="py-10 text-center text-[14px] text-ink-3">Add two or more wallets to compare them.</p></Card>
      ) : (
        <Card>
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="tabular w-full min-w-[640px] text-[14px]">
              <thead>
                <tr className="align-bottom">
                  <th className="px-5 pb-3 text-left text-[12px] font-medium text-ink-2 sm:px-6">Metric</th>
                  {list.map((a) => {
                    const r = rows[a];
                    const profile = r?.stats && r.fills ? buildProfile(r.stats, r.fills, markets, 30) : null;
                    const tier = tiers?.find((t) => t.level === r?.stats?.tier.level);
                    return (
                      <th key={a} className="px-3 pb-3 text-right font-normal">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-mono text-[13px] font-medium">{shortAddress(a)}</span>
                          <button onClick={() => setList(list.filter((x) => x !== a))} aria-label={`Remove ${shortAddress(a)}`}
                            className="grid h-5 w-5 place-items-center rounded-full text-ink-3 hover:bg-fill-2 hover:text-ink">×</button>
                        </div>
                        <p className="text-[12px] text-ink-2">
                          {profile ? `${profile.creature.emoji} ${profile.title}` : r?.error ?? "Loading…"}
                          {tier ? ` · ${tier.name}` : ""}
                        </p>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  const vals = list.map((a) => (rows[a] ? m.value(rows[a]) : null));
                  const real = vals.filter((v): v is number => v != null);
                  const best = m.better && real.length > 1 ? (m.better === "high" ? Math.max(...real) : Math.min(...real)) : null;
                  return (
                    <tr key={m.label} className="border-t border-hairline">
                      <td className="px-5 py-3 text-ink-2 sm:px-6">{m.label}</td>
                      {vals.map((v, i) => (
                        <td key={list[i]} className="px-3 py-3 text-right">
                          {v == null ? <span className="text-ink-3">{loaded.length ? "—" : ""}</span> : (
                            <span className={`inline-flex items-center gap-1.5 ${v === best ? "font-semibold" : ""}`}>
                              {v === best && <span className="h-1.5 w-1.5 rounded-full bg-green" aria-label="best" />}
                              {m.fmt(v)}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-ink-3">A green dot marks the best value in rows where higher or lower is clearly better. The page link keeps this comparison.</p>
        </Card>
      )}
    </div>
  );
}

function share(fills: Fill[] | null, pred: (f: Fill) => boolean) {
  if (!fills?.length) return null;
  const total = fills.reduce((s, f) => s + f.notional, 0);
  return total > 0 ? fills.reduce((s, f) => s + (pred(f) ? f.notional : 0), 0) / total : null;
}
