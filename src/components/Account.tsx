"use client";

import { useState } from "react";
import { num, shortAddress, shortDate } from "@/lib/format";
import { ADDRESS_RE, ALL, useTracker, type FillState } from "./TrackerProvider";
import { Segmented, Select } from "./ui";
import { DegenAvatar } from "./DegenAvatar";

/** Wallet address form. `compact` is the single-row version used inside page cards. */
export function AddressSearch({ compact }: { compact?: boolean }) {
  const { address, open, error, setError } = useTracker();
  const shown = address && address !== ALL ? address : "";
  const [input, setInput] = useState(shown);
  const [synced, setSynced] = useState(shown);
  // Follow the tracked wallet when it changes elsewhere (e.g. picked from the leaderboard).
  if (shown !== synced) {
    setSynced(shown);
    setInput(shown);
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    if (!ADDRESS_RE.test(v)) {
      setError("Enter a valid wallet address — 0x followed by 40 hex characters.");
      return;
    }
    open(v);
  };

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor={compact ? "address-compact" : "address"} className="sr-only">Wallet address</label>
        <div className="flex flex-1 items-center gap-2 rounded-[14px] bg-fill-2 px-4 ring-accent focus-within:ring-2">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 text-ink-3" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            id={compact ? "address-compact" : "address"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a wallet address (0x…)"
            spellCheck={false}
            autoComplete="off"
            className={`${compact ? "h-11" : "h-12"} w-full bg-transparent font-mono text-[14px] outline-none placeholder:font-sans placeholder:text-ink-3`}
          />
        </div>
        <button type="submit"
          className={`${compact ? "h-11" : "h-12"} rounded-[14px] bg-accent px-6 text-[15px] font-medium text-on-accent transition hover:brightness-110 active:scale-[0.98]`}>
          Track
        </button>
      </form>
      {error && <p className="mt-3 text-[14px] text-red">{error}</p>}
    </div>
  );
}

/** Who is being tracked, their tier and rank, the history range picker and load progress. */
export function AccountBar() {
  const { address, combined, wallets, tiers, stats, rank, range, changeRange, fillState, rangeStart, now, stop, account, subaccounts, changeAccount } = useTracker();
  if (!address) return null;
  const tierName = tiers?.find((t) => t.level === stats?.tier.level)?.name;
  return (
    <div className="space-y-4">
      <WalletChips />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {combined ? <StackedAvatars addresses={wallets} /> : <Avatar address={address} />}
          <div>
            <p className={`text-[15px] font-medium ${combined ? "" : "font-mono"}`}>
              {combined ? `All wallets · ${wallets.length}` : shortAddress(address)}
            </p>
            <p className="text-[13px] text-ink-2">
              {combined
                ? `Combined main accounts${tierName ? ` · best tier ${tierName}` : ""}`
                : <>{tierName ? `${tierName} tier` : "Loading tier…"}{rank ? ` · #${num(rank)} by 30-day volume` : ""}</>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {!combined && subaccounts && subaccounts.length > 1 && (
          <div className="w-44 [&>button]:mt-0 [&>button]:h-[34px] [&>button]:text-[13px]">
            <Select id="subaccount" label="Subaccount" value={String(account)}
              onChange={(v) => changeAccount(v === "all" ? "all" : Number(v))}
              options={[
                { value: "all", label: "All subaccounts", detail: `${subaccounts.length}` },
                ...subaccounts.map((i) => ({ value: String(i), label: i === 0 ? "Main account" : `Subaccount ${i}` })),
              ]} />
          </div>
        )}
        <Segmented
          label="History range"
          value={range}
          onChange={changeRange}
          options={[
            { value: "7d", label: "7 days" },
            { value: "30d", label: "30 days" },
            { value: "90d", label: "90 days" },
          ]}
        />
        </div>
      </div>
      <LoadBar state={fillState} rangeStart={rangeStart} now={now} onStop={stop} />
    </div>
  );
}

function LoadBar({ state, rangeStart, now, onStop }: { state: FillState; rangeStart: number; now: number; onStop: () => void }) {
  if (!state.loading && !state.capped) return null;
  const reached = state.oldestLoaded ? state.oldestLoaded / 1000 : now;
  const progress = state.loading ? Math.min(1, Math.max(0.03, (now - reached) / (now - rangeStart))) : 1;
  return (
    <div className="card rise flex items-center gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">
          {state.loading
            ? `Loading trade history… ${num(state.fills.length)} trades`
            : `Showing ${num(state.fills.length)} most recent trades, back to ${shortDate(reached)}`}
        </p>
        {state.loading ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
          </div>
        ) : (
          <p className="mt-0.5 text-[12px] text-ink-2">
            This account trades a lot, so the day and week breakdown stops at {shortDate(reached)}. Account totals are complete.
          </p>
        )}
      </div>
      {state.loading && (
        <button onClick={onStop} className="rounded-full bg-fill px-3.5 py-1.5 text-[13px] font-medium text-accent hover:bg-fill-2">
          Stop
        </button>
      )}
    </div>
  );
}

/** Saved wallets as chips: switch between them, view all combined, add or remove. */
export function WalletChips() {
  const { address, wallets, open, removeWallet, viewAll, setError } = useTracker();
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  if (!wallets.length) return null;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    if (!ADDRESS_RE.test(v)) return setError("Enter a valid wallet address — 0x followed by 40 hex characters.");
    setInput("");
    setAdding(false);
    open(v);
  };

  const chip = "flex h-9 items-center gap-2 rounded-full pl-1.5 pr-3 text-[13px] font-medium transition";
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Saved wallets">
      {wallets.length > 1 && (
        <button onClick={viewAll} aria-pressed={address === ALL}
          className={`${chip} pl-3 ${address === ALL ? "bg-ink text-bg" : "bg-fill-2 text-ink-2 hover:bg-fill hover:text-ink"}`}>
          All wallets <span className="tabular opacity-70">{wallets.length}</span>
        </button>
      )}
      {wallets.map((w) => (
        <span key={w} className={`${chip} pr-1.5 ${address === w ? "bg-ink text-bg" : "bg-fill-2 text-ink-2"}`}>
          <button onClick={() => open(w)} aria-pressed={address === w} className="flex items-center gap-2 hover:opacity-80">
            <Avatar address={w} size={24} />
            <span className="font-mono">{shortAddress(w)}</span>
          </button>
          <button onClick={() => removeWallet(w)} aria-label={`Remove ${shortAddress(w)}`} title="Remove wallet"
            className="grid h-6 w-6 place-items-center rounded-full opacity-60 hover:bg-fill hover:opacity-100">×</button>
        </span>
      ))}
      {adding ? (
        <form onSubmit={add} className="flex items-center gap-1.5">
          <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="0x…" spellCheck={false}
            aria-label="Wallet address to add" onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            className="h-9 w-[300px] max-w-[60vw] rounded-full bg-fill-2 px-3.5 font-mono text-[13px] outline-none focus:ring-2 focus:ring-accent" />
          <button type="submit" className="h-9 rounded-full bg-accent px-4 text-[13px] font-medium text-on-accent">Add</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className={`${chip} border border-dashed border-hairline pl-3 text-ink-2 hover:text-ink`}>
          + Add wallet
        </button>
      )}
    </div>
  );
}

function StackedAvatars({ addresses }: { addresses: string[] }) {
  return (
    <span className="flex shrink-0 -space-x-3">
      {addresses.slice(0, 3).map((a) => <span key={a} className="rounded-full ring-2 ring-bg"><Avatar address={a} /></span>)}
    </span>
  );
}

function Avatar({ address, size = 40 }: { address: string; size?: number }) {
  return <DegenAvatar address={address} size={size} />;
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="rise pt-4 pb-2">
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">{eyebrow}</p>
      <h1 className="mt-2 text-[32px] font-bold leading-[1.1] tracking-[-0.025em] sm:text-[40px]">{title}</h1>
      {children && <p className="mt-2 max-w-[640px] text-[16px] leading-relaxed text-ink-2">{children}</p>}
    </header>
  );
}
