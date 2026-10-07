"use client";
import { useCallback, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getRequest,
  getRequestEvents,
  decideRequest,
  cancelRequest,
} from "./booking-service";
import { CatalogState, useData } from "../catalog/catalog-state";
import { RequestSummary, statusLabel } from "./request-detail";
export function AgencyRequestDetail({
  client,
  agencyId,
  requestId,
  onChanged,
}: {
  client: SupabaseClient;
  agencyId: string;
  requestId: string;
  onChanged: () => void;
}) {
  const record = useData(
    useCallback(async () => {
      const row = await getRequest(client, requestId);
      if (row.agencyId !== agencyId)
        throw new Error("Request does not belong to this agency.");
      return row;
    }, [client, agencyId, requestId]),
  );
  const events = useData(
    useCallback(() => getRequestEvents(client, requestId), [client, requestId]),
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(status: "accepted" | "declined" | "cancelled") {
    if (
      busy ||
      !window.confirm(
        status === "accepted"
          ? "Confirm this request at its original quoted price and terms? Payment remains arranged by the agency."
          : status === "declined"
            ? "Decline this request and share the explanation with the traveler?"
            : "Cancel this confirmed trip and share the explanation with the traveler?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      if (status === "cancelled")
        await cancelRequest(client, requestId, reason);
      else await decideRequest(client, requestId, status, reason);
      setReason("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed");
    } finally {
      record.refresh();
      events.refresh();
      setBusy(false);
    }
  }
  return (
    <section className="gh-panel">
      <h1>Agency booking request</h1>
      <CatalogState
        loading={record.loading}
        error={record.error}
        onRetry={record.refresh}
      >
        {record.data && (
          <>
            <RequestSummary record={record.data} showContact />
            {["pending", "accepted"].includes(record.data.status) && (
              <>
                <label>
                  Decision explanation
                  <textarea
                    maxLength={2000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <p>Declining or cancelling requires an explanation.</p>
                <div className="gh-form-actions">
                  {record.data.status === "pending" ? (
                    <>
                      <button
                        className="gh-action gh-orange"
                        disabled={busy}
                        onClick={() => decide("accepted")}
                      >
                        Accept request
                      </button>
                      <button
                        className="gh-action gh-secondary"
                        disabled={busy || !reason.trim()}
                        onClick={() => decide("declined")}
                      >
                        Decline request
                      </button>
                    </>
                  ) : (
                    <button
                      className="gh-action gh-secondary"
                      disabled={busy || !reason.trim()}
                      onClick={() => decide("cancelled")}
                    >
                      Cancel confirmed request
                    </button>
                  )}
                </div>
              </>
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
      <a
        className="gh-action gh-secondary"
        href={"#agency/" + agencyId + "/requests"}
      >
        Back to inbox
      </a>
    </section>
  );
}
