import { describe, expect, it } from "vitest";
import { isOffHoursET, nextDistribution, weeksLeft } from "./season";

describe("season helpers", () => {
  it("treats 8PM–4AM ET and weekends as off-hours, across daylight saving", () => {
    expect(isOffHoursET(Date.UTC(2026, 9, 7, 14))).toBe(false); // Wed 10:00 EDT
    expect(isOffHoursET(Date.UTC(2026, 9, 8, 1))).toBe(true); // Wed 21:00 EDT
    expect(isOffHoursET(Date.UTC(2026, 9, 10, 15))).toBe(true); // Saturday
    expect(isOffHoursET(Date.UTC(2026, 11, 2, 8, 30))).toBe(true); // Wed 03:30 EST (winter): off-hours
    expect(isOffHoursET(Date.UTC(2026, 11, 2, 15))).toBe(false); // Wed 10:00 EST: regular hours
  });

  it("finds the next Wednesday 3PM ET distribution", () => {
    const next = nextDistribution(Date.UTC(2026, 9, 10, 12)); // Sat Oct 10 2026
    expect(new Date(next).toISOString()).toBe("2026-10-14T19:00:00.000Z"); // 3PM EDT
    const winter = nextDistribution(Date.UTC(2026, 11, 1)); // Tue Dec 1 2026
    expect(new Date(winter).toISOString()).toBe("2026-12-02T20:00:00.000Z"); // 3PM EST
  });

  it("counts weeks left in the season", () => {
    expect(weeksLeft(Date.UTC(2027, 6, 1))).toBe(0);
    expect(weeksLeft(Date.UTC(2027, 5, 23))).toBe(2);
  });
});
