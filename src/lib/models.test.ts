import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import type { AccountStats, FeeTier, Fill } from "./arcus";
import { buildModel, feesFor, tierForWeeklyVolume } from "./pointsModel";
import { liquidationPrice } from "./liquidation";
import { buildProfile } from "./traderProfile";
import { toCsv } from "./csv";
import { migratePoints } from "./points";
import { median, quantile, sha256Hex, signMessage, validatePayload } from "./pointsSync";

const WEEK = 7 * 86_400_000;
const MON = Date.UTC(2026, 9, 5);
const week = (i: number, volume: number, fees: number, points: number) => ({
  start: MON + i * WEEK, volume, fees, points, feesPaid: fees, rebates: 0, makerVolume: 0, takerVolume: volume, trades: 1,
});

const TIERS: FeeTier[] = [
  { level: 0, name: "Base", volumeThreshold: 0, makerFeePpm: 0, takerFeePpm: 225 },
  { level: 1, name: "Bronze", volumeThreshold: 5e6, makerFeePpm: 0, takerFeePpm: 190 },
  { level: 5, name: "VIP", volumeThreshold: 1e9, makerFeePpm: -20, takerFeePpm: 100 },
];

describe("points model", () => {
  it("recovers a fee-driven points rate and prefers fees over volume", () => {
    const weeks = [1, 2, 3, 4, 5].map((i) => week(i, 1e6 * (i % 3 + 1), 100 * i, 2 * 100 * i));
    const m = buildModel(weeks)!;
    expect(m.best).toBe("fees");
    expect(m.byFees.rate).toBeCloseTo(2);
    expect(m.byFees.r2).toBeCloseTo(1);
  });

  it("detects points getting pricier week over week", () => {
    const weeks = [0, 1, 2, 3].map((i) => week(i, 1e6, 100, 100 / 1.1 ** i));
    expect(buildModel(weeks)!.weeklyCostTrend).toBeCloseTo(0.1);
  });

  it("returns null with no scored weeks, and no R² below three", () => {
    expect(buildModel([])).toBeNull();
    expect(buildModel([week(0, 1e6, 100, 50)])!.byFees.r2).toBeNull();
  });

  it("picks the tier a steady weekly pace lands in and prices the mix", () => {
    expect(tierForWeeklyVolume(TIERS, 1.2e6)!.name).toBe("Bronze"); // 1.2M × 30/7 ≈ 5.14M
    expect(tierForWeeklyVolume(TIERS, 1e3)!.name).toBe("Base");
    expect(feesFor(1e6, 0.2, TIERS[0])).toBeCloseTo(180);
    expect(feesFor(1e6, 1, TIERS[2])).toBeCloseTo(-20); // all-maker at VIP earns a rebate
  });
});

describe("liquidationPrice", () => {
  it("matches the closed form with no maintenance margin", () => {
    expect(liquidationPrice({ side: "long", entry: 100, leverage: 10, notional: 1000, maintenanceFraction: 0 }).price).toBeCloseTo(90);
    expect(liquidationPrice({ side: "short", entry: 100, leverage: 10, notional: 1000, maintenanceFraction: 0 }).price).toBeCloseTo(110);
  });

  it("liquidates sooner with maintenance margin, and reports margin posted", () => {
    const r = liquidationPrice({ side: "long", entry: 100, leverage: 10, notional: 1000, maintenanceFraction: 0.05 });
    expect(r.price).toBeGreaterThan(90);
    expect(r.price).toBeCloseTo(94.7368, 3);
    expect(r.margin).toBe(100);
    expect(r.maintenanceAtEntry).toBe(50);
  });
});

describe("trader profile", () => {
  const stats = (volume: number, fees: number): AccountStats => ({
    rollingVolume: volume, rollingFeesPaid: fees, lifetimeVolume: volume, lifetimeFeesPaid: fees,
    windows: { "24h": { volume: 0, feesPaid: 0 }, "7d": { volume: 0, feesPaid: 0 }, "30d": { volume, feesPaid: fees } },
    tier: { level: 0, makerFeePpm: 0, takerFeePpm: 225 },
  });

  it("names the creature by 30-day volume and the style by fee rate", () => {
    expect(buildProfile(stats(0, 0), [], null, 30).title).toBe("Ghost");
    expect(buildProfile(stats(5_000, 1.1), [], null, 30).title).toBe("Fee-Burning Shrimp");
    expect(buildProfile(stats(2e6, 40), [], null, 30).title).toBe("Fee-Dodging Shark");
    expect(buildProfile(stats(2e8, -100), [], null, 30).title).toBe("Rebate-Farming Kraken");
  });

  it("awards traits from trade patterns", () => {
    const fills: Fill[] = Array.from({ length: 40 }, (_, i) => ({
      key: String(i), market: "BTC-USD", side: "BUY", role: "MAKER", size: 1, price: 100, notional: 100, fee: -0.001, pnl: 0.001,
      createdAt: (MON + (i % 5) * 86_400_000 + 2 * 3_600_000) * 1000, // 02:00 UTC, weekdays
    }));
    const names = buildProfile(stats(4_000, -0.04), fills, null, 5).traits.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["Rebate Hunter", "Maker Maxi", "Night Owl", "BTC Maxi"]));
  });
});

describe("csv", () => {
  it("quotes cells with commas, quotes or newlines", () => {
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"'], [1, null]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n1,');
  });
});

describe("points sync", () => {
  const WED = Date.UTC(2026, 8, 30, 16); // an Arcus points-week start
  const good = { weeks: [{ start: WED, points: 100, fees: 12.5, volume: 50_000 }] };

  it("accepts a well-formed payload and rejects bad ones", () => {
    expect(validatePayload(good)).toBeNull();
    expect(validatePayload({ weeks: [{ ...good.weeks[0], start: MON }] })).toMatch(/Wednesday/); // old Monday weeks are rejected
    expect(validatePayload({ weeks: [{ ...good.weeks[0], points: -1 }] })).toMatch(/Points/);
    expect(validatePayload({ weeks: [good.weeks[0], good.weeks[0]] })).toMatch(/Duplicate/);
    expect(validatePayload("nope")).toMatch(/Malformed/);
  });

  it("round-trips a wallet signature over the payload hash", async () => {
    // Hardhat's well-known public test account #1 — not a real key.
    const account = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
    const payload = JSON.stringify(good);
    const ts = Date.now();
    const message = signMessage(account.address, await sha256Hex(payload), ts);
    const signature = await account.signMessage({ message });
    expect(await verifyMessage({ address: account.address, message, signature })).toBe(true);
    // Tampering with the data changes the hash, so the same signature no longer verifies.
    const tampered = signMessage(account.address, await sha256Hex(payload.replace("100", "999")), ts);
    expect(await verifyMessage({ address: account.address, message: tampered, signature })).toBe(false);
  });

  it("computes robust community statistics", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 100])).toBe(2.5);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
  });
});

describe("saved points migration", () => {
  it("moves Monday-keyed weeks into the Arcus points week they fall in", () => {
    const WED = Date.UTC(2026, 8, 30, 16);
    const { points, changed } = migratePoints({ [MON]: 120, [WED + 7 * 86_400_000]: 80 });
    expect(changed).toBe(true);
    expect(points).toEqual({ [WED]: 120, [WED + 7 * 86_400_000]: 80 });
    expect(migratePoints(points).changed).toBe(false); // already migrated
  });
});
