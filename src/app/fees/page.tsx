import type { Metadata } from "next";
import { FeesView } from "@/components/views/FeesView";

export const metadata: Metadata = {
  title: "Calculators · ArcusMaxxing",
  description: "Arcus fee tiers, a trading fee calculator and a liquidation price calculator.",
};

export default function Page() {
  return <FeesView />;
}
