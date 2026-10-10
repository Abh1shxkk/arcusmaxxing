"use client";

import Link from "next/link";
import { bps } from "@/lib/aggregate";
import { bpsLabel, pct, usd } from "@/lib/format";
import { AccountBar, AddressSearch } from "../Account";
import { ActivityCard } from "../ActivityCard";
import { HeatmapCard } from "../charts/HeatmapCard";
import { MakerTakerCard } from "../charts/MakerTakerCard";
import { ProfitCard } from "../charts/ProfitCard";
import { MarketFeesCard } from "../charts/MarketFeesCard";
import { TradeSizeCard } from "../charts/TradeSizeCard";
import { ExchangeCard } from "../ExchangeCard";
import { ExportCard } from "../ExportCard";
import { WalletBreakdownCard } from "../WalletBreakdownCard";
import { useTracker } from "../TrackerProvider";
import { Card, Stat } from "../ui";

export function OverviewView() {
  const { address, stats, markets, tiers, fillState, coverageStart, now, sum, funding } = useTracker();
  const topTier = tiers?.[tiers.length - 1];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <section className="card rise flex flex-col justify-center p-6 sm:p-10">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">Arcus mainnet</p>
          <h1 className="mt-3 text-[34px] font-bold leading-[1.1] tracking-[-0.025em] sm:text-[44px]">
            See exactly what you pay to trade.
          </h1>
          <p className="mt-3 mb-7 max-w-[520px] text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
            Volume, fees and cost per point for any wallet, broken down day by day and week by week.
          </p>
          <AddressSearch />
        </section>
        <ExchangeCard markets={markets} />
      </div>

      {address && (
        <>
          <div className="pt-4">
            <AccountBar />
          </div>
          <Card delay={40}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
              <Stat label="30-day volume" value={stats && usd(stats.rollingVolume, { compact: true })}
                hint={stats && `${usd(stats.windows["7d"].volume, { compact: true })} in the last 7 days`} loading={!stats} />
              <Stat label="30-day fees" tone="orange" value={stats && usd(stats.rollingFeesPaid, { compact: true })}
                hint={stats && `${usd(stats.windows["24h"].feesPaid, { compact: true })} in the last 24 hours`} loading={!stats} />
              <Stat label="Effective rate" value={stats && bpsLabel(bps(stats.rollingFeesPaid, stats.rollingVolume))}
                hint="Fees ÷ volume, 30 days" loading={!stats} />
              <Stat label="Your fee rate" tone="accent" value={stats && pct(stats.tier.takerFeePpm)}
                hint={stats && `Taker · maker ${pct(stats.tier.makerFeePpm)}`} loading={!stats} />
            </div>
            {stats && (
              <p className="mt-6 border-t border-hairline pt-4 text-[13px] text-ink-2">
                Lifetime: <span className="tabular font-medium text-ink">{usd(stats.lifetimeVolume, { compact: true })}</span> traded,{" "}
                <span className="tabular font-medium text-ink">{usd(stats.lifetimeFeesPaid, { compact: true })}</span> paid in fees.
              </p>
            )}
          </Card>
          <WalletBreakdownCard />
          <ActivityCard fills={fillState.fills} rangeStart={coverageStart} now={now} totals={sum}
            loading={fillState.loading && fillState.fills.length === 0} />
          {fillState.fills.length > 0 && (
            <>
              <ProfitCard fills={fillState.fills} funding={funding} rangeStart={coverageStart} now={now} />
              <div className="grid gap-5 lg:grid-cols-2">
                <MakerTakerCard fills={fillState.fills} rangeStart={coverageStart} now={now} stats={stats} />
                <MarketFeesCard totals={sum} />
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <HeatmapCard fills={fillState.fills} />
                <TradeSizeCard fills={fillState.fills} />
              </div>
            </>
          )}
        </>
      )}

      {address && <ExportCard />}

      <div className="grid gap-5 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <ToolTile href="/points" title="Points analyzer"
          body="Find out what each point costs you, and whether farming them is worth it."
          stat={address ? "Uses this wallet" : "Works with your own numbers"} />
        <ToolTile href="/markets" title="Markets"
          body="Prices, volume, open interest and funding for every live market."
          stat={markets ? `${markets.length} live markets` : "Loading…"} />
        <ToolTile href="/leaderboard" title="Leaderboard"
          body="The biggest traders by fees and volume. Open any of them in one click."
          stat="24h and 30-day rankings" />
        <ToolTile href="/fees" title="Fees & tiers"
          body="Every fee tier, plus a calculator for what your volume will cost."
          stat={topTier ? `Down to ${pct(topTier.takerFeePpm)} taker` : "Loading…"} />
      </div>
    </div>
  );
}

function ToolTile({ href, title, body, stat }: { href: string; title: string; body: string; stat: string }) {
  return (
    <Link href={href} className="card rise group flex flex-col p-5 transition hover:-translate-y-0.5">
      <p className="text-[17px] font-semibold tracking-tight">{title}</p>
      <p className="mt-1 flex-1 text-[14px] leading-relaxed text-ink-2">{body}</p>
      <p className="mt-4 flex items-center justify-between text-[13px]">
        <span className="text-ink-3">{stat}</span>
        <span className="font-medium text-accent transition group-hover:translate-x-0.5">Open →</span>
      </p>
    </Link>
  );
}
