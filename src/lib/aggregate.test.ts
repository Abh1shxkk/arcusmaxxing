import { describe, expect, it } from "vitest";
import type { Fill } from "./arcus";
import { activityGrid, bps, bucketize, isPartialWeek, sizeBins, totals, weekStart } from "./aggregate";

const DAY = 86_400_000;
// 2026-10-05 is a Monday.
const MON = Date.UTC(2026, 9, 5);

function fill(ms: number, notional: number, fee: number, role: "MAKER" | "TAKER" = "TAKER", market = "BTC-USD"): Fill {
  return { key: `${ms}:${notional}:${market}`, market, side: "BUY", role, size: notional / 100, price: 100, notional, fee, pnl: -fee, createdAt: ms * 1000 };
}

describe("weekStart", () => {
  it("snaps any day of the week back to Monday 00:00 UTC", () => {
    expect(weekStart(MON)).toBe(MON);
    expect(weekStart(MON + 3 * DAY + 5_000)).toBe(MON);
    expect(weekStart(MON + 6 * DAY + DAY - 1)).toBe(MON); // Sunday 23:59:59.999
    expect(weekStart(MON + 7 * DAY)).toBe(MON + 7 * DAY);
  });
});

describe("bucketize", () => {
  const fills = [fill(MON + 1000, 1000, 0.5), fill(MON + DAY, 2000, 1, "MAKER"), fill(MON + 8 * DAY, 500, -0.01, "MAKER")];

  it("puts every fill in exactly one daily bucket, including empty days", () => {
    const days = bucketize(fills, "day", MON, MON + 9 * DAY);
    expect(days).toHaveLength(10);
    expect(days.reduce((s, b) => s + b.volume, 0)).toBe(3500);
    expect(days.reduce((s, b) => s + b.trades, 0)).toBe(3);
    expect(days[2].trades).toBe(0);
  });

  it("splits fees into paid and rebates, and volume into maker and taker", () => {
    const [w1, w2] = bucketize(fills, "week", MON, MON + 9 * DAY);
    expect(w1.fees).toBeCloseTo(1.5);
    expect(w1.makerVolume).toBe(2000);
    expect(w1.takerVolume).toBe(1000);
    expect(w2.rebates).toBeCloseTo(0.01);
    expect(w2.feesPaid).toBe(0);
  });
});

describe("isPartialWeek", () => {
  it("flags the current week and a week cut off by the range start", () => {
    expect(isPartialWeek(MON, MON, MON + 2 * DAY)).toBe(true); // current week
    expect(isPartialWeek(MON - 7 * DAY, MON - 5 * DAY, MON + 2 * DAY)).toBe(true); // range began mid-week
    expect(isPartialWeek(MON - 7 * DAY, MON - 7 * DAY, MON + 2 * DAY)).toBe(false);
  });
});

describe("totals, bps", () => {
  it("sums by market, ordered by volume", () => {
    const t = totals([fill(MON, 100, 0.01, "TAKER", "ETH-USD"), fill(MON, 300, 0.03), fill(MON, 50, -0.001, "MAKER", "ETH-USD")]);
    expect(t.byMarket.map((m) => m.market)).toEqual(["BTC-USD", "ETH-USD"]);
    expect(t.rebates).toBeCloseTo(0.001);
  });

  it("expresses fees as basis points of volume", () => {
    expect(bps(2.25, 10_000)).toBeCloseTo(2.25);
    expect(bps(5, 0)).toBe(0);
  });
});

describe("activityGrid and sizeBins", () => {
  it("places fills on the right weekday × hour, Monday first", () => {
    const grid = activityGrid([fill(MON + 13 * 3_600_000, 100, 0), fill(MON + 6 * DAY + 23 * 3_600_000, 100, 0)]);
    expect(grid).toHaveLength(168);
    expect(grid[13].trades).toBe(1); // Monday 13:00
    expect(grid[6 * 24 + 23].trades).toBe(1); // Sunday 23:00
  });

  it("bins trades by size on the lower edge", () => {
    const bins = sizeBins([fill(MON, 99, 0), fill(MON, 100, 0), fill(MON, 2_000_000, 0)]);
    expect(bins.map((b) => b.trades)).toEqual([1, 1, 0, 0, 0, 1]);
  });
});
