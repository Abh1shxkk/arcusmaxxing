"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ALPHA_TAGS, NOTE_MAX, type AlphaItem, type AlphaTag } from "@/lib/alpha";
import type { NewsItem, NewsSource } from "@/lib/news";
import { PageHeader } from "../Account";
import { Card, Pagination, Segmented, usePagination } from "../ui";
import { XAvatar, xHandle } from "../XAvatar";

type Tab = "community" | "news";

export function AlphaView({ news }: { news: { items: NewsItem[]; fetchedAt: number } }) {
  const [tab, setTab] = useState<Tab>("community");
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Alpha" title="Learn from people farming Arcus.">
        The best threads, videos and write-ups on trading and farming Arcus, picked by the community — plus every official
        Arcus update in one place.
      </PageHeader>
      <Segmented label="Section" value={tab} onChange={setTab}
        options={[{ value: "community", label: "Community alpha" }, { value: "news", label: "Arcus news" }]} />
      {tab === "community" ? <Community /> : <News news={news} />}
    </div>
  );
}

/* ---------------------------------- Community ---------------------------------- */

const VOTES_KEY = "arcus-alpha-votes";

// Which links this browser upvoted — an external store so the server render stays neutral.
function subscribeVotes(cb: () => void) {
  window.addEventListener("arcus-alpha-votes", cb);
  return () => window.removeEventListener("arcus-alpha-votes", cb);
}
const votesSnapshot = () => {
  try {
    return localStorage.getItem(VOTES_KEY) ?? "[]";
  } catch {
    return "[]";
  }
};

function Community() {
  const [items, setItems] = useState<AlphaItem[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [tag, setTag] = useState<AlphaTag | "All">("All");
  const [sort, setSort] = useState<"top" | "new">("top");
  const voted = new Set<string>(JSON.parse(useSyncExternalStore(subscribeVotes, votesSnapshot, () => "[]")));

  const load = () =>
    fetch("/api/alpha", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured !== false);
        setItems(d.items ?? []);
      })
      .catch(() => setItems([]));

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    const list = (items ?? []).filter((i) => tag === "All" || i.tag === tag);
    // Featured first, then by votes or recency.
    return list.sort((a, b) =>
      Number(b.featured) - Number(a.featured) ||
      (sort === "top" ? (b.votes ?? 0) - (a.votes ?? 0) || b.createdAt - a.createdAt : b.createdAt - a.createdAt));
  }, [items, tag, sort]);
  const paged = usePagination(shown, 10, `${tag}:${sort}:${items?.length ?? 0}`);

  const vote = async (id: string) => {
    const has = voted.has(id);
    const res = await fetch("/api/alpha/vote", { method: has ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (!res.ok) return;
    const { votes } = await res.json();
    setItems((list) => list?.map((i) => (i.id === id ? { ...i, votes } : i)) ?? list);
    const next = has ? [...voted].filter((v) => v !== id) : [...voted, id];
    try {
      localStorage.setItem(VOTES_KEY, JSON.stringify(next));
    } catch {}
    window.dispatchEvent(new Event("arcus-alpha-votes"));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(["All", ...ALPHA_TAGS] as const).map((t) => (
              <button key={t} onClick={() => setTag(t)} aria-pressed={tag === t}
                className={`h-8 rounded-full px-3.5 text-[13px] font-medium transition ${tag === t ? "bg-ink text-bg" : "bg-fill-2 text-ink-2 hover:text-ink"}`}>
                {t}
              </button>
            ))}
          </div>
          <Segmented label="Sort" value={sort} onChange={setSort} options={[{ value: "top", label: "Top" }, { value: "new", label: "New" }]} />
        </div>

        {!items ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-36 w-full !rounded-[22px]" />)}</div>
        ) : shown.length === 0 ? (
          <Card><p className="py-8 text-center text-[14px] text-ink-3">Nothing in {tag} yet. Share the first one.</p></Card>
        ) : (
          <>
            {paged.slice.map((i) => <AlphaCard key={i.id} item={i} voted={voted.has(i.id)} onVote={configured ? () => vote(i.id) : undefined} />)}
            <Pagination {...paged} noun="links" />
          </>
        )}
      </div>

      <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <SubmitCard configured={configured} />
        <Card title="What makes good alpha">
          <ul className="space-y-2 text-[13px] leading-relaxed text-ink-2">
            <li>• A concrete strategy, tool or walkthrough — not just hype.</li>
            <li>• Anything on points, fees, funding, invite codes or Arcus mechanics.</li>
            <li>• Your own content is welcome if it&apos;s genuinely useful.</li>
            <li>• Links are reviewed before they appear. Referral spam won&apos;t be approved.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function AlphaCard({ item: i, voted, onVote }: { item: AlphaItem; voted: boolean; onVote?: () => void }) {
  return (
    <article className="card rise flex gap-4 p-5">
      <button onClick={onVote} disabled={!onVote} aria-pressed={voted} aria-label={voted ? "Remove upvote" : "Upvote"}
        className={`flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-[14px] text-[13px] font-semibold transition ${
          voted ? "bg-accent text-on-accent" : "bg-fill-2 text-ink-2 hover:bg-fill hover:text-ink"} disabled:opacity-60`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 4 3 15h6v5h6v-5h6z" /></svg>
        <span className="tabular">{i.votes ?? 0}</span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
          <KindBadge kind={i.kind} />
          <span className="rounded-full bg-fill-2 px-2 py-0.5 font-medium">{i.tag}</span>
          {i.featured && <span className="rounded-full bg-gold/25 px-2 py-0.5 font-medium text-ink">★ Featured</span>}
          {i.postedAt && <span>{i.postedAt}</span>}
        </div>
        <a href={i.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="group mt-2 block">
          {i.kind === "youtube" && i.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail, small and fixed-size
            <img src={i.thumbnail} alt="" loading="lazy" className="mb-3 aspect-video w-full max-w-[420px] rounded-[14px] object-cover ring-1 ring-hairline" />
          )}
          {i.kind === "x" ? (
            <div className="flex items-center gap-3">
              <XAvatar handle={xHandle(i.authorUrl)} name={i.author} />
              <p className="min-w-0 text-[16px] font-semibold leading-tight group-hover:text-accent">
                {i.author}
                {i.authorUrl && <span className="block text-[13px] font-normal text-ink-3">@{i.authorUrl.split("/").pop()}</span>}
              </p>
            </div>
          ) : (
            <p className="text-[16px] font-semibold leading-snug group-hover:text-accent">{i.title}</p>
          )}
          {i.kind !== "x" && <p className="text-[13px] text-ink-2">{i.author}</p>}
          {i.text && <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-[14px] leading-relaxed text-ink">{i.text}</p>}
        </a>
        <p className="mt-3 rounded-[12px] bg-fill-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2">
          <span className="font-medium text-ink">Why it&apos;s useful: </span>{i.note}
          {i.sharedBy && <span className="text-ink-3"> — {i.sharedBy}</span>}
        </p>
        <a href={i.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="mt-2 inline-block text-[13px] font-medium text-accent hover:underline">
          Open on {i.kind === "x" ? "X" : i.kind === "youtube" ? "YouTube" : new URL(i.url).hostname.replace(/^www\./, "")} ↗
        </a>
      </div>
    </article>
  );
}

function KindBadge({ kind }: { kind: AlphaItem["kind"] }) {
  const label = kind === "x" ? "𝕏 Post" : kind === "youtube" ? "▶ Video" : "Article";
  return <span className="rounded-full bg-ink px-2 py-0.5 font-medium text-bg">{label}</span>;
}

function SubmitCard({ configured }: { configured: boolean }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [tag, setTag] = useState<AlphaTag>("Strategy");
  const [sharedBy, setSharedBy] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "busy" | "ok" | "error"; text?: string }>({ kind: "idle" });
  const isArticle = url && !/^(https?:\/\/)?(www\.|m\.|mobile\.)?(x\.com|twitter\.com|youtube\.com|youtu\.be)\//i.test(url.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ kind: "busy" });
    const res = await fetch("/api/alpha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, title, note, tag, sharedBy }),
    }).catch(() => null);
    const out = await res?.json().catch(() => ({}));
    if (!res?.ok) return setState({ kind: "error", text: out?.error ?? "Couldn't submit. Try again." });
    setState({ kind: "ok", text: "Thanks! It'll appear once it's reviewed." });
    setUrl("");
    setTitle("");
    setNote("");
  };

  const field = "mt-1.5 w-full rounded-[12px] bg-fill-2 px-3.5 text-[14px] outline-none focus:ring-2 focus:ring-accent placeholder:text-ink-3";
  return (
    <Card title="Share a link" subtitle="An X post, YouTube video or article with real Arcus alpha.">
      {!configured ? (
        <p className="text-[13px] text-ink-2">Sharing isn&apos;t set up on this deployment yet.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-[13px] font-medium text-ink-2">Link
            <input required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://x.com/…/status/…" className={`${field} h-11`} />
          </label>
          {isArticle && (
            <label className="block text-[13px] font-medium text-ink-2">Title
              <input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="What's it called?" className={`${field} h-11`} />
            </label>
          )}
          <label className="block text-[13px] font-medium text-ink-2">Why it&apos;s worth reading
            <textarea required value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} rows={3}
              placeholder="e.g. Shows how to place 0-fee maker orders step by step" className={`${field} resize-none py-2.5`} />
            <span className="mt-0.5 block text-right text-[11px] text-ink-3">{note.length}/{NOTE_MAX}</span>
          </label>
          <div>
            <span className="text-[13px] font-medium text-ink-2">Category</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ALPHA_TAGS.map((t) => (
                <button type="button" key={t} onClick={() => setTag(t)} aria-pressed={tag === t}
                  className={`h-8 rounded-full px-3 text-[13px] font-medium ${tag === t ? "bg-accent text-on-accent" : "bg-fill-2 text-ink-2"}`}>{t}</button>
              ))}
            </div>
          </div>
          <label className="block text-[13px] font-medium text-ink-2">Your name or @handle <span className="font-normal text-ink-3">(optional)</span>
            <input value={sharedBy} onChange={(e) => setSharedBy(e.target.value)} maxLength={30} placeholder="@you" className={`${field} h-11`} />
          </label>
          <button type="submit" disabled={state.kind === "busy"}
            className="h-11 w-full rounded-full bg-accent text-[15px] font-medium text-on-accent transition hover:brightness-110 disabled:opacity-60">
            {state.kind === "busy" ? "Checking the link…" : "Submit for review"}
          </button>
          {state.text && <p className={`text-[13px] ${state.kind === "error" ? "text-red" : "text-green"}`}>{state.text}</p>}
        </form>
      )}
    </Card>
  );
}

/* ------------------------------------ News ------------------------------------ */

const SOURCES: Record<NewsSource, string> = { blog: "Blog", app: "App updates", api: "API changelog", testnet: "Testnet" };
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function News({ news }: { news: { items: NewsItem[]; fetchedAt: number } }) {
  const [source, setSource] = useState<NewsSource | "all">("all");
  const items = useMemo(
    () => news.items.filter((i) => source === "all" || i.source === source).sort((a, b) => (b.date ?? 0) - (a.date ?? 0)),
    [news.items, source],
  );
  const paged = usePagination(items, 12, source);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "blog", "app", "api", "testnet"] as const).map((s) => (
            <button key={s} onClick={() => setSource(s)} aria-pressed={source === s}
              className={`h-8 rounded-full px-3.5 text-[13px] font-medium transition ${source === s ? "bg-ink text-bg" : "bg-fill-2 text-ink-2 hover:text-ink"}`}>
              {s === "all" ? "Everything" : SOURCES[s]}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-ink-3">From arcus.xyz/blog and docs.arcus.xyz · refreshed hourly</p>
      </div>
      {items.length === 0 ? (
        <Card><p className="py-8 text-center text-[14px] text-ink-3">Couldn&apos;t reach Arcus for updates right now. Try again later.</p></Card>
      ) : (
        <Card>
          <ol className="-my-2">
            {paged.slice.map((i) => (
              <li key={i.id} className="border-b border-hairline py-4 last:border-0">
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${i.source === "blog" ? "bg-accent text-on-accent" : "bg-fill-2"}`}>{SOURCES[i.source]}</span>
                  {i.category && <span>{i.category}</span>}
                  {i.date && <span className="tabular">{dateFmt.format(i.date)}</span>}
                </div>
                <a href={i.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 block text-[16px] font-semibold leading-snug hover:text-accent">
                  {i.title}
                </a>
                {i.summary && <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-ink-2">{i.summary}</p>}
              </li>
            ))}
          </ol>
          <Pagination {...paged} noun="updates" />
        </Card>
      )}
    </div>
  );
}
