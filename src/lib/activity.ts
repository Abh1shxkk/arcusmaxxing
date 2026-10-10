import "server-only";
import { API_BASE, fetchMarkets } from "./arcus";
import { kvPipeline } from "./kv";

// Exact active-trader counts from Arcus's public trades (every row names its maker and taker).
// A scheduled collector reads new trades for every market and folds them into one sorted set per
// UTC day: member = wallet, score = trades that day. ZCARD of a day = daily actives; ZUNIONSTORE
// over 7 / 30 days = weekly / monthly actives. It also walks backwards through older trades, a
// slice per run, until it has BACKFILL_DAYS of history.
//
//   act:t:{YYYY-MM-DD}  sorted set wallet → trades       act:days   hash {day}:t / {day}:v (trades, volume)
//   act:cursor          hash market → newest µs seen      act:fill   hash market → oldest µs seen
//   act:since           first run (ms)                    act:lock   run lock

const DAY = 86_400_000;
const BACKFILL_DAYS = 30;
const PAGE = 1000;
const KEEP_SECONDS = 40 * 86_400;
export const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

interface RawTrade {
  tradeId: string;
  timestamp: number; // µs
  makerAddress: string;
  takerAddress: string;
  price: string;
  size: string;
}

class Budget {
  constructor(private readonly deadline: number) {}
  get left() {
    return this.deadline - Date.now();
  }
}

/** One page of trades, newest first. Waits out a 429 if there's time, otherwise gives up. */
async function tradesPage(market: string, budget: Budget, bounds: { from?: number; to?: number }): Promise<RawTrade[] | null> {
  const q = new URLSearchParams({ market, limit: String(PAGE) });
  if (bounds.from != null) q.set("from", String(bounds.from));
  if (bounds.to != null) q.set("to", String(bounds.to));
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${API_BASE}/v1/trades?${q}`, { cache: "no-store" });
    if (res.status === 429) {
      const wait = ((await res.json().catch(() => ({}))) as { retryAfterMs?: number }).retryAfterMs ?? 2000;
      if (wait > budget.left - 3000) return null;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) return null;
    return ((await res.json()) as { trades: RawTrade[] }).trades ?? [];
  }
  return null;
}

class Tally {
  days = new Map<string, { counts: Map<string, number>; trades: number; volume: number }>();
  add(trades: RawTrade[]) {
    for (const t of trades) {
      const key = dayKey(t.timestamp / 1000);
      let d = this.days.get(key);
      if (!d) this.days.set(key, (d = { counts: new Map(), trades: 0, volume: 0 }));
      for (const a of [t.makerAddress, t.takerAddress]) {
        if (a) d.counts.set(a.toLowerCase(), (d.counts.get(a.toLowerCase()) ?? 0) + 1);
      }
      d.trades += 1;
      d.volume += Number(t.price) * Number(t.size);
    }
  }
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: limit }, async () => {
    while (queue.length) await fn(queue.shift()!);
  }));
}

export async function collect({ budgetMs = 45_000 } = {}) {
  const budget = new Budget(Date.now() + budgetMs);
  const [locked] = await kvPipeline([["SET", "act:lock", "1", "NX", "EX", 120]]);
  if (locked !== "OK") return { skipped: "another run is in progress" };

  try {
    const markets = (await fetchMarkets()).map((m) => m.name);
    const [cursorRaw, fillRaw, sinceRaw] = await kvPipeline([["HGETALL", "act:cursor"], ["HGETALL", "act:fill"], ["GET", "act:since"]]);
    const cursor = toMap(cursorRaw);
    const fill = toMap(fillRaw);
    const now = Date.now();
    const since = sinceRaw ? Number(sinceRaw) : now;
    const targetUs = (since - BACKFILL_DAYS * DAY) * 1000;
    const tally = new Tally();
    let requests = 0;

    // 1. Forward: everything newer than each market's cursor.
    await mapLimit(markets, 6, async (m) => {
      const fromUs = cursor[m] != null ? cursor[m] + 1 : (now - 10 * 60_000) * 1000;
      if (fill[m] == null) fill[m] = fromUs; // backfill starts where live collection starts
      let to: number | undefined;
      for (let p = 0; p < 10 && budget.left > 15_000; p++) {
        const rows = await tradesPage(m, budget, { from: fromUs, to });
        requests++;
        if (!rows) return;
        tally.add(rows);
        if (rows.length) cursor[m] = Math.max(cursor[m] ?? 0, rows[0].timestamp);
        if (rows.length < PAGE) return;
        to = rows[rows.length - 1].timestamp - 1;
      }
    });

    // 2. Backward: fill older history, round-robin, while time remains.
    let pending = markets.filter((m) => fill[m] > targetUs);
    while (pending.length && budget.left > 12_000) {
      await mapLimit(pending.slice(0, 6), 6, async (m) => {
        const rows = await tradesPage(m, budget, { from: targetUs, to: fill[m] - 1 });
        requests++;
        if (!rows) return;
        tally.add(rows);
        fill[m] = rows.length < PAGE ? targetUs : rows[rows.length - 1].timestamp;
      });
      pending = markets.filter((m) => fill[m] > targetUs);
      pending.push(...pending.splice(0, 6)); // rotate so every market gets turns
    }

    // 3. Write: per day, one variadic ZADD into a temp set, summed into the day's set.
    const commands: (string | number)[][] = [];
    if (!sinceRaw) commands.push(["SET", "act:since", now]);
    for (const [day, d] of tally.days) {
      const key = `act:t:${day}`;
      const tmp = `act:tmp:${day}:${now}`;
      const entries = [...d.counts.entries()];
      for (let i = 0; i < entries.length; i += 500) {
        commands.push(["ZADD", tmp, ...entries.slice(i, i + 500).flatMap(([a, n]) => [n, a])]);
      }
      commands.push(["ZUNIONSTORE", key, 2, key, tmp], ["DEL", tmp], ["EXPIRE", key, KEEP_SECONDS]);
      commands.push(["HINCRBY", "act:days", `${day}:t`, d.trades], ["HINCRBYFLOAT", "act:days", `${day}:v`, d.volume.toFixed(2)]);
    }
    const cursorFields = Object.entries(cursor).flatMap(([m, v]) => [m, v]);
    const fillFields = Object.entries(fill).flatMap(([m, v]) => [m, v]);
    if (cursorFields.length) commands.push(["HSET", "act:cursor", ...cursorFields]);
    if (fillFields.length) commands.push(["HSET", "act:fill", ...fillFields]);
    commands.push(["DEL", "act:cache"]);
    if (commands.length) await kvPipeline(commands);

    return {
      requests,
      days: [...tally.days.keys()],
      trades: [...tally.days.values()].reduce((s, d) => s + d.trades, 0),
      backfillPending: markets.filter((m) => fill[m] > targetUs).length,
    };
  } finally {
    await kvPipeline([["DEL", "act:lock"]]);
  }
}

function toMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const list = (raw as string[]) ?? [];
  for (let i = 0; i < list.length; i += 2) out[list[i]] = Number(list[i + 1]);
  return out;
}

export interface ActivitySummary {
  generatedAt: number;
  coveredFrom: number | null; // ms: every market's trades are recorded from here on
  since: number | null; // ms: first collector run
  today: number;
  yesterday: number;
  week: number; // unique wallets, last 7 UTC days incl. today
  month: number; // unique wallets, last 30 UTC days incl. today
  daily: { day: string; traders: number; trades: number; volume: number }[];
  topToday: { address: string; trades: number }[];
  topWeek: { address: string; trades: number }[];
}

/** Daily / weekly / monthly unique traders, cached for 15 minutes to stay light on the database. */
export async function activitySummary(): Promise<ActivitySummary | null> {
  const [cached] = await kvPipeline([["GET", "act:cache"]]);
  if (cached) return JSON.parse(cached as string);

  const now = Date.now();
  const days = Array.from({ length: 30 }, (_, i) => dayKey(now - i * DAY)); // newest first
  const keys = days.map((d) => `act:t:${d}`);
  const wk = `act:tmp:week:${now}`;
  const mo = `act:tmp:month:${now}`;
  const results = await kvPipeline([
    ["GET", "act:since"],
    ["HVALS", "act:fill"],
    ["HGETALL", "act:days"],
    ...keys.map((k) => ["ZCARD", k]),
    ["ZUNIONSTORE", wk, 7, ...keys.slice(0, 7)],
    ["ZUNIONSTORE", mo, 30, ...keys],
    ["ZREVRANGE", keys[0], 0, 19, "WITHSCORES"],
    ["ZREVRANGE", wk, 0, 19, "WITHSCORES"],
    ["DEL", wk, mo],
  ]);
  const since = results[0] ? Number(results[0]) : null;
  if (!since) return null;
  const fills = ((results[1] as string[]) ?? []).map(Number);
  const dayStats = toMap(results[2]);
  const cards = results.slice(3, 33).map(Number);
  const pairs = (raw: unknown) => {
    const l = (raw as string[]) ?? [];
    const out: { address: string; trades: number }[] = [];
    for (let i = 0; i < l.length; i += 2) out.push({ address: l[i], trades: Number(l[i + 1]) });
    return out;
  };
  const summary: ActivitySummary = {
    generatedAt: now,
    since,
    coveredFrom: fills.length ? Math.max(...fills) / 1000 : null,
    today: cards[0],
    yesterday: cards[1],
    week: Number(results[33]),
    month: Number(results[34]),
    daily: days.map((d, i) => ({ day: d, traders: cards[i], trades: dayStats[`${d}:t`] ?? 0, volume: dayStats[`${d}:v`] ?? 0 })).reverse(),
    topToday: pairs(results[35]),
    topWeek: pairs(results[36]),
  };
  await kvPipeline([["SET", "act:cache", JSON.stringify(summary), "EX", 900]]);
  return summary;
}
