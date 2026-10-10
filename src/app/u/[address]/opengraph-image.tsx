import { ImageResponse } from "next/og";
import { profileForShare } from "@/lib/shareProfile";
import { shortAddress, usd } from "@/lib/format";

// Social preview for a shared trader card — the street poster, rebuilt with the flexbox-only
// layout the image renderer supports.

export const alt = "Arcus trader card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN = "#1e3b25";
const CREAM = "#f5f2eb";
const GOLD = "#d9bb6a";
const SAGE = "#a9d6a0";
const INK = "#0f140d";

async function googleFont(family: string) {
  // Without a browser user agent Google Fonts serves TrueType, which the renderer can read.
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replaceAll(" ", "+")}`)).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
  if (!url) throw new Error(`No TrueType source for ${family}`);
  return (await fetch(url)).arrayBuffer();
}

export default async function Image({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const valid = /^0x[a-fA-F0-9]{40}$/.test(address);
  const data = valid ? await profileForShare(address.toLowerCase()) : null;

  const words = data?.profile.title.split(" ") ?? ["Arcus", "Trader"];
  const big = words.at(-1) ?? "";
  const small = words.slice(0, -1).join(" ");
  const wagmi = (data?.profile.degenScore ?? 0) >= 60;
  const traits = data?.profile.traits.slice(0, 4) ?? [];
  const lines = data
    ? [
        ["30D VOLUME", usd(data.stats.rollingVolume, { compact: true })],
        ["30D FEES", usd(data.stats.rollingFeesPaid, { compact: true })],
        ["FEE RATE", `${data.profile.rateBps.toFixed(2)} bps`],
      ]
    : [];

  const [tag, marker] = await Promise.all([googleFont("Sedgwick Ave Display"), googleFont("Permanent Marker")]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: GREEN, color: CREAM, fontFamily: "Marker" }}>
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", top: 0, left: 0 }}>
          <path d="M620 110a400 400 0 0 1 400 400v120H870V510a250 250 0 0 0-250-250Z" fill={GOLD} />
          <rect x="40" y="400" width="420" height="200" fill={SAGE} transform="rotate(-4 250 500)" />
        </svg>

        <div style={{ position: "absolute", top: 36, left: 48, display: "flex", fontSize: 26, letterSpacing: 2 }}>
          ARCUS<span style={{ color: GOLD }}>MAXXING</span><span style={{ color: GOLD, margin: "0 10px" }}>{"//"}</span> HALL OF DEGENS
        </div>

        <div style={{ position: "absolute", top: 28, right: 48, display: "flex", flexDirection: "column", alignItems: "center",
          border: `5px solid ${wagmi ? GOLD : CREAM}`, borderRadius: 10, padding: "6px 18px", transform: "rotate(7deg)", color: wagmi ? GOLD : CREAM }}>
          <span style={{ fontSize: 44, lineHeight: 1 }}>{wagmi ? "WAGMI" : "NGMI"}</span>
          <span style={{ fontSize: 16 }}>{data?.profile.scoreLabel.toUpperCase() ?? ""}</span>
        </div>

        <div style={{ position: "absolute", top: 110, left: 48, display: "flex", flexDirection: "column", transform: "rotate(-4deg)", fontFamily: "Tag" }}>
          {small && <span style={{ fontSize: 64, color: SAGE, textShadow: `4px 4px 0 ${INK}`, lineHeight: 1 }}>{small}</span>}
          <span style={{ fontSize: 150, color: CREAM, textShadow: `7px 7px 0 ${INK}`, lineHeight: 1 }}>{big}</span>
        </div>

        <div style={{ position: "absolute", top: 190, right: 150, width: 220, height: 220, borderRadius: 999, background: CREAM,
          border: `8px solid ${INK}`, boxShadow: `9px 9px 0 ${INK}`, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(10deg)", fontSize: 120 }}>
          {data?.profile.creature.emoji ?? "👻"}
        </div>
        {data && (
          <div style={{ position: "absolute", top: 410, right: 180, display: "flex", background: INK, color: GOLD, fontSize: 22, padding: "4px 12px", borderRadius: 6 }}>
            DEGEN {data.profile.degenScore}/100
          </div>
        )}

        {lines.length > 0 && (
          <div style={{ position: "absolute", left: 56, bottom: 44, width: 380, display: "flex", flexDirection: "column", background: CREAM, color: INK,
            padding: "16px 22px", fontSize: 22, boxShadow: `6px 6px 0 ${INK}`, transform: "rotate(-2deg)" }}>
            {lines.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ position: "absolute", left: 500, right: 48, bottom: 80, display: "flex", flexWrap: "wrap", gap: 12 }}>
          {traits.map((t, i) => (
            <div key={t.name} style={{ display: "flex", background: [GOLD, CREAM, SAGE, INK][i], color: i === 3 ? GOLD : INK, border: `3px solid ${INK}`,
              boxShadow: `4px 4px 0 ${INK}`, borderRadius: 10, padding: "4px 14px", fontSize: 24, transform: `rotate(${[-4, 3, -2, 5][i]}deg)` }}>
              {t.emoji} {t.name}
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", right: 48, bottom: 34, display: "flex", fontSize: 22 }}>
          gm from {valid ? shortAddress(address) : "Arcus"} · arcusmaxxing.vercel.app
        </div>
      </div>
    ),
    {
      ...size,
      emoji: "twemoji",
      fonts: [
        { name: "Tag", data: tag, style: "normal", weight: 400 },
        { name: "Marker", data: marker, style: "normal", weight: 400 },
      ],
    },
  );
}
