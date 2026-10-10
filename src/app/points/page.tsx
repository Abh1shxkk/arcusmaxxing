import type { Metadata } from "next";
import { PointsView } from "@/components/views/PointsView";

export const metadata: Metadata = {
  title: "Points analyzer · ArcusMaxxing",
  description: "Find out what each Arcus point costs you in fees, and whether farming them is worth it.",
};

export default function Page() {
  return <PointsView />;
}
