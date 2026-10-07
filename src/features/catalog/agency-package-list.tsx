"use client";
import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listAgencyPackages } from "./catalog-management-service";
import { useData, CatalogState } from "./catalog-state";
export function AgencyPackageList({
  client,
  agencyId,
  onOpen,
}: {
  client: SupabaseClient;
  agencyId: string;
  onOpen: (id: string | null) => void;
}) {
  const state = useData(
    useCallback(() => listAgencyPackages(client, agencyId), [client, agencyId]),
  );
  return (
    <>
      <div className="gh-section-title">
        <h1>Agency packages</h1>
        <button className="gh-action gh-orange" onClick={() => onOpen(null)}>
          Create package
        </button>
      </div>
      <CatalogState
        loading={state.loading}
        error={state.error}
        onRetry={state.refresh}
      >
        {state.data?.length ? (
          state.data.map((p) => (
            <article className="gh-panel" key={p.id}>
              <h2>{p.title}</h2>
              <p className="gh-status">{p.status.replaceAll("_", " ")}</p>
              <button
                className="gh-action gh-secondary"
                onClick={() => onOpen(p.id)}
              >
                Edit {p.title}
              </button>
            </article>
          ))
        ) : (
          <div className="gh-empty">
            <h2>Create your first package</h2>
            <p>Add your itinerary, rates, dates, and booking terms.</p>
          </div>
        )}
      </CatalogState>
    </>
  );
}
