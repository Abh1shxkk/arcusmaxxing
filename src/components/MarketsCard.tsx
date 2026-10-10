"use client";

import { useState } from "react";
import type { Market } from "@/lib/arcus";
import { usd } from "@/lib/format";
import { Card, Pagination, usePagination } from "./ui";

const price = (v: number) =>
  `$${v.toLocaleString("en-US", { minimumFractionDigits: v < 1 ? 4 : 2, maximumFractionDigits: v < 1 ? 4 : 2 })}`;

const EMPTY: Market[] = [];

const change = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(2)}%`;

export function MarketsCard({ markets, showAll = false }: { markets: Market[] | null; showAll?: boolean }) {
  const [all, setAll] = useState(showAll);
  const paged = usePagination(markets ?? EMPTY, 15);
  const rows = !markets ? [] : all ? paged.slice : markets.slice(0, 10);

  return (
    <Card
      title="Markets"
      subtitle="Sorted by 24-hour volume."
      action={
        markets && markets.length > 10 && !showAll ? (
          <button onClick={() => setAll(!all)} className="text-[14px] font-medium text-accent hover:underline">
            {all ? "Show top 10" : `Show all ${markets.length}`}
          </button>
        ) : null
      }
    >
      {!markets ? (
        <div className="space-y-3">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-8 w-full" />)}</div>
      ) : (
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="tabular w-full min-w-[640px] text-[14px]">
            <thead>
              <tr className="text-left text-[12px] text-ink-2">
                <th className="px-5 pb-2 font-medium sm:px-6">Market</th>
                <th className="pb-2 text-right font-medium">Price</th>
                <th className="pb-2 text-right font-medium">24h</th>
                <th className="pb-2 text-right font-medium">Volume</th>
                <th className="pb-2 text-right font-medium">Open interest</th>
                <th className="px-5 pb-2 text-right font-medium sm:px-6">Funding / hr</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.name} className="border-t border-hairline">
                  <td className="px-5 py-2.5 sm:px-6">
                    <span className="font-medium">{m.name.replace("-USD", "")}</span>
                    <span className="ml-2 text-[13px] text-ink-3">{m.assetName}</span>
                  </td>
                  <td className="text-right">{price(m.price)}</td>
                  <td className={`text-right font-medium ${m.change24h >= 0 ? "text-green" : "text-red"}`}>{change(m.change24h)}</td>
                  <td className="text-right">{usd(m.volume24h, { compact: true })}</td>
                  <td className="text-right text-ink-2">{usd(m.openInterest, { compact: true })}</td>
                  <td className="px-5 text-right text-ink-2 sm:px-6">{(m.fundingRate * 100).toFixed(4)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {all && <Pagination {...paged} noun="markets" />}
    </Card>
  );
}
