"use client";

import { useState, useSyncExternalStore } from "react";
import type { AlphaItem } from "@/lib/alpha";
import { PageHeader } from "@/components/Account";
import { Card } from "@/components/ui";

const noop = () => () => {};
const savedKey = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

type Action = "approve" | "reject" | "feature" | "unfeature" | "delete";
const KEY = "arcus-admin-key"; // sessionStorage only: forgotten when the tab closes

export function AlphaAdmin() {
  const [key, setKey] = useState("");
  const [data, setData] = useState<{ pending: AlphaItem[]; approved: AlphaItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async (k: string) => {
    setError(null);
    const res = await fetch("/api/alpha/admin", { headers: { "x-admin-key": k }, cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setData(null);
      return setError(res?.status === 401 ? "Wrong admin key." : "Couldn't load the queue.");
    }
    try {
      sessionStorage.setItem(KEY, k);
    } catch {}
    setData(await res.json());
  };

  const act = async (id: string, action: Action) => {
    setBusy(id);
    const k = key || sessionStorage.getItem(KEY) || "";
    await fetch("/api/alpha/admin", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-key": k }, body: JSON.stringify({ id, action }) });
    setBusy(null);
    load(k);
  };

  // Read after hydration only (null on the server), so both renders match.
  const remembered = useSyncExternalStore(noop, savedKey, () => null);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Admin" title="Moderate community alpha.">
        Approve links before they go public. The admin key is the ADMIN_KEY environment variable in your Vercel project.
      </PageHeader>

      {!data && (
        <Card>
          <form onSubmit={(e) => { e.preventDefault(); load(key); }} className="flex flex-wrap gap-2">
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Admin key" autoComplete="off"
              className="h-11 min-w-[260px] flex-1 rounded-[12px] bg-fill-2 px-4 text-[14px] outline-none focus:ring-2 focus:ring-accent" />
            <button className="h-11 rounded-[12px] bg-accent px-5 text-[15px] font-medium text-on-accent">Open queue</button>
            {remembered && (
              <button type="button" onClick={() => load(remembered)} className="h-11 rounded-[12px] bg-fill-2 px-4 text-[14px] font-medium">
                Use saved key
              </button>
            )}
          </form>
          {error && <p className="mt-2 text-[13px] text-red">{error}</p>}
        </Card>
      )}

      {data && (
        <>
          <Card title={`Waiting for review · ${data.pending.length}`}>
            {data.pending.length === 0 ? <p className="text-[14px] text-ink-3">Queue is empty.</p> : (
              <ul className="space-y-3">
                {data.pending.map((i) => (
                  <Row key={i.id} item={i} busy={busy === i.id}>
                    <Btn onClick={() => act(i.id, "approve")} primary>Approve</Btn>
                    <Btn onClick={() => act(i.id, "reject")}>Reject</Btn>
                  </Row>
                ))}
              </ul>
            )}
          </Card>
          <Card title={`Live · ${data.approved.length}`} subtitle="The two starter posts are built in and always shown.">
            {data.approved.length === 0 ? <p className="text-[14px] text-ink-3">Nothing approved yet.</p> : (
              <ul className="space-y-3">
                {data.approved.map((i) => (
                  <Row key={i.id} item={i} busy={busy === i.id}>
                    <Btn onClick={() => act(i.id, i.featured ? "unfeature" : "feature")}>{i.featured ? "Unfeature" : "Feature"}</Btn>
                    <Btn onClick={() => act(i.id, "delete")}>Delete</Btn>
                  </Row>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Row({ item: i, busy, children }: { item: AlphaItem; busy: boolean; children: React.ReactNode }) {
  return (
    <li className={`rounded-[14px] bg-fill-2 p-4 ${busy ? "opacity-50" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-ink-2">{i.kind.toUpperCase()} · {i.tag} · {i.votes ?? 0} votes{i.sharedBy ? ` · by ${i.sharedBy}` : ""}</p>
          <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-0.5 block truncate text-[15px] font-semibold hover:text-accent">
            {i.kind === "x" ? `${i.author} on X` : i.title} ↗
          </a>
          {i.text && <p className="mt-1 line-clamp-2 text-[13px] text-ink-2">{i.text}</p>}
          <p className="mt-1.5 text-[13px]"><span className="text-ink-3">Note: </span>{i.note}</p>
        </div>
        <div className="flex gap-2">{children}</div>
      </div>
    </li>
  );
}

function Btn({ onClick, primary, children }: { onClick: () => void; primary?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`h-9 rounded-full px-4 text-[13px] font-medium ${primary ? "bg-accent text-on-accent" : "bg-card ring-1 ring-hairline hover:bg-fill"}`}>
      {children}
    </button>
  );
}
