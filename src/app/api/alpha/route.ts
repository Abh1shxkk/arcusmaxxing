import { kvConfigured, kvPipeline } from "@/lib/kv";
import { classify, NOTE_MAX, SEED_ITEMS, TITLE_MAX, ALPHA_TAGS, type AlphaItem, type AlphaTag } from "@/lib/alpha";
import { enrich, itemKey, readItems, visitorId, votesKey } from "@/lib/alphaServer";
import { sha256Hex } from "@/lib/pointsSync";

const SUBMISSIONS_PER_HOUR = 5;

/** Approved links (plus the starter picks) with vote counts. */
export async function GET(request: Request) {
  void request; // per request: vote counts change constantly
  if (!kvConfigured) return Response.json({ configured: false, items: SEED_ITEMS.map((s) => ({ ...s, votes: 0 })) });
  const [ids] = await kvPipeline([["ZREVRANGE", "alpha:approved", 0, 299]]);
  const stored = await readItems((ids as string[]) ?? []);
  const seedVotes = await kvPipeline(SEED_ITEMS.map((s) => ["SCARD", votesKey(s.id)]));
  const seeds = SEED_ITEMS.filter((s) => !stored.some((i) => i.url === s.url)).map((s, i) => ({ ...s, votes: Number(seedVotes[i] ?? 0) }));
  return Response.json({ configured: true, items: [...seeds, ...stored] });
}

/** Submit a link. It waits in a review queue until the site owner approves it. */
export async function POST(request: Request) {
  if (!kvConfigured) return Response.json({ error: "Sharing isn't set up on this deployment yet." }, { status: 501 });
  let body: { url?: string; tag?: string; note?: string; title?: string; sharedBy?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = classify(body.url ?? "");
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const tag = (ALPHA_TAGS as readonly string[]).includes(body.tag ?? "") ? (body.tag as AlphaTag) : "Strategy";
  const note = (body.note ?? "").trim().slice(0, NOTE_MAX);
  if (note.length < 10) return Response.json({ error: "Add a short note on why it's worth reading (10+ characters)." }, { status: 400 });
  const title = (body.title ?? "").trim().slice(0, TITLE_MAX);
  if (parsed.kind === "article" && title.length < 4) return Response.json({ error: "Give the article a title." }, { status: 400 });
  const sharedBy = (body.sharedBy ?? "").trim().replace(/^@/, "").slice(0, 30) || null;

  // Rate limit by visitor, per hour.
  const who = await visitorId(request);
  const hour = Math.floor(Date.now() / 3_600_000);
  const [count] = await kvPipeline([["INCR", `alpha:rl:${who}:${hour}`], ["EXPIRE", `alpha:rl:${who}:${hour}`, 3600]]);
  if (Number(count) > SUBMISSIONS_PER_HOUR) return Response.json({ error: "That's a lot of links — try again in an hour." }, { status: 429 });

  const id = (await sha256Hex(parsed.url)).slice(0, 16);
  if (SEED_ITEMS.some((s) => s.url === parsed.url)) return Response.json({ error: "That one's already on the list." }, { status: 409 });
  const [exists] = await kvPipeline([["EXISTS", itemKey(id)]]);
  if (Number(exists)) return Response.json({ error: "That link has already been shared." }, { status: 409 });

  let meta;
  try {
    meta = await enrich(parsed.url, parsed.kind);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  const item: AlphaItem = {
    id, url: parsed.url, kind: parsed.kind, ...meta, title: title || meta.title,
    note, tag, sharedBy, createdAt: Date.now(), status: "pending", featured: false,
  };
  await kvPipeline([["SET", itemKey(id), JSON.stringify(item)], ["ZADD", "alpha:pending", item.createdAt, id]]);
  return Response.json({ ok: true, status: "pending" });
}
