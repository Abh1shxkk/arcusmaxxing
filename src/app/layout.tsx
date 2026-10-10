import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AlertsWatcher } from "@/components/Alerts";
import { Footer } from "@/components/Footer";
import { Nav, NavFrame } from "@/components/Nav";
import { Suspense } from "react";
import { TrackerProvider } from "@/components/TrackerProvider";
import Script from "next/script";
import { themeScript } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ArcusMaxxing",
  description: "Max out your Arcus farm. Fees, volume, funding, profit and cost per point for any wallet — plus your degen trader card.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edf3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0f140d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script may set data-theme before React hydrates, so allow that attribute to differ.
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">{themeScript}</Script>
        <TrackerProvider>
          <Suspense fallback={<NavFrame pathname={null} />}>
            <Nav />
          </Suspense>
          <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-6 pb-24 sm:px-6">{children}</main>
          <Footer />
          <AlertsWatcher />
        </TrackerProvider>
      </body>
    </html>
  );
}
