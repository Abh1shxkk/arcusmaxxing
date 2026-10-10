"use client";

import { useState } from "react";

/** Handle from a profile URL like https://x.com/name (what X's oEmbed returns as author_url). */
export const xHandle = (authorUrl: string | null | undefined) => authorUrl?.split("/").filter(Boolean).pop() ?? "";

/** The author's X profile picture (via unavatar.io), falling back to their initial. */
export function XAvatar({ handle, name, size = 44 }: { handle: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!handle || failed) {
    return (
      <span className="grid shrink-0 place-items-center rounded-full bg-accent font-bold text-on-accent" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden>
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote avatar from a third-party resolver
    <img src={`https://unavatar.io/x/${encodeURIComponent(handle)}?fallback=false`} alt="" width={size} height={size} loading="lazy"
      onError={() => setFailed(true)} style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover ring-1 ring-hairline" />
  );
}
