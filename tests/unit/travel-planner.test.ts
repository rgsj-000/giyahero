import { describe, expect, it } from "vitest";
import {
  findPackages,
  quoteTotal,
  validateTrip,
  packages,
} from "@/features/travel/data";

describe("travel planning", () => {
  it("matches a destination and enforces the per-person budget", () => {
    const results = findPackages("Mauban", 3200);
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (item) => item.destinations.includes("Mauban") && item.price <= 3200,
      ),
    ).toBe(true);
    expect(findPackages("Mauban", 1)).toEqual([]);
  });
  it("calculates a quotation for the whole group", () => {
    expect(quoteTotal(packages[0], 5, 2)).toBe(packages[0].price * 7);
  });
  it("rejects reversed dates and empty groups", () => {
    expect(validateTrip("2026-10-13", "2026-10-11", 5)).toBeTruthy();
    expect(validateTrip("2026-10-11", "2026-10-13", 0)).toBeTruthy();
    expect(validateTrip("2026-10-11", "2026-10-13", 7)).toBe("");
  });
});
