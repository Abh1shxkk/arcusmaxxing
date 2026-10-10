import type { Metadata } from "next";
import { Permanent_Marker, Sedgwick_Ave_Display } from "next/font/google";
import { CardView } from "@/components/views/CardView";

// Graffiti faces are only needed on this page, so they load here rather than in the root layout.
const tag = Sedgwick_Ave_Display({ weight: "400", subsets: ["latin"], variable: "--font-tag" });
const marker = Permanent_Marker({ weight: "400", subsets: ["latin"], variable: "--font-marker" });

export const metadata: Metadata = {
  title: "Trader card · ArcusMaxxing",
  description: "Find out what kind of Arcus trader you are — and post your card.",
};

export default function Page() {
  return (
    <div className={`${tag.variable} ${marker.variable}`}>
      <CardView />
    </div>
  );
}
