import { get, set } from "idb-keyval";
import { streamFills, type Fill, type FillProgress } from "./arcus";

// Keeps each account's fills in IndexedDB so a return visit only downloads what's new.
// An entry is trusted only when it holds every fill from `fromUs` to `toUs`.

interface Entry {
  fills: Fill[]; // newest first
  fromUs: number;
  toUs: number;
}

const key = (address: string, accountIndex: number) => `fills:v2:${address}:${accountIndex}`;
const OVERLAP_US = 120_000_000; // re-read the last two minutes in case fills landed late

async function readCache(k: string): Promise<Entry | undefined> {
  try {
    return await get<Entry>(k);
  } catch {
    return undefined; // IndexedDB unavailable (private mode, blocked storage)
  }
}

async function writeCache(k: string, e: Entry) {
  try {
    await set(k, e);
  } catch {}
}

export async function loadFills(opts: {
  address: string;
  accountIndex: number;
  fromUs: number;
  maxFills: number;
  signal?: AbortSignal;
  onPage: (p: FillProgress) => void;
}): Promise<FillProgress & { fromCache: boolean }> {
  const { address, accountIndex, fromUs, maxFills, signal, onPage } = opts;
  const k = key(address, accountIndex);
  const nowUs = Date.now() * 1000;
  const cached = await readCache(k);

  if (cached && cached.fromUs <= fromUs) {
    const old = cached.fills.filter((f) => f.createdAt >= fromUs);
    onPage({ fills: old, oldestLoaded: old.at(-1)?.createdAt ?? null, done: false });
    const fresh = await streamFills({
      address, accountIndex, fromUs: cached.toUs - OVERLAP_US, maxFills, signal,
      onPage: (p) => onPage({ ...merge(p.fills, old), done: false }),
    });
    if (!(fresh.done && fresh.fills.length >= maxFills)) {
      const merged = merge(fresh.fills, cached.fills);
      // Drop fills older than this request's range so the entry can't grow without bound.
      const kept = merged.fills.length > maxFills ? merged.fills.filter((f) => f.createdAt >= fromUs) : merged.fills;
      await writeCache(k, { fills: kept, fromUs: kept === merged.fills ? cached.fromUs : fromUs, toUs: nowUs });
      const inRange = merge(fresh.fills, old);
      const result = { ...inRange, done: true };
      onPage(result);
      return { ...result, fromCache: true };
    }
    // Too much new activity to stitch safely — fall through to a clean load.
  }

  const p = await streamFills({ address, accountIndex, fromUs, maxFills, signal, onPage });
  if (p.fills.length < maxFills) await writeCache(k, { fills: p.fills, fromUs, toUs: nowUs });
  return { ...p, fromCache: false };
}

function merge(newer: Fill[], older: Fill[]): FillProgress {
  const seen = new Set(newer.map((f) => f.key));
  const fills = [...newer, ...older.filter((f) => !seen.has(f.key))].sort((a, b) => b.createdAt - a.createdAt);
  return { fills, oldestLoaded: fills.at(-1)?.createdAt ?? null, done: true };
}
