"use client";

import { num, usd } from "@/lib/format";
import { PageHeader } from "../Account";
import { exchangeTotals } from "../ExchangeCard";
import { MarketsCard } from "../MarketsCard";
import { FundingScannerCard } from "../FundingScannerCard";
import { MoversCard, VolumeShareCard } from "../charts/MarketCharts";
import { useTracker } from "../TrackerProvider";
import { Card, Stat } from "../ui";

export function MarketsView() {
  const { markets } = useTracker();
  const t = exchangeTotals(markets);
  const gainer = markets?.reduce((a, b) => (b.change24h > a.change24h ? b : a), markets[0]);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Markets" title="Every market on Arcus.">
        Live prices, 24-hour volume, open interest and hourly funding for all perpetual markets.
      </PageHeader>
      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
          <Stat label="24h volume" value={usd(t.volume, { compact: true })} loading={!markets} />
          <Stat label="Open interest" value={usd(t.openInterest, { compact: true })} loading={!markets} />
          <Stat label="24h trades" value={num(t.trades)} hint={markets ? `${markets.length} live markets` : undefined} loading={!markets} />
          <Stat label="Top gainer" tone="green" loading={!markets}
            value={gainer ? gainer.name.replace("-USD", "") : "—"}
            hint={gainer ? `+${(gainer.change24h * 100).toFixed(2)}% in 24h` : undefined} />
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <MoversCard markets={markets} />
        <VolumeShareCard markets={markets} />
      </div>
      <FundingScannerCard markets={markets} />
      <MarketsCard markets={markets} showAll />
    </div>
  );
}
