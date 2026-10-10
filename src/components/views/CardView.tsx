"use client";

import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { buildProfile, CREATURES } from "@/lib/traderProfile";
import { usd } from "@/lib/format";
import { AccountBar, AddressSearch, PageHeader } from "../Account";
import { TraderCard } from "../TraderCard";
import { useTracker } from "../TrackerProvider";
import { Card } from "../ui";

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;

const TRAIT_GUIDE = [
  ["💸", "Rebate Hunter", "Net fees below zero — maker rebates pay you"],
  ["🧱", "Maker Maxi", "60%+ of volume as maker orders"],
  ["🔥", "Market-Order Merchant", "95%+ of volume as taker orders"],
  ["⚡", "Scalper", "50+ trades a day, average under $2K"],
  ["🎯", "Sniper", "Average trade of $25K or more"],
  ["🦉", "Night Owl", "40%+ of volume between 00:00 and 06:00 UTC"],
  ["🏝️", "Weekend Warrior", "30%+ of volume on weekends"],
  ["⛏️", "Grinder", "Trading on 80%+ of days"],
  ["🦘", "Market Hopper", "10 or more markets traded"],
  ["💍", "Loyalist", "80%+ of volume in a single market"],
  ["📈", "Wall St Degen", "Mostly stocks, ETFs and commodities"],
  ["🪙", "Crypto Native", "90%+ of volume in crypto"],
] as const;

export function CardView() {
  const { address, combined, wallets, stats, fillState, markets, range, coverageStart, now } = useTracker();
  const who = combined ? `${wallets.length} wallets` : address ?? "";
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const profile = useMemo(
    // Judge consistency over the days the loaded history covers, not the whole range.
    () => (stats ? buildProfile(stats, fillState.fills, markets, Math.max(1, Math.round((now - coverageStart) / 86_400_000))) : null),
    [stats, fillState.fills, markets, now, coverageStart],
  );

  const download = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const url = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `arcus-${profile?.title.toLowerCase().replace(/\s+/g, "-") ?? "trader"}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  const shareUrl = typeof window !== "undefined" && address ? (combined ? `${window.location.origin}/card` : `${window.location.origin}/u/${address}`) : "";
  const shareText = profile
    ? `I'm a ${profile.title} ${profile.creature.emoji} on Arcus. Degen score ${profile.degenScore}/100 — ${profile.scoreLabel.toLowerCase()}.\n\nWhat kind of trader are you?`
    : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const vol = stats?.rollingVolume ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Trader card" title="What kind of trader are you?">
        Your 30-day volume sets your sea creature, your fee rate sets your style, and your trade history earns stickers.
        Download it or post it.
      </PageHeader>

      {!address ? (
        <Card title="Track a wallet" subtitle="Paste the wallet you trade with to paint your card.">
          <AddressSearch compact />
        </Card>
      ) : (
        <>
          <AccountBar />
          {!profile || !stats ? (
            <div className="skeleton aspect-[1200/680] w-full !rounded-[22px]" />
          ) : (
            <>
              <TraderCard ref={cardRef} profile={profile} stats={stats} address={who} />
              <div className="flex flex-wrap gap-2">
                <a href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-medium text-bg transition hover:opacity-85">
                  <XLogo /> Share on X
                </a>
                <button onClick={download} disabled={busy}
                  className="h-11 rounded-full bg-accent px-5 text-[15px] font-medium text-on-accent transition hover:brightness-110 disabled:opacity-60">
                  {busy ? "Painting…" : "Download PNG"}
                </button>
                <button onClick={copy} className="h-11 rounded-full bg-fill-2 px-5 text-[15px] font-medium text-ink transition hover:bg-fill">
                  {copied ? "Copied" : "Copy text"}
                </button>
              </div>
              {fillState.loading && (
                <p className="text-[13px] text-ink-2">Still loading trade history — stickers update as it comes in.</p>
              )}
            </>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="The food chain" subtitle="Your creature is set by trading volume over the last 30 days.">
              <ol className="space-y-1">
                {CREATURES.slice(1).map((c, i, list) => {
                  const nextMin = list[i + 1]?.minVolume;
                  const here = vol >= c.minVolume && (nextMin == null || vol < nextMin);
                  return (
                    <li key={c.name} className={`flex items-center gap-3 rounded-[12px] px-3 py-2 ${here ? "bg-accent-soft" : ""}`}>
                      <span className="text-[22px]">{c.emoji}</span>
                      <span className={`flex-1 text-[15px] ${here ? "font-semibold" : ""}`}>{c.name}</span>
                      <span className="tabular text-[13px] text-ink-2">
                        {usd(c.minVolume === 1 ? 0 : c.minVolume, { compact: true })}{nextMin ? `–${usd(nextMin, { compact: true })}` : "+"}
                      </span>
                      {here && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-on-accent">You</span>}
                    </li>
                  );
                })}
              </ol>
              {profile?.next && profile.creature.name !== "Ghost" && (
                <p className="mt-4 rounded-[12px] bg-fill-2 px-3.5 py-2.5 text-[13px] text-ink-2">
                  Trade <span className="tabular font-medium text-ink">{usd(profile.next.minVolume - vol, { compact: true })}</span> more
                  in 30 days to evolve into a {profile.next.name} {profile.next.emoji}.
                </p>
              )}
            </Card>

            <Card title="Stickers" subtitle={`Earned from your last ${RANGE_DAYS[range]} days of trades. Up to five make the card.`}>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {TRAIT_GUIDE.map(([emoji, name, why]) => {
                  const earned = profile?.traits.some((t) => t.name === name || (name === "Loyalist" && t.emoji === "💍"));
                  return (
                    <li key={name} className={`rounded-[12px] px-3 py-2 ${earned ? "bg-accent-soft" : "opacity-55"}`}>
                      <p className="text-[14px] font-medium">{emoji} {name}</p>
                      <p className="text-[12px] text-ink-2">{why}</p>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function XLogo() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
