"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo, ThemeToggle } from "./Logo";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/points", label: "Points" },
  { href: "/farm", label: "Farm" },
  { href: "/alpha", label: "Alpha" },
  { href: "/card", label: "Card" },
  { href: "/compare", label: "Compare" },
  { href: "/markets", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/fees", label: "Calculators" },
] as const;

export function Nav() {
  return <NavFrame pathname={usePathname()} />;
}

/**
 * The bar itself. Rendered with `pathname={null}` as the Suspense fallback, because on routes whose
 * URL isn't known at build time (e.g. /u/[address]) reading the pathname has to wait for the request.
 */
export function NavFrame({ pathname }: { pathname: string | null }) {
  const links = LINKS.map(({ href, label }) => {
    const active = pathname === href;
    return (
      <Link key={href} href={href} aria-current={active ? "page" : undefined}
        className={`shrink-0 rounded-full px-3 py-1.5 text-[14px] transition ${
          active ? "bg-ink font-medium text-bg" : "text-ink-2 hover:bg-fill-2 hover:text-ink"}`}>
        {label}
      </Link>
    );
  });

  return (
    <div className="sticky top-0 z-30 px-4 pt-3 sm:px-6">
      <nav className="glass mx-auto flex h-14 max-w-[1180px] items-center justify-between rounded-full border border-hairline pr-2 pl-3 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[16px] font-bold tracking-tight 2xl:inline xl:hidden">Arcus<span className="text-accent">Maxxing</span></span>
        </Link>
        <div className="hidden items-center gap-0.5 xl:flex">{links}</div>
        <div className="flex items-center gap-1.5">
          <span className="hidden items-center gap-1.5 rounded-full bg-fill-2 px-3 py-1.5 text-[13px] font-medium text-ink-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-green" />
            Mainnet
          </span>
          <ThemeToggle />
        </div>
      </nav>
      {/* Phones: the links get their own scrollable pill below the bar. */}
      <div className="glass mx-auto mt-2 flex max-w-[1180px] gap-1 overflow-x-auto rounded-full border border-hairline p-1 xl:hidden">
        {links}
      </div>
    </div>
  );
}
