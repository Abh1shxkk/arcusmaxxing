import type { Metadata } from "next";
import { CompareView } from "@/components/views/CompareView";

export const metadata: Metadata = {
  title: "Compare wallets · Arcus Fee Tracker",
  description: "Compare Arcus wallets side by side: fee rate, maker share, cost per $1M and rank.",
};

export default function Page() {
  return <CompareView />;
}
