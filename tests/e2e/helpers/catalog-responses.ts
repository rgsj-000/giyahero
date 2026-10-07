import type { Page } from "@playwright/test";
export const liveCard = {
  id: "30000000-0000-4000-8000-000000000001",
  agencyId: "20000000-0000-4000-8000-000000000001",
  agencyName: "Real Quezon Agency",
  slug: "real-island-trip",
  title: "Real Island Trip",
  durationDays: 2,
  currencyCode: "PHP",
  fromAmountMinor: 125050,
  imagePath: null,
  destinationNames: ["Island"],
};
export const liveDetail = {
  ...liveCard,
  version: 1,
  overview:
    "Explore the island with a local guide and return the following day.",
  agencyDescription: "Locally operated tours.",
  agencyContactEmail: "agency@example.test",
  agencyContactPhone: "09123456789",
  pricingModel: "per_person",
  scheduleModel: "fixed_departures",
  minTravelers: 1,
  maxTravelers: 8,
  openDateWindow: null,
  rates: [
    {
      id: "50000000-0000-4000-8000-000000000001",
      label: "Standard",
      amountMinor: 125050,
      minTravelers: 1,
      maxTravelers: null,
    },
  ],
  departures: [
    {
      id: "60000000-0000-4000-8000-000000000001",
      startsAt: "2030-12-01T00:00:00Z",
      endsAt: "2030-12-02T09:00:00Z",
      bookingCutoffAt: "2030-11-28T00:00:00Z",
      capacity: 8,
      remainingCapacity: 8,
    },
  ],
  itinerary: [
    { dayNumber: 1, title: "Arrival", description: "Meet your local guide." },
    {
      dayNumber: 2,
      title: "Island visit",
      description: "Visit the island and return.",
    },
  ],
  inclusions: ["Local guide"],
  exclusions: ["Personal expenses"],
  media: [],
  policies: {
    cancellationTerms: "Contact the agency to cancel.",
    reschedulingTerms: "Contact the agency to reschedule.",
    noShowTerms: "No refund for a missed departure.",
    agencyCancellationTerms: "The agency will arrange a refund.",
  },
};
export async function mockCatalog(
  page: Page,
  mode: "live" | "empty" | "error" = "live",
) {
  await page.route("https://staging.example.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("search_published_packages")) {
      const filters = route.request().postDataJSON()?.filters ?? {};
      if (mode === "error")
        return route.fulfill({
          status: 503,
          json: { message: "Catalog temporarily unavailable" },
        });
      const affordable =
        filters.maxBudgetMinor === undefined ||
        filters.maxBudgetMinor >= 125050 * (filters.travelers ?? 1);
      return route.fulfill({
        json: {
          items: mode === "empty" || !affordable ? [] : [liveCard],
          nextCursor: null,
        },
      });
    }
    if (path.endsWith("get_public_package_detail"))
      return route.fulfill({ json: liveDetail });
    if (path.includes("destinations"))
      return route.fulfill({
        json: [{ id: "40000000-0000-4000-8000-000000000001", name: "Island" }],
      });
    return route.fulfill({ json: [] });
  });
}
