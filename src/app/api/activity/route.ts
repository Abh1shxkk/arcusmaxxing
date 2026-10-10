import { kvConfigured } from "@/lib/kv";
import { activitySummary } from "@/lib/activity";

/** Daily / weekly / monthly unique traders on Arcus, from the trade collector (cached 15 min). */
export async function GET(request: Request) {
  void request; // per request: the summary comes from the database
  if (!kvConfigured) return Response.json({ configured: false }, { status: 501 });
  const summary = await activitySummary();
  return Response.json({ configured: true, summary }, { headers: { "Cache-Control": "public, max-age=60" } });
}
