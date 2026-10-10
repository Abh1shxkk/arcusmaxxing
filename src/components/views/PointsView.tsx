"use client";

import { AccountBar, AddressSearch, PageHeader } from "../Account";
import { PointsAnalyzer } from "../PointsAnalyzer";
import { PointsCard } from "../PointsCard";
import { PointsSyncCard } from "../PointsSyncCard";
import { useTracker } from "../TrackerProvider";
import { Card } from "../ui";

export function PointsView() {
  const { address, combined, wallets, weeks, points, changePoints, pointsEditable, coverageStart, now, fillState, modelWeeks, tiers } = useTracker();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Points" title="Is farming points worth it?">
        Log the points Arcus gives you each week. We match them to your fees, learn your points rate and predict
        whether the next weeks of trading will pay off.
      </PageHeader>

      {address ? (
        <>
          <AccountBar />
          <PointsCard address={address} weeks={weeks} points={points} onChange={changePoints}
            rangeStart={coverageStart} now={now} loading={fillState.loading} readOnly={!pointsEditable} />
          {combined ? (
            <Card>
              <p className="text-[14px] text-ink-2">
                You&apos;re viewing all {wallets.length} wallets combined, so points are added up across them. Pick a single wallet above
                to enter its points or sync them.
              </p>
            </Card>
          ) : (
            <PointsSyncCard address={address} points={points} onChange={changePoints} weeks={modelWeeks} />
          )}
        </>
      ) : (
        <Card title="Track a wallet" subtitle="Add the wallet you trade with, then enter the points you got each week.">
          <AddressSearch compact />
        </Card>
      )}

      <PointsAnalyzer weeks={modelWeeks} tiers={tiers} hasAddress={!!address} />
    </div>
  );
}
