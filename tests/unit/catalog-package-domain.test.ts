import { describe, expect, it } from "vitest";
import {
  canPublishPackage,
  formatPrice,
  packagePublicationInputSchema,
  type PackagePublicationInput,
} from "@/modules/catalog/package";

const validPackage: PackagePublicationInput = {
  title: "Quezon Island Escape",
  overview:
    "Explore Quezon's coastline with a local guide, comfortable transfers, and a carefully planned itinerary.",
  tripType: "island-hopping",
  durationDays: 2,
  minTravelers: 2,
  maxTravelers: 8,
  currencyCode: "PHP",
  pricingModel: "per_person",
  scheduleModel: "fixed_departures",
  openDateWindow: null,
  destinationIds: ["00000000-0000-4000-8000-000000000001"],
  itinerary: [
    {
      dayNumber: 1,
      title: "Coastal arrival",
      description: "Meet your guide and explore the coast.",
    },
    {
      dayNumber: 2,
      title: "Island visit",
      description: "Visit a nearby island before returning.",
    },
  ],
  inclusions: ["Local guide"],
  exclusions: ["Personal expenses"],
  prices: [
    {
      label: "Adult",
      minTravelers: 1,
      maxTravelers: null,
      amountMinor: 125050,
    },
  ],
  policies: {
    cancellationTerms: "Full refund when cancelled at least seven days ahead.",
    reschedulingTerms: "One date change is allowed up to five days ahead.",
    noShowTerms: "No refund is available for missed departures.",
    agencyCancellationTerms:
      "The agency will offer a full refund or an alternate date.",
  },
  departures: [
    {
      startsAt: "2026-12-01T08:00:00.000Z",
      endsAt: "2026-12-02T17:00:00.000Z",
      bookingCutoffAt: "2026-11-28T08:00:00.000Z",
      capacity: 8,
    },
  ],
};

describe("catalog package publication rules", () => {
  it("allows complete packages from verified agencies only", () => {
    expect(canPublishPackage("verified", validPackage)).toBe(true);
    expect(canPublishPackage("unverified", validPackage)).toBe(false);
    expect(canPublishPackage("suspended", validPackage)).toBe(false);
  });

  it("requires fixed departures only for fixed-date packages", () => {
    expect(
      packagePublicationInputSchema.safeParse({
        ...validPackage,
        departures: [],
      }).success,
    ).toBe(false);

    expect(
      packagePublicationInputSchema.safeParse({
        ...validPackage,
        scheduleModel: "open_dates",
        openDateWindow: {
          startsOn: "2026-11-01",
          endsOn: "2026-12-31",
        },
        departures: [],
      }).success,
    ).toBe(true);

    expect(
      packagePublicationInputSchema.safeParse({
        ...validPackage,
        scheduleModel: "open_dates",
        openDateWindow: {
          startsOn: "2026-12-01",
          endsOn: "2026-11-01",
        },
        departures: [],
      }).success,
    ).toBe(false);

    expect(
      packagePublicationInputSchema.safeParse({
        ...validPackage,
        scheduleModel: "open_dates",
        openDateWindow: null,
        departures: [],
      }).success,
    ).toBe(false);
  });

  it("rejects price values that are not positive integer minor units", () => {
    expect(
      packagePublicationInputSchema.safeParse({
        ...validPackage,
        prices: [{ ...validPackage.prices[0], amountMinor: 12.5 }],
      }).success,
    ).toBe(false);

    expect(
      packagePublicationInputSchema.safeParse({
        ...validPackage,
        prices: [
          {
            ...validPackage.prices[0],
            minTravelers: 5,
            maxTravelers: 4,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("validates departure order, booking cutoff, and itinerary duration", () => {
    expect(
      packagePublicationInputSchema.safeParse({
        ...validPackage,
        departures: [
          {
            ...validPackage.departures[0],
            endsAt: "2026-11-30T08:00:00.000Z",
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      packagePublicationInputSchema.safeParse({
        ...validPackage,
        itinerary: [
          ...validPackage.itinerary,
          {
            dayNumber: 3,
            title: "Extra day",
            description: "This day exceeds the package duration.",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("formats integer minor-unit prices using currency-specific precision", () => {
    expect(formatPrice(125050, "PHP")).toContain("1,250.50");
    expect(formatPrice(500, "JPY")).toContain("5");
    expect(() => formatPrice(12.5, "PHP")).toThrow(RangeError);
  });
});
