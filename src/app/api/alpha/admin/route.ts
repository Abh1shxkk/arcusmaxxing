import { kvConfigured, kvPipeline } from "@/lib/kv";
import type { AlphaItem } from "@/lib/alpha";
import { isAdmin, itemKey, readItems, votesKey } from "@/lib/alphaServer";

// Moderation for community links. Requires the x-admin-key header to match ADMIN_KEY.

export async function GET(request: Request) {
  if (!kvConfigured) return Response.json({ error: "Not configured" }, { status: 501 });
  if (!isAdmin(request)) return Response.json({ error: "Wrong admin key" }, { status: 401 });
  const [pending, approved] = await kvPipeline([["ZREVRANGE", "alpha:pending", 0, 199], ["ZREVRANGE", "alpha:approved", 0, 299]]);
  return Response.json({ pending: await readItems(pending as string[]), approved: await readItems(approved as string[]) });
}

type Action = "approve" | "reject" | "feature" | "unfeature" | "delete";

export async function POST(request: Request) {
  if (!kvConfigured) return Response.json({ error: "Not configured" }, { status: 501 });
  if (!isAdmin(request)) return Response.json({ error: "Wrong admin key" }, { status: 401 });
  const { id, action } = (await request.json().catch(() => ({}))) as { id?: string; action?: Action };
  if (!id || !action) return Response.json({ error: "Missing id or action" }, { status: 400 });
  const [raw] = await kvPipeline([["GET", itemKey(id)]]);
  if (!raw) return Response.json({ error: "Not found" }, { status: 404 });
  const item = JSON.parse(raw as string) as AlphaItem;

  if (action === "reject" || action === "delete") {
    await kvPipeline([["DEL", itemKey(id)], ["DEL", votesKey(id)], ["ZREM", "alpha:pending", id], ["ZREM", "alpha:approved", id]]);
    return Response.json({ ok: true });
  }
  const next: AlphaItem = {
    ...item,
    status: action === "approve" ? "approved" : item.status,
    featured: action === "feature" ? true : action === "unfeature" ? false : item.featured,
  };
  const commands: (string | number)[][] = [["SET", itemKey(id), JSON.stringify(next)]];
  if (action === "approve") commands.push(["ZREM", "alpha:pending", id], ["ZADD", "alpha:approved", item.createdAt, id]);
  await kvPipeline(commands);
  return Response.json({ ok: true, item: next });
}
