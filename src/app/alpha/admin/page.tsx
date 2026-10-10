import type { Metadata } from "next";
import { AlphaAdmin } from "./AlphaAdmin";

export const metadata: Metadata = {
  title: "Moderate alpha · ArcusMaxxing",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AlphaAdmin />;
}
