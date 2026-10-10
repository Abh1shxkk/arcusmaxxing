"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  fetchPortfolio,
  fetchRank,
  fetchTransfers,
  type Portfolio,
  type Transfer,
} from "@/lib/arcus";
import { bps } from "@/lib/aggregate";
import { bpsLabel, num, pct, shortDate, usd } from "@/lib/format";
import { AccountBar, AddressSearch, PageHeader } from "../Account";
import { ExportCard } from "../ExportCard";
import { AlertsCard } from "../Alerts";
import { useTracker } from "../TrackerProvider";
import { Card, Pagination, Stat, usePagination } from "../ui";

const INVITE_STEP = 1_000_000; // one invite code per $1M of lifetime perps volume (Arcus docs)

interface Extras {
  key: string;
  portfolio: Portfolio | null;
  transfers: Transfer[];
  ranks: { vol30: number | null; fees30: number | null; volAll: number | null; feesAll: number | null };
}

type Status = "good" | "ok" | "todo";

export function FarmView() {
  const { address, addresses, combined, walletStats, stats, tiers, fillState, range, changeRange, now, funding: rangeFunding, account, subaccounts } = useTracker();
  // (wallet, subaccount) pairs in view: each wallet's main account when combined.
  const parts = combined
    ? addresses.map((a) => `${a}:0`)
    : (account === "all" ? (subaccounts ?? [0]) : [account]).map((i) => `${addresses[0]}:${i}`);
  const extrasKey = parts.join(",");
  const [extras, setExtras] = useState<Extras | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // The farming page needs a few reads the other pages don't; fetch them when it opens.
  useEffect(() => {
    if (!extrasKey) return;
    const ctrl = new AbortController();
    const s = ctrl.signal;
    const pairs = extrasKey.split(",").map((p) => {
      const [a, i] = p.split(":");
      return { address: a, index: Number(i) };
    });
    const wallets = [...new Set(pairs.map((p) => p.address))];
    // With several wallets, the best (lowest) rank among them is what counts.
    const bestRank = (sortBy: "volume" | "fees", window: "30d" | "all") =>
      Promise.all(wallets.map((a) => fetchRank(a, sortBy, window, s))).then((r) => {
        const ranks = r.filter((x): x is number => x != null);
        return ranks.length ? Math.min(...ranks) : null;
      });
    Promise.all([
      Promise.all(pairs.map((p) => fetchPortfolio(p.address, s, p.index))).then(combinePortfolios),
      Promise.all(pairs.map((p) => fetchTransfers(p.address, s, p.index))).then((l) => l.flat().sort((a, b) => b.createdAt - a.createdAt)),
      Promise.all([bestRank("volume", "30d"), bestRank("fees", "30d"), bestRank("volume", "all"), bestRank("fees", "all")]),
    ])
      .then(([portfolio, transfers, [vol30, fees30, volAll, feesAll]]) => {
        setFailed(null);
        setExtras({ key: extrasKey, portfolio, transfers, ranks: { vol30, fees30, volAll, feesAll } });
      })
      .catch((e) => {
        if (e.name !== "AbortError") setFailed("Couldn't load some account data from Arcus. Try again in a minute.");
      });
    return () => ctrl.abort();
  }, [extrasKey]);

  const data = extras?.key === extrasKey ? extras : null;
  // Funding comes from the shared store; the cost figures use its last 30 days.
  const funding30 = useMemo(
    () => (rangeFunding ? rangeFunding.filter((p) => p.time / 1000 >= now - 30 * 86_400_000) : null),
    [rangeFunding, now],
  );
  const fills = fillState.fills;

  const activity = useMemo(() => {
    const days = new Set(fills.map((f) => Math.floor(f.createdAt / 86_400_000_000)));
    const weeks = new Set(fills.map((f) => Math.floor((f.createdAt / 1000 - 4 * 86_400_000) / (7 * 86_400_000))));
    const markets = new Set(fills.map((f) => f.market));
    const vol = fills.reduce((s, f) => s + f.notional, 0);
    const maker = fills.reduce((s, f) => s + (f.role === "MAKER" ? f.notional : 0), 0);
    return { days: days.size, weeks: weeks.size, markets: markets.size, makerShare: vol > 0 ? maker / vol : 0 };
  }, [fills]);

  const fundingByMarket = useMemo(() => {
    const m = new Map<string, { market: string; net: number; paid: number; received: number; count: number }>();
    for (const p of funding30 ?? []) {
      const e = m.get(p.market) ?? { market: p.market, net: 0, paid: 0, received: 0, count: 0 };
      e.net += p.payment;
      if (p.payment < 0) e.paid -= p.payment;
      else e.received += p.payment;
      e.count++;
      m.set(p.market, e);
    }
    return [...m.values()].sort((a, b) => a.net - b.net);
  }, [funding30]);

  const fundingPage = usePagination(fundingByMarket, 8);
  const transfers = data?.transfers ?? NO_TRANSFERS;
  const transferPage = usePagination(transfers, 8);

  if (!address) {
    return (
      <div className="space-y-5">
        <Header />
        <Card title="Track a wallet" subtitle="Paste the wallet you farm with to see where you stand.">
          <AddressSearch compact />
        </Card>
        <Tips />
      </div>
    );
  }

  const rangeDays = { "7d": 7, "30d": 30, "90d": 90 }[range];
  const rangeWeeks = Math.ceil(rangeDays / 7);
  // Invite codes are earned per wallet: count each wallet's codes, and track the one closest to its next.
  const lifetimes = combined
    ? addresses.map((a) => walletStats[a]?.lifetimeVolume ?? 0)
    : [data?.portfolio?.lifetimeVolume ?? stats?.lifetimeVolume ?? 0];
  const lifetime = lifetimes.reduce((s, v) => s + v, 0);
  const codes = lifetimes.reduce((s, v) => s + Math.floor(v / INVITE_STEP), 0);
  const toNextCode = Math.min(...lifetimes.map((v) => INVITE_STEP - (v % INVITE_STEP)));
  const tier = tiers?.find((t) => t.level === stats?.tier.level);
  const nextTier = tiers?.find((t) => t.level === (stats?.tier.level ?? 0) + 1);
  const rolling = stats?.rollingVolume ?? 0;
  const deposits = transfers.filter((t) => t.type === "DEPOSIT" && t.status === "APPLIED").reduce((s, t) => s + t.amount, 0);
  const withdrawals = transfers.filter((t) => t.type === "WITHDRAWAL" && t.status === "APPLIED").reduce((s, t) => s + t.amount, 0);
  const turnover = deposits > 0 ? lifetime / deposits : null;
  const fundingNet = (funding30 ?? []).reduce((s, p) => s + p.payment, 0);
  const fees30 = stats?.rollingFeesPaid ?? 0;
  const cost30 = fees30 - fundingNet; // funding received offsets cost
  const pnl30 = data?.portfolio?.pnl.Month ?? null;
  const bestRank = Math.min(...[data?.ranks.vol30, data?.ranks.fees30].filter((r): r is number => r != null), Infinity);

  const checks: Check[] = [
    {
      title: "Invite codes",
      status: codes >= 1 ? "good" : INVITE_STEP - toNextCode >= INVITE_STEP / 2 ? "ok" : "todo",
      value: `${codes} earned`,
      progress: (INVITE_STEP - toNextCode) / INVITE_STEP,
      detail: `${usd(toNextCode, { compact: true })} more lifetime volume${combined ? " on your closest wallet" : ""} to earn the next one.`,
      why: "Arcus gives one invite code per $1M of lifetime perps volume. Codes bind new traders to you as referrals.",
    },
    {
      title: "Fee tier",
      status: (stats?.tier.level ?? 0) >= 2 ? "good" : (stats?.tier.level ?? 0) >= 1 ? "ok" : "todo",
      value: tier?.name ?? "—",
      progress: nextTier && tier ? Math.min(1, (rolling - tier.volumeThreshold) / (nextTier.volumeThreshold - tier.volumeThreshold)) : 1,
      detail: nextTier
        ? `${usd(nextTier.volumeThreshold - rolling, { compact: true })} more 30-day volume for ${nextTier.name} (${pct(nextTier.takerFeePpm)} taker).`
        : "Top tier — the cheapest fees on Arcus.",
      why: "Higher tiers make every farmed dollar of volume cheaper.",
    },
    {
      title: "Consistency",
      status: activity.weeks >= rangeWeeks ? "good" : activity.weeks >= rangeWeeks / 2 ? "ok" : "todo",
      value: `${activity.weeks}/${rangeWeeks} weeks`,
      progress: Math.min(1, activity.weeks / rangeWeeks),
      detail: `Active on ${activity.days} of the last ${rangeDays} days.`,
      why: "Steady activity over many weeks looks like a real user. One-day volume spikes don't.",
    },
    {
      title: "Market breadth",
      status: activity.markets >= 5 ? "good" : activity.markets >= 2 ? "ok" : "todo",
      value: `${activity.markets} markets`,
      progress: Math.min(1, activity.markets / 5),
      detail: "Arcus lists crypto, stocks, ETFs and commodities.",
      why: "Using more of the product — different markets and asset classes — is a common airdrop signal.",
    },
    {
      title: "Maker share",
      status: activity.makerShare >= 0.3 ? "good" : activity.makerShare >= 0.1 ? "ok" : "todo",
      value: `${Math.round(activity.makerShare * 100)}%`,
      progress: Math.min(1, activity.makerShare / 0.3),
      detail: stats ? `Your maker fee is ${pct(stats.tier.makerFeePpm)} vs ${pct(stats.tier.takerFeePpm)} taker.` : "",
      why: "Limit orders that rest on the book cost less and add liquidity, which exchanges value.",
    },
    {
      title: "Leaderboard",
      status: bestRank <= 100 ? "good" : bestRank <= 1000 ? "ok" : "todo",
      value: Number.isFinite(bestRank) ? `#${num(bestRank)}` : "Unranked",
      progress: Number.isFinite(bestRank) ? Math.max(0.03, 1 - Math.log10(bestRank) / 4) : 0,
      detail: data
        ? `30d: #${data.ranks.vol30 ?? "—"} volume, #${data.ranks.fees30 ?? "—"} fees · All time: #${data.ranks.volAll ?? "—"} volume, #${data.ranks.feesAll ?? "—"} fees.`
        : "Loading ranks…",
      why: "Leaderboards are public, so they're an easy snapshot for any future rewards.",
    },
  ];

  const done = checks.filter((c) => c.status === "good").length;

  return (
    <div className="space-y-5">
      <Header />
      <AccountBar />
      {failed && <p className="text-[14px] text-red">{failed}</p>}

      <Card title="Farming checklist" subtitle={`${done} of ${checks.length} looking strong. Based on public Arcus data for this wallet.`}
        action={range !== "90d" ? (
          <button onClick={() => changeRange("90d")} className="text-[14px] font-medium text-accent hover:underline">
            Use 90 days of history
          </button>
        ) : null}>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {checks.map((c) => <CheckTile key={c.title} check={c} loading={!stats} />)}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card title="What farming costs you" subtitle="Last 30 days. Funding you received offsets the fees you paid.">
          <div className="grid grid-cols-2 gap-x-6 gap-y-6">
            <Stat label="Fees paid" tone="orange" value={usd(fees30, { cents: fees30 < 1000 })} loading={!stats} />
            <Stat label="Funding, net" value={`${fundingNet >= 0 ? "+" : ""}${usd(fundingNet, { cents: Math.abs(fundingNet) < 1000 })}`}
              hint={fundingNet >= 0 ? "Received more than paid" : "Paid more than received"} loading={!funding30} />
            <Stat label="Total cost" value={usd(cost30, { cents: Math.abs(cost30) < 1000 })}
              hint={rolling > 0 ? `${usd((cost30 / rolling) * 1e6, { compact: true })} per $1M traded` : undefined} loading={!funding30 || !stats} />
            <Stat label="Profit, 30 days" tone={pnl30 != null && pnl30 >= 0 ? "green" : "orange"}
              value={pnl30 == null ? "—" : `${pnl30 >= 0 ? "+" : ""}${usd(pnl30, { compact: true })}`}
              hint="Trading + funding, as reported by Arcus" loading={!data} />
          </div>
          {stats && rolling > 0 && (
            <p className="mt-6 rounded-[12px] bg-fill-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2">
              Every $1M you farm costs about <span className="tabular font-medium text-ink">{usd((cost30 / rolling) * 1e6, { compact: true })}</span> at
              your {bpsLabel(bps(fees30, rolling))} fee rate. See what points need to be worth on the{" "}
              <Link href="/points" className="font-medium text-accent hover:underline">Points page</Link>.
            </p>
          )}
        </Card>

        <Card title="Capital" subtitle="How hard your deposits are working.">
          <div className="grid grid-cols-2 gap-x-6 gap-y-6">
            <Stat label="Deposited" value={usd(deposits, { compact: true })} loading={!data} />
            <Stat label="Withdrawn" value={usd(withdrawals, { compact: true })} loading={!data} />
            <Stat label="Turnover" tone="accent" value={turnover != null ? `${turnover.toFixed(0)}×` : "—"}
              hint="Lifetime volume ÷ deposits" loading={!data} />
            <Stat label="Equity now" value={data?.portfolio ? usd(data.portfolio.equity, { compact: true }) : "—"} loading={!data} />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Funding by market" subtitle="Last 30 days, biggest cost first.">
          {!funding30 ? <div className="skeleton h-48 w-full" /> : fundingByMarket.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-ink-3">No funding payments in the last 30 days.</p>
          ) : (
            <>
              <Table head={["Market", "Payments", "Paid", "Received", "Net"]}>
                {fundingPage.slice.map((m) => (
                  <tr key={m.market} className="border-t border-hairline">
                    <td className="py-2.5 font-medium">{m.market.replace("-USD", "")}</td>
                    <td className="text-right text-ink-2">{num(m.count)}</td>
                    <td className="text-right">{usd(m.paid, { cents: true })}</td>
                    <td className="text-right">{usd(m.received, { cents: true })}</td>
                    <td className={`text-right font-medium ${m.net >= 0 ? "text-green" : "text-red"}`}>
                      {m.net >= 0 ? "+" : ""}{usd(m.net, { cents: true })}
                    </td>
                  </tr>
                ))}
              </Table>
              <Pagination {...fundingPage} noun="markets" />
            </>
          )}
        </Card>

        <Card title="Deposits & withdrawals" subtitle="Newest first.">
          {!data ? <div className="skeleton h-48 w-full" /> : transfers.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-ink-3">No transfers yet.</p>
          ) : (
            <>
              <Table head={["Date", "Type", "Status", "Amount"]}>
                {transferPage.slice.map((t) => (
                  <tr key={t.id} className="border-t border-hairline">
                    <td className="py-2.5 text-ink-2">{shortDate(t.createdAt / 1000)}</td>
                    <td>{TRANSFER_LABEL[t.type] ?? t.type}</td>
                    <td className="text-ink-2">{t.status === "APPLIED" ? "Done" : t.status.toLowerCase().replaceAll("_", " ")}</td>
                    <td className="text-right font-medium">{usd(t.amount, { cents: t.amount < 1000 })}</td>
                  </tr>
                ))}
              </Table>
              <Pagination {...transferPage} noun="transfers" />
            </>
          )}
        </Card>
      </div>

      <AlertsCard />
      <ExportCard />
      <Tips />
      <p className="text-center text-[12px] text-ink-3">Data as of {now ? new Date(now).toUTCString().slice(5, 22) : "now"} UTC.</p>
    </div>
  );
}

const NO_TRANSFERS: Transfer[] = [];

const TRANSFER_LABEL: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  TRANSFER: "Internal transfer",
  REFERRAL_CLAIM: "Referral payout",
};

interface Check {
  title: string;
  status: Status;
  value: string;
  progress: number;
  detail: string;
  why: string;
}

const STATUS: Record<Status, { label: string; dot: string }> = {
  good: { label: "Strong", dot: "bg-green" },
  ok: { label: "Getting there", dot: "bg-gold" },
  todo: { label: "Needs work", dot: "bg-red" },
};

function CheckTile({ check: c, loading }: { check: Check; loading: boolean }) {
  const s = STATUS[c.status];
  return (
    <div className="flex flex-col rounded-[16px] bg-card-2 p-4 ring-1 ring-hairline">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold">{c.title}</p>
        <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
          <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />{s.label}
        </span>
      </div>
      {loading ? <div className="skeleton mt-3 h-7 w-24" /> : (
        <p className="mt-2 text-[24px] font-semibold tracking-tight">{c.value}</p>
      )}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill">
        <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.max(0.02, c.progress) * 100}%` }} />
      </div>
      <p className="mt-2 text-[13px] text-ink">{c.detail}</p>
      <p className="mt-1 flex-1 text-[12px] leading-relaxed text-ink-3">{c.why}</p>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="tabular w-full min-w-[420px] text-[14px]">
        <thead>
          <tr className="text-left text-[12px] text-ink-2">
            {head.map((h, i) => <th key={h} className={`pb-2 font-medium ${i > 0 && h !== "Type" && h !== "Status" ? "text-right" : ""}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Header() {
  return (
    <PageHeader eyebrow="Airdrop farming" title="Farm Arcus like you mean it.">
      Track the things that tend to matter for rewards — volume, consistency, breadth and cost — using public Arcus data.
      Arcus hasn&apos;t published any airdrop criteria, so treat this as a guide, not a guarantee.
    </PageHeader>
  );
}

function Tips() {
  const tips: [string, ReactNode][] = [
    ["Trade every week", "Spread volume across many weeks instead of one big burst. Consistency is the hardest signal to fake."],
    ["Use limit orders", "Maker orders cost less, and at the VIP tier and above Arcus pays you a rebate to make."],
    ["Climb fee tiers", <>Tiers reset on rolling 30-day volume. Check your path on the <Link href="/fees" className="font-medium text-accent hover:underline">Fees page</Link>.</>],
    ["Collect invite codes", "Every $1M of lifetime perps volume earns an invite code. Referred traders also earn you commission."],
    ["Try the whole product", "Trade crypto, stocks, ETFs and commodities perps — and Stock Tokens on spot, which are free to trade at launch."],
    ["Watch funding", "Holding positions through funding can quietly cost more than fees. Check the funding table above."],
    ["One wallet, done right", "Splitting volume across many wallets usually gets flagged and filtered out. Farm with one real account."],
  ];
  return (
    <Card title="Farming playbook" subtitle="From the Arcus docs and how airdrops usually work.">
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tips.map(([title, body], i) => (
          <li key={title} className="flex gap-3 rounded-[14px] bg-fill-2 p-3.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-on-accent">{i + 1}</span>
            <div>
              <p className="text-[14px] font-semibold">{title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Sum PnL and equity across subaccounts; lifetime volume is per wallet, so take the max. */
function combinePortfolios(list: (Portfolio | null)[]): Portfolio | null {
  const ps = list.filter((p): p is Portfolio => p !== null);
  if (!ps.length) return null;
  return {
    lifetimeVolume: Math.max(...ps.map((p) => p.lifetimeVolume)),
    equity: ps.reduce((s, p) => s + p.equity, 0),
    pnl: {
      Day: ps.reduce((s, p) => s + p.pnl.Day, 0),
      Week: ps.reduce((s, p) => s + p.pnl.Week, 0),
      Month: ps.reduce((s, p) => s + p.pnl.Month, 0),
      All: ps.reduce((s, p) => s + p.pnl.All, 0),
    },
  };
}
