"use client";

import { useState, type ReactNode } from "react";
import * as RadixSelect from "@radix-ui/react-select";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const index = options.findIndex((o) => o.value === value);
  return (
    <div role="radiogroup" aria-label={label} className="relative inline-grid rounded-[9px] bg-fill p-[2px]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="absolute top-[2px] bottom-[2px] rounded-[7px] bg-card shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ left: 2, width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`relative z-10 px-3.5 py-1 text-[13px] font-medium transition-colors ${
            o.value === value ? "text-ink" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
  delay = 0,
  id,
}: {
  id?: string;
  title?: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section id={id} className={`card rise scroll-mt-24 p-5 sm:p-6 ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {(title || action) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "ink",
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "ink" | "accent" | "green" | "orange" | "purple";
  loading?: boolean;
}) {
  const color = {
    ink: "text-ink",
    accent: "text-accent",
    green: "text-green",
    orange: "text-orange",
    purple: "text-purple",
  }[tone];
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-medium text-ink-2">{label}</p>
      {loading ? (
        <div className="skeleton mt-2 h-8 w-28" />
      ) : (
        <p className={`tabular mt-1 truncate text-[28px] font-semibold leading-tight tracking-tight ${color}`}>{value}</p>
      )}
      {hint && !loading && <p className="mt-0.5 truncate text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="grid h-48 place-items-center text-center text-[14px] text-ink-3">{children}</div>;
}

export interface SelectOption {
  value: string;
  label: string;
  detail?: string;
}

/** Styled dropdown built on Radix Select, so the open list matches the theme (native menus don't). */
export function Select({
  value,
  onChange,
  options,
  label,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  label: string;
  id?: string;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <RadixSelect.Root value={value} onValueChange={onChange}>
      <RadixSelect.Trigger id={id} aria-label={label}
        className="mt-1.5 flex h-11 w-full items-center justify-between gap-2 rounded-[12px] bg-fill-2 px-3.5 text-left text-[15px] outline-none transition hover:bg-fill focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:ring-2 data-[state=open]:ring-accent">
        <span className="truncate">
          {current?.label}
          {current?.detail && <span className="ml-2 text-[13px] text-ink-3">{current.detail}</span>}
        </span>
        <RadixSelect.Icon className="shrink-0 text-ink-3">
          <Chevron />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content position="popper" sideOffset={6}
          className="select-pop z-50 max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[14px] border border-hairline bg-card p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
          <RadixSelect.Viewport>
            {options.map((o) => (
              <RadixSelect.Item key={o.value} value={o.value}
                className="relative flex cursor-pointer select-none items-center justify-between gap-3 rounded-[9px] py-2 pr-9 pl-3 text-[14px] outline-none data-[highlighted]:bg-accent-soft data-[state=checked]:font-medium">
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                {o.detail && <span className="tabular shrink-0 text-[12px] text-ink-3">{o.detail}</span>}
                <RadixSelect.ItemIndicator className="absolute right-3 text-accent">
                  <Check />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12.5 10 17l9-10" />
  </svg>
);

/**
 * Client-side paging for long lists. Goes back to page 1 when `resetKey` changes —
 * by default the list itself, so pass something stable if the list is rebuilt every render.
 */
export function usePagination<T>(items: T[], pageSize: number, resetKey: unknown = items) {
  const [state, setState] = useState<{ page: number; key: unknown }>({ page: 1, key: resetKey });
  const page = state.key === resetKey ? state.page : 1;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);
  return {
    page: current,
    pages,
    total: items.length,
    pageSize,
    slice: items.slice((current - 1) * pageSize, current * pageSize),
    setPage: (p: number) => setState({ page: Math.min(Math.max(1, p), pages), key: resetKey }),
  };
}

export function Pagination({ page, pages, total, pageSize, setPage, noun = "rows" }: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  setPage: (p: number) => void;
  noun?: string;
}) {
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  // First, last, current ±1, with gaps collapsed to "…".
  const shown = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const btn = "grid h-8 min-w-8 place-items-center rounded-full px-2 text-[13px] font-medium transition disabled:opacity-35 disabled:pointer-events-none";
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
      <p className="tabular text-[13px] text-ink-2">{from}–{to} of {total.toLocaleString("en-US")} {noun}</p>
      <div className="flex items-center gap-1">
        <button className={`${btn} text-ink-2 hover:bg-fill-2 hover:text-ink`} onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Previous page">‹</button>
        {shown.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && p - shown[i - 1] > 1 && <span className="px-1 text-ink-3">…</span>}
            <button onClick={() => setPage(p)} aria-current={p === page ? "page" : undefined}
              className={`${btn} tabular ${p === page ? "bg-ink text-bg" : "text-ink-2 hover:bg-fill-2 hover:text-ink"}`}>
              {p}
            </button>
          </span>
        ))}
        <button className={`${btn} text-ink-2 hover:bg-fill-2 hover:text-ink`} onClick={() => setPage(page + 1)} disabled={page === pages} aria-label="Next page">›</button>
      </div>
    </nav>
  );
}
