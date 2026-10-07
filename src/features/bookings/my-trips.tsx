"use client";
import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listMyRequests } from "./booking-service";
import { CatalogState, useData } from "../catalog/catalog-state";
import { statusLabel } from "./request-detail";
import { formatPrice } from "../../modules/catalog/package";
export function MyTrips({
  client,
  onOpenRequest,
}: {
  client: SupabaseClient;
  onOpenRequest: (id: string) => void;
}) {
  const rows = useData(useCallback(() => listMyRequests(client), [client]));
  return (
    <>
      <div className="gh-section-title">
        <h1>My Trips</h1>
        <button className="gh-action gh-secondary" onClick={rows.refresh}>
          Refresh requests
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
              className="gh-panel gh-request-row"
              key={r.id}
              onClick={() => onOpenRequest(r.id)}
            >
              <strong>{r.snapshot.title}</strong>
              <span>{statusLabel(r.status)}</span>
              <span>
                {r.snapshot.startsOn} ·{" "}
                {formatPrice(
                  r.snapshot.totalAmountMinor,
                  r.snapshot.currencyCode,
                )}
              </span>
            </button>
          ))
        ) : (
          <div className="gh-empty">
            <h2>No booking requests yet</h2>
            <p>
              Explore packages to request a trip. Your agency will review it
              before confirming.
            </p>
            <a className="gh-action" href="#browse">
              Explore packages
            </a>
          </div>
        )}
      </CatalogState>
    </>
  );
}
