"use client";

import { PageHeader } from "../Account";
import { CalculatorCard } from "../CalculatorCard";
import { LiquidationCard } from "../LiquidationCard";
import { TierCard } from "../TierCard";
import { useTracker } from "../TrackerProvider";

export function FeesView() {
  const { tiers, stats, markets } = useTracker();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Calculators" title="Fees, tiers and liquidation.">
        Arcus charges makers and takers different rates, and both drop as your 30-day volume grows.
        {stats ? " Your current tier is highlighted." : " Track a wallet on the Overview page to see where you stand."}
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-2">
        <TierCard tiers={tiers} stats={stats} />
        <CalculatorCard key={stats?.tier.level ?? -1} tiers={tiers} currentLevel={stats?.tier.level ?? 0} />
      </div>
      <LiquidationCard markets={markets} />
    </div>
  );
}
