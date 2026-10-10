import { timingSafeEqual } from "node:crypto";
import { kvConfigured } from "@/lib/kv";
import { collect } from "@/lib/activity";

// Runs the active-trader collector. Called every 5 minutes by .github/workflows/collect-activity.yml
// with `Authorization: Bearer $CRON_SECRET`.
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!kvConfigured) return Response.json({ error: "Not configured" }, { status: 501 });
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await collect());
}
