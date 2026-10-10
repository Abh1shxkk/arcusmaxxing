import type { Metadata } from "next";
import { FarmView } from "@/components/views/FarmView";

export const metadata: Metadata = {
  title: "Airdrop farming · ArcusMaxxing",
  description: "Track your Arcus farming: invite codes, fee tier, consistency, ranks and the true cost of your volume.",
};

export default function Page() {
  return <FarmView />;
}
