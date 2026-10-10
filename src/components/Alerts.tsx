"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { fetchAccountStats, type AccountStats, type FeeTier } from "@/lib/arcus";
import { CREATURES } from "@/lib/traderProfile";
import { ALL, useTracker } from "./TrackerProvider";
import { Card } from "./ui";

// Milestone alerts while the site is open: the watcher re-reads the tracked wallet's stats every
// few minutes and compares them with the last snapshot it saw for that wallet.

type Kind = "tier" | "invite" | "creature";
const PREFS_KEY = "arcus-alert-prefs";
const SNAP_KEY = (a: string) => `arcus-alert-snap:${a}`;
const POLL_MS = 5 * 60_000;
const INVITE_STEP = 1_000_000;

const DEFAULT_PREFS: Record<Kind, boolean> = { tier: true, invite: true, creature: true };

function readPrefs(): Record<Kind, boolean> {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

interface Snapshot {
  tier: number;
  codes: number;
  creature: number;
}

const snapshotOf = (s: AccountStats): Snapshot => ({
  tier: s.tier.level,
  codes: Math.floor(s.lifetimeVolume / INVITE_STEP),
  creature: CREATURES.reduce((best, c, i) => (s.rollingVolume >= c.minVolume ? i : best), 0),
});

function diff(prev: Snapshot, next: Snapshot, tiers: FeeTier[] | null): { kind: Kind; text: string }[] {
  const out: { kind: Kind; text: string }[] = [];
  if (next.tier > prev.tier) out.push({ kind: "tier", text: `You reached the ${tiers?.find((t) => t.level === next.tier)?.name ?? "next"} fee tier. Cheaper trades from here.` });
  if (next.codes > prev.codes) out.push({ kind: "invite", text: `You earned ${next.codes - prev.codes === 1 ? "a new invite code" : `${next.codes - prev.codes} invite codes`} on Arcus.` });
  if (next.creature > prev.creature) out.push({ kind: "creature", text: `You evolved into a ${CREATURES[next.creature].name} ${CREATURES[next.creature].emoji}. Update your trader card.` });
  return out;
}

interface Toast {
  id: number;
  text: string;
}

/** Mounted once in the layout. Polls, compares and notifies. */
export function AlertsWatcher() {
  const { address, stats, tiers } = useTracker();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!address || address === ALL) return; // milestones are per wallet
    const check = (s: AccountStats) => {
      const next = snapshotOf(s);
      let prev: Snapshot | null = null;
      try {
        prev = JSON.parse(localStorage.getItem(SNAP_KEY(address)) ?? "null");
        localStorage.setItem(SNAP_KEY(address), JSON.stringify(next));
      } catch {}
      if (!prev) return; // first visit just records a baseline
      const prefs = readPrefs();
      for (const a of diff(prev, next, tiers).filter((a) => prefs[a.kind])) {
        setToasts((t) => [...t, { id: Date.now() + Math.random(), text: a.text }]);
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("ArcusMaxxing", { body: a.text, icon: "/icon.svg" });
        }
      }
    };
    if (stats) check(stats);
    const timer = setInterval(() => fetchAccountStats(address).then(check).catch(() => {}), POLL_MS);
    return () => clearInterval(timer);
  }, [address, stats, tiers]);

  if (!toasts.length) return null;
  return (
    <div className="fixed right-4 bottom-4 z-50 flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-2" role="status">
      {toasts.map((t) => (
        <div key={t.id} className="card rise flex items-start gap-3 p-4">
          <span className="mt-0.5 text-[18px]" aria-hidden>🎉</span>
          <p className="flex-1 text-[14px] leading-snug">{t.text}</p>
          <button onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} aria-label="Dismiss"
            className="grid h-6 w-6 place-items-center rounded-full text-ink-3 hover:bg-fill-2 hover:text-ink">×</button>
        </div>
      ))}
    </div>
  );
}

// Notification permission lives outside React; read it as an external store.
function subscribePermission(cb: () => void) {
  window.addEventListener("focus", cb);
  return () => window.removeEventListener("focus", cb);
}
const permission = () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);

// Saved alert preferences, also read as an external store so the server render stays default.
function subscribePrefs(cb: () => void) {
  window.addEventListener("arcus-alert-prefs", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("arcus-alert-prefs", cb);
    window.removeEventListener("storage", cb);
  };
}
const prefsSnapshot = () => {
  try {
    return localStorage.getItem(PREFS_KEY) ?? "";
  } catch {
    return "";
  }
};

export function AlertsCard() {
  const perm = useSyncExternalStore(subscribePermission, permission, () => "default");
  const raw = useSyncExternalStore(subscribePrefs, prefsSnapshot, () => "");
  const shown: Record<Kind, boolean> = { ...DEFAULT_PREFS, ...(raw ? safeParse(raw) : {}) };

  const toggle = (k: Kind) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ ...shown, [k]: !shown[k] }));
    } catch {}
    window.dispatchEvent(new Event("arcus-alert-prefs"));
  };

  const enable = async () => {
    if (typeof Notification === "undefined") return;
    await Notification.requestPermission();
    window.dispatchEvent(new Event("focus")); // refresh the permission read
  };

  const items: { kind: Kind; title: string; body: string }[] = [
    { kind: "tier", title: "New fee tier", body: "When your 30-day volume unlocks cheaper fees." },
    { kind: "invite", title: "New invite code", body: "Every $1M of lifetime volume earns one." },
    { kind: "creature", title: "Creature evolves", body: "When you move up the food chain on your trader card." },
  ];

  return (
    <Card title="Milestone alerts" subtitle="Checked every 5 minutes while this site is open in a tab.">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        {items.map((it) => (
          <label key={it.kind} className="flex cursor-pointer items-start gap-3 rounded-[14px] bg-fill-2 p-3.5">
            <input type="checkbox" checked={shown[it.kind]} onChange={() => toggle(it.kind)} className="mt-1 accent-[var(--accent)]" />
            <span>
              <span className="block text-[14px] font-semibold">{it.title}</span>
              <span className="block text-[12px] text-ink-2">{it.body}</span>
            </span>
          </label>
        ))}
        <div className="flex flex-col justify-center gap-1">
          {perm === "granted" ? (
            <p className="text-[13px] text-green">Browser notifications on</p>
          ) : perm === "denied" ? (
            <p className="text-[13px] text-ink-2">Notifications are blocked in your browser settings. You&apos;ll still see alerts on the page.</p>
          ) : perm === "unsupported" ? (
            <p className="text-[13px] text-ink-2">This browser can&apos;t show notifications. Alerts appear on the page.</p>
          ) : (
            <button onClick={enable} className="h-10 rounded-full bg-accent px-4 text-[14px] font-medium text-on-accent">
              Turn on notifications
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

function safeParse(raw: string): Partial<Record<Kind, boolean>> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
