// Deterministic pixel-art "degen" avatar for a wallet: the address picks a skin, eyes, mouth,
// headwear and background, so the same wallet always gets the same character.

type Px = [x: number, y: number, w?: number, h?: number];

const BACKGROUNDS = ["#1e3b25", "#f5f2eb", "#a9d6a0", "#d9bb6a", "#0f140d", "#5b3fa0", "#c2410c", "#2f855a"];
const SKINS: { name: string; color: string; shade: string }[] = [
  { name: "Alien", color: "#8fd18b", shade: "#5fa85c" },
  { name: "Ape", color: "#8b5a2b", shade: "#6b4320" },
  { name: "Zombie", color: "#7da269", shade: "#5c7d4b" },
  { name: "Gold", color: "#e3c56f", shade: "#b8963e" },
  { name: "Diamond", color: "#9ad1ff", shade: "#5fa8e6" },
  { name: "Robot", color: "#b4b9c0", shade: "#80868f" },
  { name: "Pink", color: "#f2a5c0", shade: "#d97a9c" },
  { name: "Human", color: "#e0b48a", shade: "#bf8f63" },
];
const EYES = ["Laser-Eyed", "Shaded", "3D", "Sleepy", "Wide-Eyed"] as const;
const MOUTHS = ["smile", "grin", "flat", "open"] as const;
const HATS = ["Capped", "Beanie", "Crowned", "Headband", "Mohawk", "Bald"] as const;
const INK = "#0f140d";

/** Stable traits from an address (or any string). */
export function degenTraits(seed: string) {
  // FNV-1a over the whole address, then xorshift for a stream of picks — every character counts.
  let h = 2166136261;
  for (const ch of seed.toLowerCase()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rolls: number[] = [];
  for (let i = 0; i < 8; i++) {
    h ^= h << 13; h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5; h >>>= 0;
    rolls.push(h % 251);
  }
  const n = (i: number) => rolls[i];
  const skin = SKINS[n(0) % SKINS.length];
  const eyes = EYES[n(1) % EYES.length];
  const mouth = MOUTHS[n(2) % MOUTHS.length];
  const hat = HATS[n(3) % HATS.length];
  const bg = BACKGROUNDS[n(4) % BACKGROUNDS.length];
  const hatColor = ["#c53030", "#2b6cb0", "#1e3b25", "#0f140d", "#c2410c"][n(5) % 5];
  const earring = n(6) % 4 === 0;
  const name = [eyes === "Wide-Eyed" ? null : eyes, hat === "Bald" ? null : hat, skin.name].filter(Boolean).join(" ");
  return { skin, eyes, mouth, hat, bg, hatColor, earring, name };
}

export function DegenAvatar({ address, size = 40, className = "", tooltip = true }: { address: string; size?: number; className?: string; tooltip?: boolean }) {
  const t = degenTraits(address);
  const rects: { p: Px; c: string }[] = [];
  const add = (c: string, ...ps: Px[]) => ps.forEach((p) => rects.push({ p, c }));

  // Head and neck
  add(t.skin.color, [4, 4, 8, 10], [3, 7, 1, 3], [12, 7, 1, 3], [6, 14, 4, 2]);
  add(t.skin.shade, [4, 13, 8, 1], [11, 5, 1, 8]);

  // Headwear
  if (t.hat === "Capped") add(t.hatColor, [4, 2, 8, 2], [3, 4, 10, 1], [12, 4, 3, 1]);
  if (t.hat === "Beanie") add(t.hatColor, [4, 2, 8, 3], [7, 1, 2, 1]);
  if (t.hat === "Crowned") add("#e3c56f", [4, 3, 8, 1], [4, 2, 1, 1], [7, 1, 2, 2], [11, 2, 1, 1]);
  if (t.hat === "Headband") add(t.hatColor, [4, 5, 8, 1], [12, 5, 2, 1], [13, 6, 1, 1]);
  if (t.hat === "Mohawk") add(t.hatColor, [7, 1, 2, 4]);
  if (t.hat === "Bald") add(t.skin.shade, [5, 4, 6, 1]);

  // Eyes
  if (t.eyes === "Laser-Eyed") add("#ff3b30", [5, 7, 2, 1], [9, 7, 2, 1], [11, 7, 5, 1], [0, 7, 5, 1]);
  if (t.eyes === "Shaded") {
    add(INK, [4, 7, 8, 1], [5, 8, 2, 1], [9, 8, 2, 1]);
    add("#ffffff", [5, 7, 1, 1]);
  }
  if (t.eyes === "3D") {
    add(INK, [4, 7, 8, 1]);
    add("#e53e3e", [5, 7, 2, 1]);
    add("#3182ce", [9, 7, 2, 1]);
  }
  if (t.eyes === "Sleepy") add(INK, [5, 8, 2, 1], [9, 8, 2, 1]);
  if (t.eyes === "Wide-Eyed") {
    add("#ffffff", [5, 7, 2, 2], [9, 7, 2, 2]);
    add(INK, [6, 8, 1, 1], [10, 8, 1, 1]);
  }

  // Mouth
  if (t.mouth === "smile") add(INK, [6, 11, 4, 1], [5, 10, 1, 1], [10, 10, 1, 1]);
  if (t.mouth === "grin") {
    add(INK, [6, 10, 4, 2]);
    add("#ffffff", [6, 10, 4, 1]);
  }
  if (t.mouth === "flat") add(INK, [6, 11, 4, 1]);
  if (t.mouth === "open") add(INK, [7, 10, 2, 2]);

  if (t.earring) add("#9ad1ff", [3, 10, 1, 1]);

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" role="img"
      aria-label={t.name} className={`shrink-0 rounded-full ${className}`}>
      {tooltip && <title>{t.name}</title>}
      <rect width="16" height="16" fill={t.bg} />
      {rects.map(({ p: [x, y, w = 1, h = 1], c }, i) => <rect key={i} x={x} y={y} width={w} height={h} fill={c} />)}
    </svg>
  );
}
