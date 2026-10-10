// Community "alpha": links people share about trading and farming Arcus. Shared by browser and API.

export type AlphaKind = "x" | "youtube" | "article";
export const ALPHA_TAGS = ["Strategy", "Farming", "Tutorial", "Analysis", "News"] as const;
export type AlphaTag = (typeof ALPHA_TAGS)[number];

export interface AlphaItem {
  id: string;
  url: string;
  kind: AlphaKind;
  title: string; // video/article title, or "Post by …" for X
  author: string;
  authorUrl: string | null;
  text: string; // post text for X, empty otherwise
  thumbnail: string | null;
  postedAt: string | null; // as shown by the source, e.g. "October 5, 2026"
  note: string; // why it's worth reading, from the person who shared it
  tag: AlphaTag;
  sharedBy: string | null;
  createdAt: number;
  status: "pending" | "approved";
  featured: boolean;
  votes?: number;
}

export const NOTE_MAX = 280;
export const TITLE_MAX = 140;

// Only these sites can be shared — keeps the list on-topic and means the server never fetches arbitrary URLs.
const ARTICLE_HOSTS = ["medium.com", "mirror.xyz", "paragraph.xyz", "paragraph.com", "substack.com", "arcus.xyz", "github.com", "notion.site", "hackmd.io", "dune.com"];

export function classify(raw: string): { url: string; kind: AlphaKind } | { error: string } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { error: "That doesn't look like a link." };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { error: "Only web links can be shared." };
  const host = u.hostname.replace(/^(www|m|mobile)\./, "").toLowerCase();

  if (host === "x.com" || host === "twitter.com") {
    const m = u.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/);
    if (!m) return { error: "Share a link to a specific post on X." };
    return { url: `https://x.com/${m[1]}/status/${m[2]}`, kind: "x" };
  }
  if (host === "youtube.com" || host === "youtu.be") {
    const id = host === "youtu.be" ? u.pathname.slice(1) : u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : u.searchParams.get("v");
    if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return { error: "Share a link to a specific YouTube video." };
    return { url: `https://www.youtube.com/watch?v=${id}`, kind: "youtube" };
  }
  if (ARTICLE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    u.hash = "";
    for (const p of [...u.searchParams.keys()]) if (/^(utm_|ref|s$|t$)/.test(p)) u.searchParams.delete(p);
    u.protocol = "https:";
    return { url: u.toString(), kind: "article" };
  }
  return { error: "Links from X, YouTube, Medium, Mirror, Paragraph, Substack, GitHub, Notion, HackMD, Dune or arcus.xyz only." };
}

/** Starter picks, always shown and featured. */
export const SEED_ITEMS: AlphaItem[] = [
  {
    id: "seed-rajsh7894-delta-neutral",
    url: "https://x.com/rajsh7894/status/2103088426824462677",
    kind: "x",
    title: "Post by Raj.ETH",
    author: "Raj.ETH",
    authorUrl: "https://x.com/rajsh7894",
    text: "Ultimate Guide to Hedging & Farming Perp DEX Points With Minimal Fees!!\n\nSo, as you guys know, this guide is about hedging and farming Perp DEX points using a Delta-Neutral strategy. Before getting into the main strategy, let's quickly understand what Delta Neutral means…",
    thumbnail: null,
    postedAt: "September 24, 2026",
    note: "Delta-neutral guide: farm perp points with little price risk and low fees. On Arcus, hedge on another venue — not between your own Arcus accounts, which counts as self-matching.",
    tag: "Strategy",
    sharedBy: "ArcusMaxxing",
    createdAt: Date.UTC(2026, 8, 24, 12),
    status: "approved",
    featured: true,
  },
  {
    id: "seed-earnbyabhi-limit-orders",
    url: "https://x.com/EarnByAbhi/status/2107153014155076002",
    kind: "x",
    title: "Post by Abhi.eth",
    author: "Abhi.eth",
    authorUrl: "https://x.com/EarnByAbhi",
    text: "Short video on how to place limit orders for 0 maker fees on any Perp — made on user demand. Must watch till the end if you are actively trading on perp dex.",
    thumbnail: null,
    postedAt: "October 5, 2026",
    note: "Maker orders cost 0% at most Arcus tiers. This walks through placing limit orders so you stop paying taker fees.",
    tag: "Tutorial",
    sharedBy: "ArcusMaxxing",
    createdAt: Date.UTC(2026, 9, 5),
    status: "approved",
    featured: true,
  },
  {
    id: "seed-earnbyabhi-arcus",
    url: "https://x.com/EarnByAbhi/status/2103089898798653595",
    kind: "x",
    title: "Post by Abhi.eth",
    author: "Abhi.eth",
    authorUrl: "https://x.com/EarnByAbhi",
    text: "",
    thumbnail: null,
    postedAt: "September 24, 2026",
    note: "Arcus insight from Abhi.eth — open the post on X to see it in full.",
    tag: "Strategy",
    sharedBy: "ArcusMaxxing",
    createdAt: Date.UTC(2026, 8, 24),
    status: "approved",
    featured: true,
  },
];
