import type { Metadata } from "next";
import { Suspense } from "react";
import { profileForShare } from "@/lib/shareProfile";
import { shortAddress } from "@/lib/format";
import { OpenShared } from "./OpenShared";

// Landing page for a shared trader card. Crawlers read the metadata and preview image;
// people are sent straight to the live card for that wallet.

export async function generateMetadata({ params }: PageProps<"/u/[address]">): Promise<Metadata> {
  const { address } = await params;
  const data = /^0x[a-fA-F0-9]{40}$/.test(address) ? await profileForShare(address.toLowerCase()) : null;
  const title = data
    ? `${shortAddress(address)} is a ${data.profile.title} ${data.profile.creature.emoji} on Arcus`
    : "Arcus trader card";
  const description = data
    ? `Degen score ${data.profile.degenScore}/100 — ${data.profile.scoreLabel.toLowerCase()}. What kind of Arcus trader are you?`
    : "Find out what kind of Arcus trader you are.";
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default function Page({ params }: PageProps<"/u/[address]">) {
  return (
    <Suspense fallback={<p className="py-20 text-center text-ink-2">Opening trader card…</p>}>
      {params.then(({ address }) => <OpenShared address={address} />)}
    </Suspense>
  );
}
