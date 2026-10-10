"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "../Account";
import { LeaderboardCard } from "../LeaderboardCard";
import { ActiveTradersCard } from "../ActiveTradersCard";
import { useTracker } from "../TrackerProvider";

export function LeaderboardView() {
  const { open } = useTracker();
  const router = useRouter();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Leaderboard" title="Who's trading on Arcus.">
        The top 100 traders by fees, volume or profit. Click a trader to open their fee breakdown.
      </PageHeader>
      <ActiveTradersCard onSelect={(a) => { open(a); router.push(`/?address=${a}`); }} />
      <LeaderboardCard
        limit={100}
        pageSize={20}
        wide
        onSelect={(a) => {
          open(a);
          router.push(`/?address=${a}`);
        }}
      />
    </div>
  );
}
