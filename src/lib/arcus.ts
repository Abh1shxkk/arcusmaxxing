// Thin client for the public Arcus mainnet REST API.
// Docs: https://docs.arcus.xyz/api-reference/introduction
// Every endpoint used here is public (no API key) and CORS-enabled, so calls run in the browser.

export const API_BASE = "https://api.arcus.xyz";

// Aggregate volumes/fees from accountStats, leaderboard and fee tiers are integers in USD × 1e9.
const USD_SCALE = 1e9;
export const fromScaled = (v: number) => v / USD_SCALE;

export interface FeeTier {
  level: number;
  name: string;
  volumeThreshold: number; // USD, 30-day notional
  makerFeePpm: number; // negative = rebate
  takerFeePpm: number;
}

export interface WindowStat {
  volume: number; // USD
  feesPaid: number; // USD
}

export interface AccountStats {
  rollingVolume: number;
  rollingFeesPaid: number;
  lifetimeVolume: number;
  lifetimeFeesPaid: number;
  windows: Record<"24h" | "7d" | "30d", WindowStat>;
  tier: { level: number; makerFeePpm: number; takerFeePpm: number };
}

export interface Fill {
  key: string;
  market: string;
  side: "BUY" | "SELL";
  role: "MAKER" | "TAKER";
  size: number;
  price: number;
  notional: number;
  fee: number; // USD; negative = rebate received
  pnl: number; // realised PnL net of this fill's fee (Arcus `closedPnl`; opening legs report −fee)
  createdAt: number; // epoch microseconds
  wallet?: string; // set when several wallets are combined
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

// GET with retry on 429, honouring the server's precise `retryAfterMs` (see Rate limits docs).
async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${API_BASE}${path}`, { signal, cache: "no-store" });
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const wait = body.retryAfterMs ?? Number(res.headers.get("Retry-After") ?? 2) * 1000;
      await sleep(Math.max(wait, 500), signal);
      continue;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
    }
    return res.json() as Promise<T>;
  }
  throw new ApiError("Rate limited by Arcus — please try again in a minute", 429);
}

interface RawTier {
  level: number;
  name: string;
  volume_threshold: number;
  maker_fee_ppm: number;
  taker_fee_ppm: number;
}

export async function fetchFeeTiers(signal?: AbortSignal): Promise<FeeTier[]> {
  const data = await get<{ tiers: RawTier[] }>("/v1/feetiers", signal);
  return data.tiers.map((t) => ({
    level: t.level,
    name: t.name,
    volumeThreshold: fromScaled(t.volume_threshold),
    makerFeePpm: t.maker_fee_ppm,
    takerFeePpm: t.taker_fee_ppm,
  }));
}

interface RawStats {
  rollingVolume: number;
  rollingFeesPaid: number;
  lifetimeVolume: number;
  lifetimeFeesPaid: number;
  windowedStats?: Record<string, { volume: number; feesPaid: number }>;
  tradingFeeTier: { level: number; makerFeePpm: number; takerFeePpm: number };
}

export async function fetchAccountStats(address: string, signal?: AbortSignal): Promise<AccountStats> {
  const d = await get<RawStats>(`/v1/account/stats?address=${address}&windows=24h,7d,30d`, signal);
  const w = (k: string): WindowStat => ({
    volume: fromScaled(d.windowedStats?.[k]?.volume ?? 0),
    feesPaid: fromScaled(d.windowedStats?.[k]?.feesPaid ?? 0),
  });
  return {
    rollingVolume: fromScaled(d.rollingVolume),
    rollingFeesPaid: fromScaled(d.rollingFeesPaid),
    lifetimeVolume: fromScaled(d.lifetimeVolume),
    lifetimeFeesPaid: fromScaled(d.lifetimeFeesPaid),
    windows: { "24h": w("24h"), "7d": w("7d"), "30d": w("30d") },
    tier: d.tradingFeeTier,
  };
}

export async function fetchVolumeRank(address: string, signal?: AbortSignal): Promise<number | null> {
  const d = await get<{ entries: { rank: number }[] }>(
    `/v1/leaderboard?address=${address}&window=30d&sortBy=volume`,
    signal,
  );
  return d.entries[0]?.rank ?? null;
}

interface RawFill {
  tradeId: string;
  orderId: string;
  marketDisplayName: string;
  side: "BUY" | "SELL";
  role: "MAKER" | "TAKER";
  size: string;
  price: string;
  fee: string;
  closedPnl?: string;
  createdAt: number;
}

const PAGE_SIZE = 1000;

export interface FillProgress {
  fills: Fill[];
  oldestLoaded: number | null; // epoch µs
  done: boolean;
}

/**
 * Streams an account's fills newest-first back to `fromUs`, paging with the `to` bound.
 * Calls `onPage` after each page so the UI can render progressively. Stops at `maxFills`
 * (very active accounts can have hundreds of thousands of fills per month).
 */
export async function streamFills(opts: {
  address: string;
  accountIndex?: number;
  fromUs: number;
  maxFills: number;
  signal?: AbortSignal;
  onPage: (p: FillProgress) => void;
}): Promise<FillProgress> {
  const { address, accountIndex = 0, fromUs, maxFills, signal, onPage } = opts;
  const all: Fill[] = [];
  const seen = new Set<string>();
  let to: number | null = null;

  while (true) {
    const q = new URLSearchParams({
      address,
      accountIndex: String(accountIndex),
      limit: String(PAGE_SIZE),
      from: String(fromUs),
    });
    if (to !== null) q.set("to", String(to));
    const { fills } = await get<{ fills: RawFill[] }>(`/v1/fills?${q}`, signal);

    let added = 0;
    for (const f of fills) {
      // A trade yields one fill per order leg, so key on both ids.
      const key = `${f.tradeId}:${f.orderId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const size = Number(f.size);
      const price = Number(f.price);
      all.push({
        key,
        market: f.marketDisplayName,
        side: f.side,
        role: f.role,
        size,
        price,
        notional: size * price,
        fee: Number(f.fee),
        pnl: Number(f.closedPnl ?? -Number(f.fee)),
        createdAt: f.createdAt,
      });
      added++;
    }

    const oldest = fills.length ? fills[fills.length - 1].createdAt : null;
    const exhausted = fills.length < PAGE_SIZE || oldest === null || oldest <= fromUs;
    const capped = all.length >= maxFills;
    const progress: FillProgress = {
      fills: all,
      oldestLoaded: all.length ? all[all.length - 1].createdAt : null,
      done: exhausted || capped,
    };
    onPage(progress);
    if (progress.done) return progress;

    // Re-request from the oldest timestamp (inclusive) so fills sharing it aren't skipped;
    // if a page added nothing new, step past that timestamp to guarantee progress.
    to = added === 0 ? oldest! - 1 : oldest!;
  }
}

export interface Market {
  name: string;
  assetName: string;
  price: number;
  change24h: number; // fraction, 0.01 = +1%
  volume24h: number; // USD notional
  openInterest: number; // USD notional at mark
  fundingRate: number; // hourly, fraction
  nextFundingRate: number; // predicted next hour, fraction
  trades24h: number;
  category: string; // CRYPTO, EQUITIES, COMMODITIES, INDICES
  markPrice: number;
  initialMarginFraction: number; // max leverage = 1 / this
  maintenanceMarginFraction: number;
}

interface RawMarket {
  marketDisplayName: string;
  fullAssetName: string;
  status: string;
  lastTradePrice: string;
  markPrice: string;
  priceChange24h: string;
  volume24hNotional: string;
  openInterest: string;
  fundingRate: string;
  nextFundingRate?: string;
  trades24h: number;
  category?: string;
  initialMarginFraction?: string;
  maintenanceMarginFraction?: string;
}

export async function fetchMarkets(signal?: AbortSignal): Promise<Market[]> {
  const { markets } = await get<{ markets: RawMarket[] }>("/v1/markets", signal);
  return markets
    .filter((m) => m.status === "ONLINE")
    .map((m) => ({
      name: m.marketDisplayName,
      assetName: m.fullAssetName,
      price: Number(m.lastTradePrice ?? m.markPrice),
      change24h: Number(m.priceChange24h ?? 0),
      volume24h: Number(m.volume24hNotional ?? 0),
      openInterest: Number(m.openInterest ?? 0) * Number(m.markPrice ?? 0),
      fundingRate: Number(m.fundingRate ?? 0),
      nextFundingRate: Number(m.nextFundingRate ?? m.fundingRate ?? 0),
      markPrice: Number(m.markPrice ?? m.lastTradePrice),
      initialMarginFraction: Number(m.initialMarginFraction ?? 0.1),
      maintenanceMarginFraction: Number(m.maintenanceMarginFraction ?? 0.05),
      trades24h: m.trades24h ?? 0,
      category: m.category ?? "OTHER",
    }))
    .sort((a, b) => b.volume24h - a.volume24h);
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  volume: number;
  feesPaid: number;
  pnl: number;
}

export async function fetchLeaderboard(
  sortBy: "volume" | "fees" | "pnl",
  window: "24h" | "30d" | "all",
  limit = 10,
  signal?: AbortSignal,
): Promise<LeaderboardEntry[]> {
  const d = await get<{ entries: { rank: number; address: string; volume: number; feesPaid: number; pnl: number }[] }>(
    `/v1/leaderboard?sortBy=${sortBy}&window=${window}&limit=${limit}`,
    signal,
  );
  return d.entries.map((e) => ({
    rank: e.rank,
    address: e.address,
    volume: fromScaled(e.volume),
    feesPaid: fromScaled(e.feesPaid),
    pnl: fromScaled(e.pnl),
  }));
}

export interface FundingPayment {
  market: string;
  payment: number; // USD; positive = received, negative = paid
  rate: number;
  time: number; // epoch µs
}

/** Funding payments since `fromUs`, newest first, paged by the `to` bound like fills. */
export async function fetchFunding(address: string, fromUs: number, signal?: AbortSignal, maxPages = 20, accountIndex = 0): Promise<FundingPayment[]> {
  const out: FundingPayment[] = [];
  const seen = new Set<string>();
  let to: number | null = null;
  for (let page = 0; page < maxPages; page++) {
    const q = new URLSearchParams({ address, accountIndex: String(accountIndex), from: String(fromUs), limit: "1000" });
    if (to !== null) q.set("to", String(to));
    const { fundingPayments } = await get<{
      fundingPayments: { marketDisplayName: string; payment: string; fundingRate: string; time: number }[];
    }>(`/v1/funding?${q}`, signal);
    let added = 0;
    for (const p of fundingPayments) {
      const key = `${p.marketDisplayName}:${p.time}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ market: p.marketDisplayName, payment: Number(p.payment), rate: Number(p.fundingRate), time: p.time });
      added++;
    }
    if (fundingPayments.length < 1000) break;
    const oldest = fundingPayments[fundingPayments.length - 1].time;
    to = added === 0 ? oldest - 1 : oldest;
  }
  return out;
}

export interface Transfer {
  id: string;
  type: string; // DEPOSIT, WITHDRAWAL, TRANSFER, REFERRAL_CLAIM, …
  status: string;
  amount: number;
  createdAt: number; // epoch µs
}

export async function fetchTransfers(address: string, signal?: AbortSignal, accountIndex = 0): Promise<Transfer[]> {
  const d = await get<{ accountTransferUpdates: { id: string; type: string; status: string; amount: string; createdAt: number }[] }>(
    `/v1/accountTransferUpdates?address=${address}&accountIndex=${accountIndex}&limit=1000`,
    signal,
  );
  return d.accountTransferUpdates.map((t) => ({ id: t.id, type: t.type, status: t.status, amount: Number(t.amount), createdAt: t.createdAt }));
}

export type PortfolioRange = "Day" | "Week" | "Month" | "All";

export interface Portfolio {
  lifetimeVolume: number;
  // Trading + funding PnL over each range, as reported by Arcus (each series is rebased to start at 0).
  pnl: Record<PortfolioRange, number>;
  equity: number;
}

export async function fetchPortfolio(address: string, signal?: AbortSignal, accountIndex = 0): Promise<Portfolio | null> {
  try {
    const d = await get<{ lifetimeVolume: string; data: [string, { pnlHistory: [number, string][]; accountEquityHistory: [number, string][] }][] }>(
      `/v1/portfolio?address=${address}&accountIndex=${accountIndex}`,
      signal,
    );
    const series = Object.fromEntries(d.data);
    const last = (k: string, f: "pnlHistory" | "accountEquityHistory") => Number(series[k]?.[f]?.at(-1)?.[1] ?? 0);
    return {
      lifetimeVolume: Number(d.lifetimeVolume),
      pnl: { Day: last("totalDay", "pnlHistory"), Week: last("totalWeek", "pnlHistory"), Month: last("totalMonth", "pnlHistory"), All: last("totalAll", "pnlHistory") },
      equity: last("totalDay", "accountEquityHistory"),
    };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null; // no activity yet
    throw e;
  }
}

/** The address's rank on one leaderboard, or null if it didn't trade in that window. */
export async function fetchRank(
  address: string,
  sortBy: "volume" | "fees" | "pnl",
  window: "24h" | "30d" | "all",
  signal?: AbortSignal,
): Promise<number | null> {
  const d = await get<{ entries: { rank: number }[] }>(`/v1/leaderboard?address=${address}&window=${window}&sortBy=${sortBy}`, signal);
  return d.entries[0]?.rank ?? null;
}

/** Subaccounts (0–9) that have any activity. `GET /v1/account` answers 404 for unused ones. */
export async function fetchActiveSubaccounts(address: string, signal?: AbortSignal): Promise<number[]> {
  const probes = await Promise.all(
    Array.from({ length: 10 }, async (_, i) => {
      const res = await fetch(`${API_BASE}/v1/account?address=${address}&accountIndex=${i}`, { signal, cache: "no-store" });
      return res.ok ? i : null;
    }),
  );
  const active = probes.filter((i): i is number => i !== null);
  return active.length ? active : [0];
}
