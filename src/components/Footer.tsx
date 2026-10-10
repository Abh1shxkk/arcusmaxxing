import type { ReactNode } from "react";

const LINKS: { label: string; href: string; icon: ReactNode }[] = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/abhishek-chauhan-880496394",
    icon: <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />,
  },
  {
    label: "X",
    href: "https://x.com/abh1shxkk",
    icon: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />,
  },
  {
    label: "GitHub",
    href: "https://github.com/abh1shxkk",
    icon: <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />,
  },
];

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-[1180px] px-4 pb-10 sm:px-6">
      <div className="card flex flex-col items-center justify-between gap-5 p-6 sm:flex-row">
        <div className="text-center sm:text-left">
          <p className="text-[13px] text-ink-2">Built by</p>
          <a href="https://portfolio-frontend-sigma-jade.vercel.app/" target="_blank" rel="noopener noreferrer"
            className="text-[19px] font-semibold tracking-tight hover:text-accent">
            Abhishek Chauhan ↗
          </a>
          <p className="mt-0.5 text-[13px] text-ink-3">Follow along for more Arcus tools.</p>
        </div>
        <div className="flex items-center gap-2">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.label} title={l.label}
              className="grid h-11 w-11 place-items-center rounded-full bg-fill-2 text-ink-2 transition hover:bg-accent hover:text-on-accent">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>{l.icon}</svg>
            </a>
          ))}
          <a href="https://portfolio-frontend-sigma-jade.vercel.app/" target="_blank" rel="noopener noreferrer"
            className="flex h-11 items-center rounded-full bg-fill-2 px-4 text-[14px] font-medium text-ink-2 transition hover:bg-accent hover:text-on-accent">
            Portfolio
          </a>
        </div>
      </div>
      <p className="mt-6 text-center text-[12px] leading-relaxed text-ink-3">
        Data from the public Arcus mainnet API. Days and weeks are in UTC; weeks start Monday.
        <br />
        Points are entered by you and stored only in this browser. Not affiliated with Arcus.
      </p>
    </footer>
  );
}
