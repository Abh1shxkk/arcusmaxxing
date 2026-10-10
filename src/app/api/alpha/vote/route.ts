import { kvConfigured, kvPipeline } from "@/lib/kv";
import { SEED_ITEMS } from "@/lib/alpha";
import { itemKey, visitorId, votesKey } from "@/lib/alphaServer";

/** Upvote (POST) or remove an upvote (DELETE). One vote per visitor per link. */
async function handle(request: Request, add: boolean) {
  if (!kvConfigured) return Response.json({ error: "Voting isn't set up yet." }, { status: 501 });
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id || !/^[a-z0-9-]{8,64}$/.test(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
  const isSeed = SEED_ITEMS.some((s) => s.id === id);
  if (!isSeed) {
    const [raw] = await kvPipeline([["GET", itemKey(id)]]);
    if (!raw || JSON.parse(raw as string).status !== "approved") return Response.json({ error: "Not found" }, { status: 404 });
  }
  const who = await visitorId(request);
  const [, votes] = await kvPipeline([[add ? "SADD" : "SREM", votesKey(id), who], ["SCARD", votesKey(id)]]);
  return Response.json({ votes: Number(votes) });
}

export const POST = (request: Request) => handle(request, true);
export const DELETE = (request: Request) => handle(request, false);
