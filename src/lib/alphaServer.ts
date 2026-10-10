import "server-only";
import { timingSafeEqual } from "node:crypto";
import { kvPipeline } from "./kv";
import { sha256Hex } from "./pointsSync";
import type { AlphaItem, AlphaKind } from "./alpha";

// Storage and enrichment for community links.
//   alpha:item:{id}   JSON item
//   alpha:approved    sorted set by createdAt      alpha:pending  sorted set by createdAt
//   alpha:votes:{id}  set of hashed voters         alpha:rl:{who}:{hour}  submission counter

export const itemKey = (id: string) => `alpha:item:${id}`;
export const votesKey = (id: string) => `alpha:votes:${id}`;

/** A stable, non-reversible visitor id from IP + user agent, for vote dedupe and rate limits. */
export async function visitorId(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ua = request.headers.get("user-agent") ?? "";
  return (await sha256Hex(`${process.env.ALPHA_SALT ?? "arcusmaxxing"}|${ip}|${ua}`)).slice(0, 24);
}

export function isAdmin(request: Request) {
  const key = process.env.ADMIN_KEY;
  const given = request.headers.get("x-admin-key");
  if (!key || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b); // constant-time, so the key can't be guessed by timing
}

const stripTags = (h: string) =>
  h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&mdash;/g, "—").trim();

/** Title, author and thumbnail from the platform's public oEmbed endpoint. Articles aren't fetched. */
export async function enrich(url: string, kind: AlphaKind) {
  if (kind === "x") {
    const res = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=1&dnt=1`);
    if (!res.ok) throw new Error("That post couldn't be found — is it public?");
    const d = (await res.json()) as { author_name: string; author_url: string; html: string };
    const p = d.html.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "";
    const text = stripTags(p.replace(/<br\s*\/?>/g, "\n")).replace(/\s*(https?:\/\/t\.co\/\S+|pic\.twitter\.com\/\S+)/g, "").trim();
    return {
      title: `Post by ${d.author_name}`,
      author: d.author_name,
      authorUrl: d.author_url,
      text: text.slice(0, 500),
      thumbnail: null,
      postedAt: d.html.match(/>([A-Z][a-z]+ \d{1,2}, \d{4})<\/a>\s*<\/blockquote>/)?.[1] ?? null,
    };
  }
  if (kind === "youtube") {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) throw new Error("That video couldn't be found — is it public?");
    const d = (await res.json()) as { title: string; author_name: string; author_url: string; thumbnail_url: string };
    return { title: d.title, author: d.author_name, authorUrl: d.author_url, text: "", thumbnail: d.thumbnail_url, postedAt: null };
  }
  const host = new URL(url).hostname.replace(/^www\./, "");
  return { title: "", author: host, authorUrl: null, text: "", thumbnail: null, postedAt: null };
}

export async function readItems(ids: string[]): Promise<AlphaItem[]> {
  if (!ids.length) return [];
  const results = await kvPipeline([["MGET", ...ids.map(itemKey)], ...ids.map((id) => ["SCARD", votesKey(id)])]);
  const raw = results[0] as (string | null)[];
  const items: AlphaItem[] = [];
  ids.forEach((_, i) => {
    if (raw[i]) items.push({ ...(JSON.parse(raw[i]!) as AlphaItem), votes: Number(results[i + 1] ?? 0) });
  });
  return items;
}
