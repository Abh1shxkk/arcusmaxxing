import type { Metadata } from "next";
import { LeaderboardView } from "@/components/views/LeaderboardView";

export const metadata: Metadata = {
  title: "Leaderboard · ArcusMaxxing",
  description: "The top Arcus traders by fees, volume and profit.",
};

export default function Page() {
  return <LeaderboardView />;
}
