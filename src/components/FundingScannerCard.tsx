"use client";

import { useMemo, useState } from "react";
import type { Market } from "@/lib/arcus";
import { usd } from "@/lib/format";
import { Card, Pagination, Segmented, usePagination } from "./ui";

type Sort = "longs" | "shorts" | "abs";
const POSITION = 10_000; // cost shown for a $10K position

const pctRate = (v: number, digits = 4) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(digits)}%`;

/** Ranks markets by funding: positive rates mean longs pay shorts, negative the reverse (Arcus docs). */
export function FundingScannerCard({ markets }: { markets: Market[] | null }) {
  const [sort, setSort] = useState<Sort>("abs");
  const rows = useMemo(() => {
    const list = [...(markets ?? [])];
    if (sort === "longs") list.sort((a, b) => b.fundingRate - a.fundingRate);
    else if (sort === "shorts") list.sort((a, b) => a.fundingRate - b.fundingRate);
    else list.sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));
    return list;
  }, [markets, sort]);
  const paged = usePagination(rows, 12);

  return (
    <Card title="Funding scanner" subtitle="What it costs (or pays) to hold a position for a day. Positive funding: longs pay shorts."
      action={<Segmented label="Sort" value={sort} onChange={setSort}
        options={[{ value: "abs", label: "Biggest" }, { value: "longs", label: "Longs pay most" }, { value: "shorts", label: "Shorts pay most" }]} />}>
      {!markets ? <div className="skeleton h-72 w-full" /> : (
        <>
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="tabular w-full min-w-[720px] text-[14px]">
              <thead>
                <tr className="text-left text-[12px] text-ink-2">
                  <th className="px-5 pb-2 font-medium sm:px-6">Market</th>
                  <th className="pb-2 text-right font-medium">Now / hr</th>
                  <th className="pb-2 text-right font-medium">Next / hr</th>
                  <th className="pb-2 text-right font-medium">Yearly</th>
                  <th className="pb-2 pl-6 font-medium">Who pays</th>
                  <th className="px-5 pb-2 text-right font-medium sm:px-6">Long $10K / day</th>
                </tr>
              </thead>
              <tbody>
                {paged.slice.map((m) => {
                  const daily = POSITION * m.fundingRate * 24; // a long pays this when positive
                  return (
                    <tr key={m.name} className="border-t border-hairline">
                      <td className="px-5 py-2.5 sm:px-6">
                        <span className="font-medium">{m.name.replace("-USD", "")}</span>
                        <span className="ml-2 text-[12px] text-ink-3">{m.category.toLowerCase()}</span>
                      </td>
                      <td className="text-right">{pctRate(m.fundingRate)}</td>
                      <td className="text-right text-ink-2">{pctRate(m.nextFundingRate)}</td>
                      <td className="text-right font-medium">{pctRate(m.fundingRate * 24 * 365, 1)}</td>
                      <td className="pl-6 text-ink-2">{m.fundingRate === 0 ? "Nobody" : m.fundingRate > 0 ? "Longs → shorts" : "Shorts → longs"}</td>
                      <td className={`px-5 text-right font-medium sm:px-6 ${daily > 0 ? "text-red" : daily < 0 ? "text-green" : ""}`}>
                        {daily > 0 ? "pays " : daily < 0 ? "earns " : ""}{usd(Math.abs(daily), { cents: true })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination {...paged} noun="markets" />
          <p className="mt-3 text-[12px] text-ink-3">
            Yearly assumes today&apos;s rate holds, which it won&apos;t. Outside regular hours, stock and ETF markets switch to a fixed
            off-hours rate.
          </p>
        </>
      )}
    </Card>
  );
}
