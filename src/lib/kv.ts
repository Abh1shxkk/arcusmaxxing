import "server-only";

// Minimal Upstash Redis REST client. Configure UPSTASH_REDIS_REST_URL / _TOKEN
// (or the KV_REST_API_URL / KV_REST_API_TOKEN pair Vercel's Upstash integration creates).

const BASE = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

export const kvConfigured = Boolean(BASE && TOKEN);

type Command = (string | number)[];

export async function kvPipeline(commands: Command[]): Promise<unknown[]> {
  if (!kvConfigured) throw new Error("KV not configured");
  const res = await fetch(`${BASE}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV ${res.status}`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}
