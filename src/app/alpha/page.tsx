import type { Metadata } from "next";
import { getArcusNews } from "@/lib/news";
import { AlphaView } from "@/components/views/AlphaView";

export const metadata: Metadata = {
  title: "Alpha · ArcusMaxxing",
  description: "Community-picked threads, videos and guides on farming Arcus — plus every official Arcus update in one place.",
};

// News is cached for an hour (see getArcusNews), so this page stays static between refreshes.
export default async function Page() {
  const news = await getArcusNews();
  return <AlphaView news={news} />;
}
