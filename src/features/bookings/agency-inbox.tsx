"use client";
import { useCallback, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingStatus } from "../../modules/bookings/types";
import { listAgencyRequests } from "./booking-service";
import { CatalogState, useData } from "../catalog/catalog-state";
import { statusLabel } from "./request-detail";
import { formatPrice } from "../../modules/catalog/package";
export function AgencyInbox({
  client,
  agencyId,
  onOpenRequest,
}: {
  client: SupabaseClient;
  agencyId: string;
  onOpenRequest: (id: string) => void;
}) {
  const [status, setStatus] = useState<BookingStatus | "">("pending");
  const rows = useData(
    useCallback(
      () => listAgencyRequests(client, agencyId, status || undefined),
      [client, agencyId, status],
    ),
  );
  return (
    <>
      <h1>Booking requests</h1>
      <div className="gh-form-actions">
        <label>
          Request status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BookingStatus | "")}
          >
            <option value="">All requests</option>
            {(["pending", "accepted", "declined", "cancelled"] as const).map(
              (s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ),
            )}
          </select>
        </label>
        <button className="gh-action gh-secondary" onClick={rows.refresh}>
          Refresh inbox
        </button>
      </div>
      <CatalogState
        loading={rows.loading}
        error={rows.error}
        onRetry={rows.refresh}
      >
        {rows.data?.length ? (
          rows.data.map((r) => (
            <button
              key={r.id}
              className="gh-panel gh-request-row"
              onClick={() => onOpenRequest(r.id)}
            >
              <strong>{r.snapshot.title}</strong>
              <span>
                {statusLabel(r.status)} · {r.contactName}
              </span>
              <span>
                {r.snapshot.startsOn} ·{" "}
                {r.snapshot.adults + r.snapshot.children} travelers ·{" "}
                {formatPrice(
                  r.snapshot.totalAmountMinor,
                  r.snapshot.currencyCode,
                )}
              </span>
            </button>
          ))
        ) : (
          <div className="gh-empty">
            <p>No requests match this filter.</p>
          </div>
        )}
      </CatalogState>
    </>
  );
}
