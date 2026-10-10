import type { Fill, FundingPayment, Transfer } from "./arcus";
import type { Bucket } from "./aggregate";

type Cell = string | number | null | undefined;

function escape(v: Cell) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]) {
  return [header, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel opens UTF-8 correctly.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const iso = (us: number) => new Date(us / 1000).toISOString();

export const fillsCsv = (fills: Fill[]) =>
  toCsv(
    ["time_utc", "market", "side", "role", "size", "price", "notional_usd", "fee_usd", "realised_pnl_usd"],
    fills.map((f) => [iso(f.createdAt), f.market, f.side, f.role, f.size, f.price, f.notional.toFixed(4), f.fee, f.pnl]),
  );

export const fundingCsv = (payments: FundingPayment[]) =>
  toCsv(
    ["time_utc", "market", "funding_rate_hourly", "payment_usd"],
    payments.map((p) => [iso(p.time), p.market, p.rate, p.payment]),
  );

export const transfersCsv = (transfers: Transfer[]) =>
  toCsv(
    ["time_utc", "type", "status", "amount_usd", "id"],
    transfers.map((t) => [iso(t.createdAt), t.type, t.status, t.amount, t.id]),
  );

export const weeksCsv = (weeks: (Bucket & { points?: number })[]) =>
  toCsv(
    ["week_start_utc", "trades", "volume_usd", "maker_volume_usd", "taker_volume_usd", "fees_usd", "rebates_usd", "points"],
    weeks.map((w) => [new Date(w.start).toISOString().slice(0, 10), w.trades, w.volume.toFixed(2), w.makerVolume.toFixed(2),
      w.takerVolume.toFixed(2), w.fees.toFixed(6), w.rebates.toFixed(6), w.points ?? ""]),
  );
