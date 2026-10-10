import "server-only";
import { cacheLife } from "next/cache";

// Official Arcus updates: the three Mintlify changelog RSS feeds plus the arcus.xyz blog (no RSS,
// so its index page is read). Only these fixed URLs are ever fetched. Cached for an hour.

export type NewsSource = "blog" | "app" | "api" | "testnet";

export interface NewsItem {
  id: string;
  source: NewsSource;
  title: string;
  summary: string;
  url: string;
  date: number | null; // epoch ms
  category?: string; // blog only: Announcements, Education, …
}

const FEEDS: { source: NewsSource; url: string }[] = [
  { source: "app", url: "https://docs.arcus.xyz/changelog/frontend/rss.xml" },
  { source: "api", url: "https://docs.arcus.xyz/changelog/rss.xml" },
  { source: "testnet", url: "https://docs.arcus.xyz/changelog/testnet/rss.xml" },
];
const BLOG = "https://arcus.xyz/blog";
const DATE_RE = /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}$/;

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const stripTags = (html: string) => decode(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "";

async function readFeed(source: NewsSource, url: string): Promise<NewsItem[]> {
  const xml = await (await fetch(url)).text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15).map(([, item]) => {
    const body = decode(tag(item, "content:encoded"));
    // Changelog entries are dated headings; lead with the first heading and bullet as the summary.
    const heading = stripTags(body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "");
    const firstPoints = [...body.matchAll(/<li>([\s\S]*?)<\/li>/g)].slice(0, 2).map((m) => stripTags(m[1]));
    const summary = (firstPoints.length ? firstPoints.join(" · ") : stripTags(body)).slice(0, 280);
    const link = decode(tag(item, "link")).trim();
    const date = Date.parse(tag(item, "pubDate"));
    return {
      id: `${source}:${decode(tag(item, "guid")) || link}`,
      source,
      title: heading ? `${stripTags(tag(item, "title"))} — ${heading}` : stripTags(tag(item, "title")),
      summary,
      url: link,
      date: Number.isFinite(date) ? date : null,
    };
  });
}

async function readBlog(): Promise<NewsItem[]> {
  const html = await (await fetch(BLOG)).text();
  const seen = new Set<string>();
  const posts: NewsItem[] = [];
  for (const m of html.matchAll(/href="\.\/blog\/([a-z0-9-]+)"([\s\S]*?)<\/a>/g)) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    // m[2] starts with the rest of the <a …> tag; each card reads: category, date, [author], title, summary.
    const inner = m[2].slice(m[2].indexOf(">") + 1);
    const texts = decode(inner).split(/<[^>]+>/).map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
    const dateAt = texts.findIndex((t) => DATE_RE.test(t));
    if (dateAt < 0) continue;
    const [title, summary] = texts.slice(dateAt + 1).filter((t) => t !== "Arcus" && t !== "Read more");
    if (!title) continue;
    seen.add(slug);
    const date = Date.parse(`${texts[dateAt]} 12:00 UTC`);
    posts.push({
      id: `blog:${slug}`,
      source: "blog",
      title,
      summary: summary ?? "",
      url: `${BLOG}/${slug}`,
      date: Number.isFinite(date) ? date : null,
      category: dateAt > 0 ? texts[dateAt - 1] : undefined,
    });
  }
  return posts;
}

export async function getArcusNews(): Promise<{ items: NewsItem[]; fetchedAt: number }> {
  "use cache";
  cacheLife("hours");
  const results = await Promise.allSettled([readBlog(), ...FEEDS.map((f) => readFeed(f.source, f.url))]);
  const items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return { items, fetchedAt: Date.now() };
}
