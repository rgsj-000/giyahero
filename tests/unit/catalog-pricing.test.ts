import { describe, expect, it } from "vitest";
import { quotePackage } from "@/modules/catalog/pricing";
import type { CatalogDetail } from "@/modules/catalog/types";

const detail = {
  minTravelers: 1,
  maxTravelers: 8,
  pricingModel: "per_person",
  rates: [
    {
      id: "standard",
      label: "Standard",
      amountMinor: 125050,
      minTravelers: 1,
      maxTravelers: null,
    },
  ],
} as CatalogDetail;

describe("live catalog quotation", () => {
  it("charges the catalog per-person rate for adults and children", () => {
    expect(quotePackage(detail, "standard", 2, 1)).toBe(375150);
  });
  it("charges a per-group rate once", () => {
    expect(
      quotePackage({ ...detail, pricingModel: "per_group" }, "standard", 2, 1),
    ).toBe(125050);
  });
  it.each(["tiered", "variant"] as const)(
    "uses the selected eligible %s rate per traveler",
    (pricingModel) => {
      expect(quotePackage({ ...detail, pricingModel }, "standard", 2, 1)).toBe(
        375150,
      );
    },
  );
  it("rejects a missing or ineligible rate", () => {
    expect(() => quotePackage(detail, "foreign", 2, 1)).toThrow();
    expect(() =>
      quotePackage(
        { ...detail, rates: [{ ...detail.rates[0], minTravelers: 4 }] },
        "standard",
        2,
        1,
      ),
    ).toThrow();
  });
  it.each([
    [0, 2],
    [1, -1],
    [1.5, 0],
    [1, 0.5],
    [9, 0],
    [NaN, 0],
  ])("rejects invalid traveler counts %s/%s", (adults, children) => {
    expect(() => quotePackage(detail, "standard", adults, children)).toThrow();
  });
  it("rejects a total outside safe integer bounds", () => {
    expect(() =>
      quotePackage(
        {
          ...detail,
          rates: [{ ...detail.rates[0], amountMinor: Number.MAX_SAFE_INTEGER }],
        },
        "standard",
        2,
        0,
      ),
    ).toThrow();
  });
});
