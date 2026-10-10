"use client";

import { forwardRef } from "react";
import type { AccountStats } from "@/lib/arcus";
import type { TraderProfile } from "@/lib/traderProfile";
import { shortAddress, usd } from "@/lib/format";

// Street poster in Arcus colours: forest-green brick wall, a gold quarter-arc stencil (the Arcus
// motif) with stippled overspray, a pasted fee receipt, a rubber stamp and die-cut stickers.
// Every edge is hard — solid fills and offset shadows only, no blurs or gradients.

const GREEN = "#1e3b25";
const CREAM = "#f5f2eb";
const GOLD = "#d9bb6a";
const SAGE = "#a9d6a0";
const INK = "#0f140d";

const WALL = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60'><rect width='120' height='60' fill='#18301e'/><g fill='${GREEN}'><rect x='2' y='2' width='56' height='26' rx='1.5'/><rect x='62' y='2' width='56' height='26' rx='1.5'/><rect x='-28' y='32' width='56' height='26' rx='1.5'/><rect x='32' y='32' width='56' height='26' rx='1.5'/><rect x='92' y='32' width='56' height='26' rx='1.5'/></g></svg>`,
)}")`;

// Deterministic stipple so the overspray looks the same on every render and in the PNG.
const SPECKS = Array.from({ length: 140 }, (_, i) => {
  const a = (i * 137.508 * Math.PI) / 180;
  const r = 230 + ((i * 53) % 90);
  return { x: 860 + Math.cos(a) * r, y: 420 + Math.sin(a) * r * 0.9, s: 1 + ((i * 7) % 4) };
});

const STICKER_STYLES = [
  { bg: GOLD, fg: INK },
  { bg: CREAM, fg: INK },
  { bg: SAGE, fg: INK },
  { bg: INK, fg: GOLD },
  { bg: CREAM, fg: GREEN },
];

export const TraderCard = forwardRef<HTMLDivElement, { profile: TraderProfile; stats: AccountStats; address: string }>(
  function TraderCard({ profile, stats, address }, ref) {
    // `address` is a wallet, or a label like "3 wallets" for a combined view.
    const who = /^0x[a-fA-F0-9]{40}$/.test(address) ? shortAddress(address) : address;
    const words = profile.title.split(" ");
    const big = words.at(-1) ?? "";
    const small = words.slice(0, -1).join(" ");
    const wagmi = profile.degenScore >= 60;

    return (
      <div ref={ref} className="relative isolate aspect-[1200/680] w-full overflow-hidden rounded-[22px] select-none"
        style={{ backgroundColor: GREEN, backgroundImage: WALL, backgroundSize: "120px 60px", color: CREAM, containerType: "inline-size" }}>
        {/* Sized in card-width units, so the poster keeps its layout at every size and in the PNG. */}
        <div className="absolute inset-0" style={{ fontSize: "1.25cqw" }}>

        {/* Gold arc stencil + overspray */}
        <svg className="absolute inset-0 -z-10 h-full w-full" viewBox="0 0 1200 680" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <path d="M600 120a420 420 0 0 1 420 420v140H860V540a260 260 0 0 0-260-260Z" fill={GOLD} />
          <path d="M600 120a420 420 0 0 1 420 420" fill="none" stroke={INK} strokeWidth="6" strokeDasharray="2 18" strokeLinecap="round" opacity="0.5" />
          {SPECKS.map((p, i) => <rect key={i} x={p.x} y={p.y} width={p.s} height={p.s} fill={GOLD} opacity={0.7} />)}
          {/* Paste-up scrap behind the receipt */}
          <rect x="40" y="420" width="430" height="230" fill={SAGE} transform="rotate(-4 255 535)" opacity="0.9" />
        </svg>

        {/* Header */}
        <div className="absolute left-[4%] top-[6%] flex items-center gap-[0.7em]">
          <svg viewBox="0 0 24 24" className="h-[2.6em] w-[2.6em]" aria-hidden>
            <rect width="24" height="24" rx="7" fill={CREAM} />
            <path d="M6 5a13 13 0 0 1 13 13h-5a8 8 0 0 0-8-8Z" fill={GREEN} />
            <circle cx="7.5" cy="16.5" r="2.5" fill={GOLD} />
          </svg>
          <p className="font-[family-name:var(--font-marker)] text-[1.5em] leading-none tracking-[0.06em]">
            ARCUS <span style={{ color: GOLD }}>{"//"}</span> HALL OF DEGENS
          </p>
        </div>

        {/* Rubber stamp */}
        <div className="absolute right-[4%] top-[5%] rotate-[7deg] rounded-[0.5em] border-[0.25em] px-[0.9em] py-[0.35em] text-center"
          style={{ borderColor: wagmi ? GOLD : CREAM, color: wagmi ? GOLD : CREAM, outline: `0.12em solid ${wagmi ? GOLD : CREAM}`, outlineOffset: "0.25em" }}>
          <p className="font-[family-name:var(--font-marker)] text-[2.6em] leading-none">{wagmi ? "WAGMI" : "NGMI"}</p>
          <p className="font-[family-name:var(--font-marker)] text-[0.95em] leading-tight tracking-[0.08em]">{profile.scoreLabel.toUpperCase()}</p>
        </div>

        {/* Tag */}
        <div className="absolute left-[4%] top-[19%] -rotate-[4deg]">
          {small && (
            <p className="font-[family-name:var(--font-tag)] text-[3.8em] leading-[0.95]" style={{ color: SAGE, textShadow: `0.06em 0.06em 0 ${INK}` }}>
              {small}
            </p>
          )}
          <p className="relative font-[family-name:var(--font-tag)] text-[8.2em] leading-[0.92]" style={{ color: CREAM, textShadow: `0.05em 0.05em 0 ${INK}` }}>
            {big}
            <Drips color={CREAM} />
          </p>
        </div>

        {/* Creature sticker on the arc */}
        <div className="absolute right-[13%] top-[30%] grid aspect-square w-[20%] rotate-[10deg] place-items-center rounded-full border-[0.35em]"
          style={{ background: CREAM, borderColor: INK, boxShadow: `0.4em 0.4em 0 ${INK}` }}>
          <span className="text-[7.5em] leading-none" role="img" aria-label={profile.creature.name}>{profile.creature.emoji}</span>
          <span className="absolute -bottom-[0.9em] rotate-[-10deg] rounded-[0.3em] px-[0.6em] py-[0.15em] font-[family-name:var(--font-marker)] text-[1.2em]"
            style={{ background: INK, color: GOLD }}>
            DEGEN {profile.degenScore}/100
          </span>
        </div>

        {/* Fee receipt */}
        <div className="absolute bottom-[6%] left-[4%] w-[33%] -rotate-[2deg]">
          <div className="absolute -top-[0.7em] left-1/2 h-[1.5em] w-[38%] -translate-x-1/2 rotate-[3deg]" style={{ background: "rgba(245,242,235,0.75)" }} />
          <div className="px-[1.2em] pt-[1em] pb-[1.6em] font-mono text-[1.05em] leading-[1.55]"
            style={{ background: CREAM, color: INK, clipPath: RECEIPT_EDGE, boxShadow: `0.3em 0.3em 0 ${INK}` }}>
            <p className="text-center text-[0.95em] font-bold tracking-[0.2em]">ARCUS FEE RECEIPT</p>
            <p className="text-center text-[0.8em] opacity-60">{who} · last 30d</p>
            <div className="my-[0.4em] border-t-[0.12em] border-dashed" style={{ borderColor: INK }} />
            <Line k="VOLUME" v={usd(stats.rollingVolume, { compact: true })} />
            <Line k="FEES PAID" v={usd(stats.rollingFeesPaid, { compact: true })} />
            <Line k="FEE RATE" v={`${profile.rateBps.toFixed(2)} bps`} />
            <Line k="LIFETIME VOL" v={usd(stats.lifetimeVolume, { compact: true })} />
            <div className="my-[0.4em] border-t-[0.12em] border-dashed" style={{ borderColor: INK }} />
            <p className="text-center text-[0.85em] font-bold">*** THANK YOU FOR YOUR LIQUIDITY ***</p>
          </div>
        </div>

        {/* Trait stickers */}
        <div className="absolute bottom-[7%] left-[41%] right-[4%] flex flex-wrap content-end justify-start gap-[0.8em]">
          {profile.traits.length === 0 && (
            <Sticker i={1} text="NO STICKERS YET" />
          )}
          {profile.traits.map((t, i) => <Sticker key={t.name} i={i} text={`${t.emoji} ${t.name}`} />)}
          <p className="w-full pt-[0.4em] text-right font-[family-name:var(--font-marker)] text-[1.15em]" style={{ color: CREAM }}>
            gm from {who} <span style={{ color: GOLD }}>✦</span>
          </p>
        </div>
        </div>
      </div>
    );
  },
);

// Torn bottom edge for the receipt.
const RECEIPT_EDGE = `polygon(0 0, 100% 0, 100% 94%, ${Array.from({ length: 21 }, (_, i) => `${100 - i * 5}% ${i % 2 ? 100 : 94}%`).join(", ")}, 0 94%)`;

function Line({ k, v }: { k: string; v: string }) {
  return (
    <p className="flex justify-between gap-[1em]">
      <span>{k}</span>
      <span className="font-bold">{v}</span>
    </p>
  );
}

function Sticker({ i, text }: { i: number; text: string }) {
  const s = STICKER_STYLES[i % STICKER_STYLES.length];
  return (
    <span className="rounded-[0.6em] border-[0.18em] px-[0.75em] py-[0.3em] font-[family-name:var(--font-marker)] text-[1.2em] leading-tight"
      style={{ background: s.bg, color: s.fg, borderColor: INK, boxShadow: `0.2em 0.2em 0 ${INK}`, transform: `rotate(${[-4, 3, -2, 5, -3][i % 5]}deg)` }}>
      {text}
    </span>
  );
}

function Drips({ color }: { color: string }) {
  return (
    <svg className="pointer-events-none absolute left-[6%] top-[80%] h-[0.55em] w-[84%]" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden>
      {[[18, 40], [64, 20], [122, 56], [190, 28], [248, 46], [318, 24], [372, 38]].map(([x, h]) => (
        <g key={x} fill={color}>
          <rect x={x - 3} y={0} width={6} height={h} rx={3} />
          <circle cx={x} cy={h} r={6} />
        </g>
      ))}
    </svg>
  );
}
