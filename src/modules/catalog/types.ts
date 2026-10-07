import type { PackagePublicationInput } from "./package";

export type CatalogFilters = {
  destinationId?: string;
  maxBudgetMinor?: number;
  travelers?: number;
  startsOn?: string;
  cursor?: string;
  limit?: number;
};
export type CatalogCard = {
  id: string;
  agencyId: string;
  agencyName: string;
  slug: string;
  title: string;
  durationDays: number;
  currencyCode: string;
  fromAmountMinor: number;
  imagePath: string | null;
  destinationNames: string[];
};
export type CatalogRate = {
  id: string;
  label: string;
  amountMinor: number;
  minTravelers: number;
  maxTravelers: number | null;
};
export type CatalogDeparture = {
  id: string;
  startsAt: string;
  endsAt: string;
  bookingCutoffAt: string;
  capacity: number;
  remainingCapacity: number;
};
export type CatalogDetail = CatalogCard & {
  version: number;
  overview: string;
  agencyDescription: string | null;
  agencyContactEmail: string | null;
  agencyContactPhone: string | null;
  pricingModel: "per_person" | "per_group" | "tiered" | "variant";
  scheduleModel: "fixed_departures" | "open_dates";
  minTravelers: number;
  maxTravelers: number;
  openDateWindow: { startsOn: string; endsOn: string } | null;
  rates: CatalogRate[];
  departures: CatalogDeparture[];
  itinerary: { dayNumber: number; title: string; description: string }[];
  inclusions: string[];
  exclusions: string[];
  media: { id: string; storagePath: string; altText: string }[];
  policies: PackagePublicationInput["policies"];
};
export type PackageDraftInput = Omit<
  PackagePublicationInput,
  "prices" | "departures"
> & {
  slug: string;
  prices: (PackagePublicationInput["prices"][number] & { id?: string })[];
  departures: (PackagePublicationInput["departures"][number] & {
    id?: string;
  })[];
};
