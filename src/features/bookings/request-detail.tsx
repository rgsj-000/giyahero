"use client";
import { useCallback, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BookingRecord,
  BookingStatus,
} from "../../modules/bookings/types";
import { getRequest, getRequestEvents, cancelRequest } from "./booking-service";
import { CatalogState, useData } from "../catalog/catalog-state";
import { formatPrice } from "../../modules/catalog/package";
export function statusLabel(status: BookingStatus) {
  return {
    pending: "Pending agency approval",
    accepted: "Confirmed",
    declined: "Declined",
    cancelled: "Cancelled",
  }[status];
}
export function RequestSummary({
  record: r,
  showContact = false,
}: {
  record: BookingRecord;
  showContact?: boolean;
}) {
  const s = r.snapshot;
  return (
    <>
      <h2>{s.title}</h2>
      <p>
        {s.agencyName} · <strong>{statusLabel(r.status)}</strong>
      </p>
      <p>
        {s.startsOn} to {s.endsOn} · {s.adults} adults, {s.children} children
      </p>
      <p>
        {s.rateLabel} ·{" "}
        <strong>{formatPrice(s.totalAmountMinor, s.currencyCode)}</strong>
      </p>
      <p>{s.paymentTerms}</p>
      {(s.agencyContactEmail || s.agencyContactPhone) && (
        <p>
          Agency contact: {s.agencyContactEmail} {s.agencyContactPhone}
        </p>
      )}
      {r.decisionReason && <p>{r.decisionReason}</p>}
      <h3>Original itinerary and terms</h3>
      {s.itinerary.map((d) => (
        <p key={d.dayNumber}>
          Day {d.dayNumber}: {d.title} — {d.description}
        </p>
      ))}
      <p>Included: {s.inclusions.join(", ")}</p>
      <p>Additional expenses: {s.exclusions.join(", ")}</p>
      {Object.values(s.policies).map((text, i) => (
        <p key={i}>{text}</p>
      ))}
      {showContact && (
        <>
          <h3>Traveler contact</h3>
          <p>{r.contactName}</p>
          <p>{r.contactEmail}</p>
          <p>{r.contactPhone}</p>
          <p>{r.notes}</p>
        </>
      )}
    </>
  );
}
export function RequestDetail({
  client,
  requestId,
}: {
  client: SupabaseClient;
  requestId: string;
}) {
  const row = useData(
    useCallback(() => getRequest(client, requestId), [client, requestId]),
  );
  const events = useData(
    useCallback(() => getRequestEvents(client, requestId), [client, requestId]),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function cancel() {
    if (busy || !window.confirm("Cancel this pending booking request?")) return;
    setBusy(true);
    setError("");
    try {
      await cancelRequest(client, requestId, "Cancelled by traveler");
      row.refresh();
      events.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancellation failed");
      row.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="gh-panel">
      <h1>Booking request</h1>
      <CatalogState
        loading={row.loading}
        error={row.error}
        onRetry={row.refresh}
      >
        {row.data && (
          <>
            <RequestSummary record={row.data} />
            {row.data.status === "pending" && (
              <button
                className="gh-action gh-secondary"
                disabled={busy}
                onClick={cancel}
              >
                Cancel pending request
              </button>
            )}
            {row.data.status === "accepted" && (
              <p>
                Contact the agency for changes or cancellation under the
                original terms.
              </p>
            )}
          </>
        )}
      </CatalogState>
      {error && <p role="alert">{error}</p>}
      <h3>Request history</h3>
      <CatalogState
        loading={events.loading}
        error={events.error}
        onRetry={events.refresh}
      >
        {events.data?.map((e) => (
          <p key={e.id}>
            {statusLabel(e.status)} · {new Date(e.createdAt).toLocaleString()}{" "}
            {e.reason}
          </p>
        ))}
      </CatalogState>
      <div className="gh-form-actions">
        <a className="gh-action gh-secondary" href="#trips">
          Back to My Trips
        </a>
      </div>
    </section>
  );
}
