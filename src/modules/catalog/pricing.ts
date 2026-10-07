import type { CatalogDetail } from "./types";

export function quotePackage(
  detail: CatalogDetail,
  rateId: string,
  adults: number,
  children: number,
): number {
  if (
    !Number.isSafeInteger(adults) ||
    adults < 1 ||
    !Number.isSafeInteger(children) ||
    children < 0
  )
    throw new RangeError("Choose valid traveler counts.");
  const travelers = adults + children;
  if (
    !Number.isSafeInteger(travelers) ||
    travelers < detail.minTravelers ||
    travelers > detail.maxTravelers
  )
    throw new RangeError("Group size is outside this package's limits.");
  const rate = detail.rates.find((item) => item.id === rateId);
  if (
    !rate ||
    travelers < rate.minTravelers ||
    (rate.maxTravelers !== null && travelers > rate.maxTravelers)
  )
    throw new RangeError("Choose an eligible price option.");
  const total =
    rate.amountMinor * (detail.pricingModel === "per_group" ? 1 : travelers);
  if (
    !Number.isSafeInteger(rate.amountMinor) ||
    rate.amountMinor <= 0 ||
    !Number.isSafeInteger(total)
  )
    throw new RangeError("Quotation exceeds the supported amount.");
  return total;
}
