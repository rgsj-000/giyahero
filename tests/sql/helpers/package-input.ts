import { destinationId } from "./database";
export const validInput = {
  slug: "published-island",
  title: "Published Island Trip",
  overview:
    "A complete island itinerary with comfortable transfers and a local guide.",
  tripType: "island",
  durationDays: 2,
  minTravelers: 1,
  maxTravelers: 8,
  currencyCode: "PHP",
  pricingModel: "per_person",
  scheduleModel: "fixed_departures",
  openDateWindow: null,
  destinationIds: [destinationId],
  itinerary: [
    { dayNumber: 1, title: "Arrival", description: "Meet the guide" },
    { dayNumber: 2, title: "Return", description: "Return home" },
  ],
  inclusions: ["Local guide"],
  exclusions: ["Personal expenses"],
  prices: [
    {
      label: "Standard",
      minTravelers: 1,
      maxTravelers: null,
      amountMinor: 125050,
    },
  ],
  policies: {
    cancellationTerms: "Contact the agency to cancel",
    reschedulingTerms: "Contact the agency to reschedule",
    noShowTerms: "No refunds for a missed departure",
    agencyCancellationTerms: "Agency will arrange a full refund",
  },
  departures: [
    {
      startsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      endsAt: new Date(Date.now() + 31 * 86400000).toISOString(),
      bookingCutoffAt: new Date(Date.now() + 29 * 86400000).toISOString(),
      capacity: 3,
    },
  ],
};
