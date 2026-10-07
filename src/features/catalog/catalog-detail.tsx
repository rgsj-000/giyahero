"use client";
import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { CatalogDetail } from "../../modules/catalog/types";
import { formatPrice } from "../../modules/catalog/package";
import type { MarketplaceNavigation } from "./navigation";
import { getPackageDetail } from "./catalog-service";
import { useData, CatalogState } from "./catalog-state";
import { CatalogPhoto } from "./catalog-photo";
export function CatalogDetailScreen({
  client,
  packageId,
  onRequest,
}: {
  client: SupabaseClient;
  packageId: string;
  navigation: MarketplaceNavigation;
  onRequest: (detail: CatalogDetail) => void;
}) {
  const state = useData(
    useCallback(() => getPackageDetail(client, packageId), [client, packageId]),
  );
  const detail = state.data;
  return (
    <>
      <button
        className="gh-action gh-secondary"
        onClick={() => window.history.back()}
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Back to trips
      </button>
      <CatalogState
        loading={state.loading}
        error={state.error}
        onRetry={state.refresh}
      >
        {detail ? (
          <>
            <CatalogPhoto
              client={client}
              path={detail.imagePath}
              alt={detail.title}
            />
            <span className="gh-verified">
              <ShieldCheck size={16} aria-hidden="true" />
              Verified agency
            </span>
            <h1>{detail.title}</h1>
            <p className="gh-muted">
              {detail.destinationNames.join(" · ")} · {detail.durationDays} days
            </p>
            <p>{detail.overview}</p>
            <section className="gh-panel">
              <h2>{detail.agencyName}</h2>
              <p>{detail.agencyDescription}</p>
              {detail.agencyContactEmail && (
                <a href={"mailto:" + detail.agencyContactEmail}>
                  {detail.agencyContactEmail}
                </a>
              )}
            </section>
            <section className="gh-panel">
              <h2>Price options</h2>
              {detail.rates.map((rate) => (
                <p key={rate.id}>
                  <strong>
                    {rate.label}:{" "}
                    {formatPrice(rate.amountMinor, detail.currencyCode)}
                  </strong>{" "}
                  {detail.pricingModel === "per_group"
                    ? "per group"
                    : "per traveler"}{" "}
                  · {rate.minTravelers}
                  {rate.maxTravelers ? "–" + rate.maxTravelers : "+"} travelers
                </p>
              ))}
              <p>
                Adults and children use the selected catalog rate. Your final
                request total is shown before submission.
              </p>
            </section>
            <section className="gh-panel">
              <h2>Itinerary</h2>
              {detail.itinerary.map((day) => (
                <div key={day.dayNumber}>
                  <h3>
                    Day {day.dayNumber} · {day.title}
                  </h3>
                  <p>{day.description}</p>
                </div>
              ))}
            </section>
            <section className="gh-panel">
              <h2>Included</h2>
              <ul>
                {detail.inclusions.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
              <h3>Additional expenses</h3>
              <ul>
                {detail.exclusions.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </section>
            <section className="gh-panel">
              <h2>Dates and availability</h2>
              {detail.scheduleModel === "open_dates" ? (
                <p>
                  {detail.openDateWindow?.startsOn} to{" "}
                  {detail.openDateWindow?.endsOn}. The agency will review your
                  selected dates.
                </p>
              ) : (
                detail.departures.map((d) => (
                  <p key={d.id}>
                    {new Date(d.startsAt).toLocaleDateString("en-PH", {
                      timeZone: "Asia/Manila",
                    })}{" "}
                    · {d.remainingCapacity} seats available
                  </p>
                ))
              )}
            </section>
            <section className="gh-panel">
              <h2>Booking policies</h2>
              <h3>Cancellation</h3>
              <p>{detail.policies.cancellationTerms}</p>
              <h3>Rescheduling</h3>
              <p>{detail.policies.reschedulingTerms}</p>
              <h3>Missed departure</h3>
              <p>{detail.policies.noShowTerms}</p>
              <h3>Agency cancellation</h3>
              <p>{detail.policies.agencyCancellationTerms}</p>
            </section>
            <button
              className="gh-action gh-orange gh-wide"
              onClick={() => onRequest(detail)}
            >
              Request booking
            </button>
            <p className="gh-muted">
              The agency reviews each request before confirming your trip.
            </p>
          </>
        ) : (
          <div className="gh-empty">
            <h2>This package is unavailable.</h2>
            <button
              className="gh-action"
              onClick={() => {
                window.location.hash = "browse";
              }}
            >
              Browse other trips
            </button>
          </div>
        )}
      </CatalogState>
    </>
  );
}
