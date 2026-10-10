import { verifyMessage } from "viem";
import { kvConfigured, kvPipeline } from "@/lib/kv";
import { SIGN_WINDOW_MS, sha256Hex, signMessage, validatePayload, type SyncPayload } from "@/lib/pointsSync";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const pointsKey = (a: string) => `points:${a}`;
const weekKey = (start: number) => `community:${start}`;

/** Saved points for a wallet (public: points alone aren't sensitive). */
export async function GET(request: Request) {
  if (!kvConfigured) return Response.json({ configured: false }, { status: 501 });
  const address = new URL(request.url).searchParams.get("address")?.toLowerCase() ?? "";
  if (!ADDRESS_RE.test(address)) return Response.json({ error: "Invalid address" }, { status: 400 });
  const [raw] = await kvPipeline([["GET", pointsKey(address)]]);
  if (!raw) return Response.json({ configured: true, weeks: [], updatedAt: null });
  return Response.json({ configured: true, ...JSON.parse(raw as string) });
}

/**
 * Save a wallet's weekly points. The body must carry a personal_sign signature from that wallet
 * over the payload hash and a recent timestamp, so nobody can write points for an address they
 * don't control.
 */
export async function PUT(request: Request) {
  if (!kvConfigured) return Response.json({ configured: false }, { status: 501 });
  let body: { address?: string; payload?: string; timestamp?: number; signature?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const address = body.address?.toLowerCase() ?? "";
  const { payload, timestamp, signature } = body;
  if (!ADDRESS_RE.test(address) || typeof payload !== "string" || typeof timestamp !== "number" || typeof signature !== "string") {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }
  if (payload.length > 50_000) return Response.json({ error: "Payload too large" }, { status: 413 });
  if (Math.abs(Date.now() - timestamp) > SIGN_WINDOW_MS) return Response.json({ error: "Signature expired — sign again" }, { status: 401 });

  const message = signMessage(address, await sha256Hex(payload), timestamp);
  const valid = await verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` }).catch(() => false);
  if (!valid) return Response.json({ error: "Signature doesn't match this wallet" }, { status: 401 });

  let parsed: SyncPayload;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return Response.json({ error: "Malformed payload" }, { status: 400 });
  }
  const problem = validatePayload(parsed);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  // Drop this wallet from community weeks it no longer reports.
  const [prevRaw] = await kvPipeline([["GET", pointsKey(address)]]);
  const prev: SyncPayload = prevRaw ? JSON.parse(prevRaw as string) : { weeks: [] };
  const nextStarts = new Set(parsed.weeks.map((w) => w.start));
  const commands: (string | number)[][] = prev.weeks.filter((w) => !nextStarts.has(w.start)).map((w) => ["HDEL", weekKey(w.start), address]);

  const updatedAt = Date.now();
  commands.push(["SET", pointsKey(address), JSON.stringify({ weeks: parsed.weeks, updatedAt })]);
  for (const w of parsed.weeks) {
    // Only weeks with both points and fees say anything about the price of a point.
    if (w.points > 0 && w.fees > 0) {
      commands.push(["HSET", weekKey(w.start), address, JSON.stringify({ p: w.points, f: w.fees })]);
      commands.push(["SADD", "community:weeks", w.start]);
    } else {
      commands.push(["HDEL", weekKey(w.start), address]);
    }
  }
  await kvPipeline(commands);
  return Response.json({ ok: true, updatedAt });
}
