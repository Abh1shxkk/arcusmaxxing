import type { Metadata } from "next";
import { MarketsView } from "@/components/views/MarketsView";

export const metadata: Metadata = {
  title: "Markets · Arcus Fee Tracker",
  description: "Live prices, volume, open interest and funding for every Arcus perpetual market.",
};

export default function Page() {
  return <MarketsView />;
}
