"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ApiError,
  fetchAccountStats,
  fetchActiveSubaccounts,
  fetchFeeTiers,
  fetchFunding,
  fetchMarkets,
  fetchVolumeRank,
  type AccountStats,
  type FeeTier,
  type Fill,
  type FundingPayment,
  type Market,
} from "@/lib/arcus";
import { bucketize, isPartialWeek, totals, type Bucket, type Totals } from "@/lib/aggregate";
import { loadPoints, savePoints, type PointsMap } from "@/lib/points";
import { loadFills } from "@/lib/fillCache";

// Lives in the root layout, so the tracked wallets and their loaded history survive page navigation.
// The view is either one wallet or ALL saved wallets combined.

export type Range = "7d" | "30d" | "90d";
/** A single subaccount index (0–9), or every active subaccount merged. */
export type Sub = number | "all";
/** Selection value meaning "every saved wallet, combined". */
export const ALL = "all";
const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };
// Very active accounts can have 1,000+ fills an hour; cap history so loading stays bounded.
const MAX_FILLS = 100_000;
export const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const LAST_ADDRESS_KEY = "arcus-last-address";
const WALLETS_KEY = "arcus-wallets";

export interface FillState {
  fills: Fill[];
  loading: boolean;
  done: boolean;
  capped: boolean;
  oldestLoaded: number | null;
}

const emptyFills: FillState = { fills: [], loading: false, done: false, capped: false, oldestLoaded: null };

interface Tracker {
  /** The wallet in view, or ALL for every saved wallet combined; null before anything is tracked. */
  address: string | null;
  /** Real wallet addresses in the current view (one, or all saved wallets). */
  addresses: string[];
  combined: boolean;
  wallets: string[]; // saved wallets, in the order they were added
  walletStats: Record<string, AccountStats>; // per-wallet stats for the wallets in view
  removeWallet: (address: string) => void;
  viewAll: () => void;
  account: Sub;
  subaccounts: number[] | null; // active subaccounts of the single wallet in view
  changeAccount: (a: Sub) => void;
  range: Range;
  tiers: FeeTier[] | null;
  markets: Market[] | null;
  stats: AccountStats | null;
  rank: number | null;
  funding: FundingPayment[] | null; // funding payments in the loaded range, null while loading
  fillState: FillState;
  error: string | null;
  now: number;
  rangeStart: number;
  coverageStart: number;
  sum: Totals;
  weeks: Bucket[];
  modelWeeks: (Bucket & { points?: number })[];
  points: PointsMap;
  pointsEditable: boolean; // points are per wallet, so the combined view is read-only
  open: (address: string) => void;
  changeRange: (r: Range) => void;
  changePoints: (p: PointsMap) => void;
  stop: () => void;
  setError: (e: string | null) => void;
}

const TrackerContext = createContext<Tracker | null>(null);

export function useTracker() {
  const t = useContext(TrackerContext);
  if (!t) throw new Error("useTracker must be used inside <TrackerProvider>");
  return t;
}

function readWallets(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(WALLETS_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((a) => typeof a === "string" && ADDRESS_RE.test(a)) : [];
  } catch {
    return [];
  }
}

function writeWallets(list: string[]) {
  try {
    localStorage.setItem(WALLETS_KEY, JSON.stringify(list));
  } catch {}
}

/** Sum several wallets' stats. The fee tier shown is the best one among them — tiers are per wallet. */
function combineStats(list: AccountStats[]): AccountStats {
  const sum = (f: (s: AccountStats) => number) => list.reduce((t, s) => t + f(s), 0);
  const win = (k: "24h" | "7d" | "30d") => ({ volume: sum((s) => s.windows[k].volume), feesPaid: sum((s) => s.windows[k].feesPaid) });
  const best = list.reduce((a, b) => (b.tier.level > a.tier.level ? b : a), list[0]);
  return {
    rollingVolume: sum((s) => s.rollingVolume),
    rollingFeesPaid: sum((s) => s.rollingFeesPaid),
    lifetimeVolume: sum((s) => s.lifetimeVolume),
    lifetimeFeesPaid: sum((s) => s.lifetimeFeesPaid),
    windows: { "24h": win("24h"), "7d": win("7d"), "30d": win("30d") },
    tier: best.tier,
  };
}

export function TrackerProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<string | null>(null);
  const [wallets, setWallets] = useState<string[]>([]);
  const [range, setRange] = useState<Range>("30d");
  const [account, setAccount] = useState<Sub>(0);
  const [subaccounts, setSubaccounts] = useState<number[] | null>(null);
  const [tiers, setTiers] = useState<FeeTier[] | null>(null);
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [points, setPoints] = useState<PointsMap>({});
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [walletStats, setWalletStats] = useState<Record<string, AccountStats>>({});
  const [rank, setRank] = useState<number | null>(null);
  const [funding, setFunding] = useState<FundingPayment[] | null>(null);
  const [fillState, setFillState] = useState<FillState>(emptyFills);
  const [error, setError] = useState<string | null>(null);
  // Set when a load starts; reading the clock during render would break prerendering.
  const [now, setNow] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Load everything for a set of wallets. One wallet honours the subaccount choice; several wallets
   * each contribute their main account, tagged so per-wallet breakdowns stay possible.
   */
  const load = useCallback(async (addrs: string[], r: Range, sub: Sub, subs: number[] | null) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const signal = ctrl.signal;
    const t = Date.now();
    const multi = addrs.length > 1;
    setNow(t);
    setError(null);
    setStats(null);
    setWalletStats({});
    setRank(null);
    setFunding(null);
    setFillState({ ...emptyFills, loading: true });

    const fail = (e: unknown, fallback: string) => {
      if ((e as Error).name !== "AbortError") setError(e instanceof ApiError ? e.message : fallback);
    };

    Promise.all(addrs.map((a) => fetchAccountStats(a, signal)))
      .then((list) => {
        setWalletStats(Object.fromEntries(addrs.map((a, i) => [a, list[i]])));
        setStats(multi ? combineStats(list) : list[0]);
      })
      .catch((e) => fail(e, "Couldn't reach Arcus."));
    if (!multi) fetchVolumeRank(addrs[0], signal).then(setRank).catch(() => {});

    // Which (wallet, subaccount) pairs make up this view.
    const parts = multi ? addrs.map((a) => ({ address: a, index: 0 })) : (sub === "all" ? (subs ?? [0]) : [sub]).map((i) => ({ address: addrs[0], index: i }));
    const fromUs = (t - RANGE_DAYS[r] * 86_400_000) * 1000;

    Promise.all(parts.map((p) => fetchFunding(p.address, fromUs, signal, 20, p.index)))
      .then((lists) => setFunding(lists.flat().sort((a, b) => b.time - a.time)))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setFunding([]);
      });

    try {
      // Parts load one after another; earlier ones stay on screen while the next streams in.
      let done: Fill[] = [];
      let capped = false;
      for (const [i, part] of parts.entries()) {
        const last = i === parts.length - 1;
        const tag = (fills: Fill[]) => (multi ? fills.map((f) => ({ ...f, wallet: part.address, key: `${part.address}:${f.key}` })) : fills);
        const p = await loadFills({
          address: part.address,
          accountIndex: part.index,
          fromUs,
          maxFills: MAX_FILLS,
          signal,
          onPage: (p) => {
            const fills = parts.length > 1 ? mergeFills(done, tag(p.fills)) : p.fills;
            setFillState({
              fills,
              loading: !(p.done && last),
              done: p.done && last,
              capped: capped || (p.done && p.fills.length >= MAX_FILLS),
              oldestLoaded: fills.at(-1)?.createdAt ?? null,
            });
          },
        });
        capped ||= p.fills.length >= MAX_FILLS;
        done = parts.length > 1 ? mergeFills(done, tag(p.fills)) : p.fills;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setFillState((s) => ({ ...s, loading: false }));
      fail(e, "Couldn't load trade history from Arcus.");
    }
  }, []);

  const showWallet = useCallback((addr: string, r: Range) => {
    setSelection(addr);
    setPoints(loadPoints(addr));
    setAccount(0);
    setSubaccounts(null);
    fetchActiveSubaccounts(addr).then(setSubaccounts).catch(() => setSubaccounts([0]));
    load([addr], r, 0, null);
    try {
      localStorage.setItem(LAST_ADDRESS_KEY, addr);
    } catch {}
    window.history.replaceState(null, "", `${window.location.pathname}?address=${addr}`);
  }, [load]);

  const showAll = useCallback((list: string[], r: Range) => {
    if (list.length === 0) return;
    if (list.length === 1) return showWallet(list[0], r);
    setSelection(ALL);
    // Points are per wallet; the combined view adds them up, read-only.
    const merged: PointsMap = {};
    for (const a of list) for (const [week, p] of Object.entries(loadPoints(a))) merged[week] = (merged[week] ?? 0) + p;
    setPoints(merged);
    setAccount(0);
    setSubaccounts(null);
    load(list, r, 0, null);
    try {
      localStorage.setItem(LAST_ADDRESS_KEY, ALL);
    } catch {}
    window.history.replaceState(null, "", window.location.pathname);
  }, [load, showWallet]);

  useEffect(() => {
    fetchFeeTiers().then(setTiers).catch(() => setTiers([]));
    fetchMarkets().then(setMarkets).catch(() => setMarkets([]));
    // Restore saved wallets, then ?address= from a shared link, else the last view used here.
    // These live outside React and are only readable after hydration, hence the one-off sync.
    let saved = readWallets();
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_ADDRESS_KEY);
    } catch {}
    const fromUrl = new URLSearchParams(window.location.search).get("address")?.toLowerCase() ?? null;
    if (last && ADDRESS_RE.test(last) && !saved.includes(last)) saved = [...saved, last]; // carry over from single-wallet versions
    const initial = fromUrl && ADDRESS_RE.test(fromUrl) ? fromUrl : last;
    if (initial && ADDRESS_RE.test(initial) && !saved.includes(initial)) saved = [...saved, initial];
    writeWallets(saved);
    /* eslint-disable react-hooks/set-state-in-effect */
    setWallets(saved);
    if (initial === ALL && saved.length > 1) showAll(saved, "30d");
    else if (initial && ADDRESS_RE.test(initial)) showWallet(initial, "30d");
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => abortRef.current?.abort();
  }, [showAll, showWallet]);

  /** Track a wallet: remember it and switch the view to it. */
  const open = useCallback((addr: string) => {
    const a = addr.toLowerCase();
    setWallets((list) => {
      const next = list.includes(a) ? list : [...list, a];
      writeWallets(next);
      return next;
    });
    showWallet(a, range);
  }, [showWallet, range]);

  const viewAll = useCallback(() => showAll(wallets, range), [showAll, wallets, range]);

  const removeWallet = useCallback((addr: string) => {
    const next = wallets.filter((w) => w !== addr);
    setWallets(next);
    writeWallets(next);
    if (selection === addr || (selection === ALL && next.length < 2)) {
      if (next.length > 1 && selection === ALL) showAll(next, range);
      else if (next.length) showWallet(next[next.length - 1], range);
      else {
        abortRef.current?.abort();
        setSelection(null);
        setStats(null);
        setFillState(emptyFills);
        try {
          localStorage.removeItem(LAST_ADDRESS_KEY);
        } catch {}
        window.history.replaceState(null, "", window.location.pathname);
      }
    } else if (selection === ALL) {
      showAll(next, range);
    }
  }, [wallets, selection, range, showAll, showWallet]);

  const combined = selection === ALL;
  const addresses = useMemo(() => (combined ? wallets : selection ? [selection] : []), [combined, wallets, selection]);

  const changeRange = useCallback((r: Range) => {
    setRange(r);
    if (addresses.length) load(addresses, r, account, subaccounts);
  }, [addresses, load, account, subaccounts]);

  const changeAccount = useCallback((a: Sub) => {
    setAccount(a);
    if (addresses.length === 1) load(addresses, range, a, subaccounts);
  }, [addresses, load, range, subaccounts]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setFillState((s) => ({ ...s, loading: false, done: true, capped: true }));
  }, []);

  const changePoints = useCallback((next: PointsMap) => {
    if (combined || !selection) return;
    setPoints(next);
    savePoints(selection, next);
  }, [combined, selection]);

  const rangeStart = now - RANGE_DAYS[range] * 86_400_000;
  const coverageStart = fillState.capped && fillState.oldestLoaded ? fillState.oldestLoaded / 1000 : rangeStart;
  const sum = useMemo(() => totals(fillState.fills), [fillState.fills]);
  const weeks = useMemo(() => bucketize(fillState.fills, "week", coverageStart, now), [fillState.fills, coverageStart, now]);
  // Only complete weeks feed the points model; partial ones would understate fees.
  const modelWeeks = useMemo(
    () => weeks.filter((w) => !isPartialWeek(w.start, coverageStart, now)).map((w) => ({ ...w, points: points[w.start] })),
    [weeks, points, coverageStart, now],
  );

  const value: Tracker = {
    address: selection, addresses, combined, wallets, walletStats, removeWallet, viewAll,
    account, subaccounts, changeAccount, range, tiers, markets, stats, rank, funding, fillState, error, now, rangeStart, coverageStart,
    sum, weeks, modelWeeks, points, pointsEditable: !combined, open, changeRange, changePoints, stop, setError,
  };
  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

function mergeFills(a: Fill[], b: Fill[]): Fill[] {
  const seen = new Set(a.map((f) => f.key));
  return [...a, ...b.filter((f) => !seen.has(f.key))].sort((x, y) => y.createdAt - x.createdAt);
}
