"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Bucket } from "@/lib/aggregate";
import type { PointsMap } from "@/lib/points";
import { sha256Hex, signMessage, type SyncWeek } from "@/lib/pointsSync";
import { shortAddress, shortDate, usd, weekLabel } from "@/lib/format";
import { Card } from "./ui";
import { activeDot, gridProps, LegendKey, SERIES, TooltipCard, xAxisProps, yAxisProps } from "./charts/kit";

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

interface CommunityWeek {
  start: number;
  contributors: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
}

type Status = { kind: "idle" | "busy" | "ok" | "error"; text?: string };

export function PointsSyncCard({ address, points, onChange, weeks }: {
  address: string;
  points: PointsMap;
  onChange: (p: PointsMap) => void;
  weeks: (Bucket & { points?: number })[]; // complete weeks with fees and volume
}) {
  const [community, setCommunity] = useState<{ configured: boolean; weeks: CommunityWeek[]; min: number } | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const loadCommunity = () =>
    fetch("/api/community", { cache: "no-store" })
      .then(async (r) => (r.status === 501 ? { configured: false, weeks: [], min: 3 } : { configured: true, ...(await r.json()) }))
      .then((d) => setCommunity({ configured: d.configured, weeks: d.weeks ?? [], min: d.minContributors ?? 3 }))
      .catch(() => setCommunity({ configured: false, weeks: [], min: 3 }));

  useEffect(() => {
    loadCommunity();
  }, []);

  const save = async () => {
    const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum;
    if (!eth) return setStatus({ kind: "error", text: "No wallet found. Install a browser wallet like MetaMask or Rabby to sign." });
    setStatus({ kind: "busy", text: "Waiting for your wallet…" });
    try {
      const [account] = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      if (account?.toLowerCase() !== address) {
        return setStatus({ kind: "error", text: `Your wallet is on ${shortAddress(account ?? "")}. Switch to ${shortAddress(address)} to save its points.` });
      }
      const syncWeeks: SyncWeek[] = weeks
        .filter((w) => points[w.start] != null)
        .map((w) => ({ start: w.start, points: points[w.start], fees: Number(w.fees.toFixed(6)), volume: Math.round(w.volume) }));
      if (!syncWeeks.length) return setStatus({ kind: "error", text: "Enter points for at least one full week first." });
      const payload = JSON.stringify({ weeks: syncWeeks });
      const timestamp = Date.now();
      const message = signMessage(address, await sha256Hex(payload), timestamp);
      const signature = (await eth.request({ method: "personal_sign", params: [message, account] })) as string;
      setStatus({ kind: "busy", text: "Saving…" });
      const res = await fetch("/api/points", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, payload, timestamp, signature }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) return setStatus({ kind: "error", text: out.error ?? "Couldn't save." });
      setStatus({ kind: "ok", text: `Saved ${syncWeeks.length} week${syncWeeks.length > 1 ? "s" : ""}. They're now in the community average.` });
      loadCommunity();
    } catch (e) {
      const msg = (e as { code?: number }).code === 4001 ? "You cancelled the signature." : "Something went wrong talking to your wallet.";
      setStatus({ kind: "error", text: msg });
    }
  };

  const load = async () => {
    setStatus({ kind: "busy", text: "Loading saved points…" });
    const res = await fetch(`/api/points?address=${address}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return setStatus({ kind: "error", text: "Couldn't load saved points." });
    const data = (await res.json()) as { weeks: SyncWeek[] };
    if (!data.weeks.length) return setStatus({ kind: "ok", text: "Nothing saved for this wallet yet." });
    const merged = { ...points };
    for (const w of data.weeks) merged[w.start] = w.points;
    onChange(merged);
    setStatus({ kind: "ok", text: `Loaded ${data.weeks.length} saved week${data.weeks.length > 1 ? "s" : ""}.` });
  };

  const mine = new Map(weeks.filter((w) => points[w.start] && w.fees > 0).map((w) => [w.start, w.fees / points[w.start]]));
  const chart = (community?.weeks ?? []).map((w) => ({ ...w, you: mine.get(w.start) ?? null }));
  const hasCommunity = chart.some((w) => w.median != null);
  const latest = [...chart].reverse().find((w) => w.median != null);

  return (
    <Card title="Sync & community" subtitle="Save your points to use them on any device, and see what a point costs everyone else.">
      {community && !community.configured ? (
        <p className="rounded-[14px] bg-fill-2 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
          Syncing isn&apos;t set up on this deployment yet. The site owner needs to connect a free Upstash Redis database — see the
          README. Your points are still saved in this browser.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={save} disabled={status.kind === "busy"}
              className="h-11 rounded-full bg-accent px-5 text-[15px] font-medium text-on-accent transition hover:brightness-110 disabled:opacity-60">
              Sign &amp; save points
            </button>
            <button onClick={load} disabled={status.kind === "busy"}
              className="h-11 rounded-full bg-fill-2 px-5 text-[15px] font-medium transition hover:bg-fill disabled:opacity-60">
              Load saved points
            </button>
            {status.text && (
              <p className={`text-[13px] ${status.kind === "error" ? "text-red" : status.kind === "ok" ? "text-green" : "text-ink-2"}`}>{status.text}</p>
            )}
          </div>
          <p className="mt-2 text-[12px] text-ink-3">
            Saving asks your wallet to sign a message — it proves you own this wallet and costs no gas. Only weekly points, fees and
            volume are shared; the community view shows medians, never individual wallets.
          </p>

          <div className="mt-6 border-t border-hairline pt-5">
            {!community ? <div className="skeleton h-56 w-full" /> : !hasCommunity ? (
              <p className="py-8 text-center text-[14px] text-ink-3">
                Not enough data yet — a week appears once {community.min} wallets have shared it. Be one of them.
              </p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                  <div className="flex gap-4">
                    <LegendKey color={SERIES.primary} label="Community median" line />
                    <LegendKey color={SERIES.secondary} label="You" line />
                  </div>
                  {latest?.median != null && (
                    <p className="text-[13px] text-ink-2">
                      Week of {shortDate(latest.start)}: <span className="tabular font-medium text-ink">{usd(latest.median, { cents: true })}</span> per point
                      across {latest.contributors} wallets
                    </p>
                  )}
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="start" tickFormatter={(v) => shortDate(v)} {...xAxisProps} />
                      <YAxis tickFormatter={(v) => usd(v, { cents: true })} {...yAxisProps} />
                      <Tooltip cursor={{ stroke: "var(--text-3)", strokeWidth: 1 }} content={({ active, payload }) => {
                        const w = payload?.[0]?.payload as (CommunityWeek & { you: number | null }) | undefined;
                        if (!active || !w) return null;
                        return (
                          <TooltipCard title={weekLabel(w.start)} rows={[
                            { label: "Community median", value: w.median != null ? usd(w.median, { cents: true }) : "—", color: SERIES.primary },
                            { label: "Middle half", value: w.p25 != null && w.p75 != null ? `${usd(w.p25, { cents: true })}–${usd(w.p75, { cents: true })}` : "—" },
                            { label: "You", value: w.you != null ? usd(w.you, { cents: true }) : "—", color: SERIES.secondary },
                            { label: "Wallets", value: String(w.contributors) },
                          ]} />
                        );
                      }} />
                      <Line dataKey="median" stroke={SERIES.primary} strokeWidth={2} dot={false} connectNulls activeDot={activeDot(SERIES.primary)} isAnimationActive={false} />
                      <Line dataKey="you" stroke={SERIES.secondary} strokeWidth={2} dot={{ r: 4, fill: SERIES.secondary, stroke: "var(--card)", strokeWidth: 2 }}
                        connectNulls activeDot={activeDot(SERIES.secondary)} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
