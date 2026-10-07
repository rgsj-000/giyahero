"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogDetail } from "../../modules/catalog/types";
import type { BookingInput, BookingRecord } from "../../modules/bookings/types";
import { quotePackage } from "../../modules/catalog/pricing";
import { formatPrice } from "../../modules/catalog/package";
import { submitBookingRequest } from "./booking-service";
import {
  readSelection,
  saveSelection,
  clearSelection,
  newSelection,
} from "./request-draft";
import type { MarketplaceNavigation } from "../catalog/navigation";
export function RequestForm({
  client,
  detail,
  navigation,
  onSubmitted,
}: {
  client: SupabaseClient;
  detail: CatalogDetail;
  navigation: MarketplaceNavigation;
  onSubmitted: (record: BookingRecord) => void;
}) {
  const [selection, setSelection] = useState(() => readSelection(detail.id));
  const [contact, setContact] = useState({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState<BookingInput | null>(null);
  useEffect(() => saveSelection(detail.id, selection), [detail.id, selection]);
  let total: number | null = null,
    quoteError = "";
  try {
    total = quotePackage(
      detail,
      selection.rateId,
      selection.adults,
      selection.children,
    );
  } catch (e) {
    quoteError = e instanceof Error ? e.message : "Choose a price option.";
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError) throw new Error(authError.message);
      if (!user) {
        navigation.requireLogin("/#book/" + detail.id);
        return;
      }
      const input: BookingInput = attempt ?? {
        ...contact,
        ...selection,
        packageId: detail.id,
        expectedVersion: detail.version,
        departureId:
          detail.scheduleModel === "fixed_departures"
            ? selection.departureId || null
            : null,
        startsOn:
          detail.scheduleModel === "open_dates"
            ? selection.startsOn || null
            : null,
        endsOn:
          detail.scheduleModel === "open_dates"
            ? selection.endsOn || null
            : null,
      };
      setAttempt(input);
      const record = await submitBookingRequest(client, input);
      clearSelection(detail.id);
      onSubmitted(record);
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Request failed") +
          ". Retry with the same details, or check My Trips before starting a new request.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="gh-panel">
      <h1>Request booking</h1>
      <h2>{detail.title}</h2>
      <p>
        The agency must approve your request. Pending requests reserve no seats.
        Payment is arranged directly with the agency.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={busy || !!attempt}>
          <div className="gh-form-grid">
            <label>
              Price option
              <select
                required
                value={selection.rateId}
                onChange={(e) =>
                  setSelection({ ...selection, rateId: e.target.value })
                }
              >
                <option value="">Choose a price option</option>
                {detail.rates.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.label} ·{" "}
                    {formatPrice(r.amountMinor, detail.currencyCode)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Adults
              <input
                required
                type="number"
                min="1"
                max={detail.maxTravelers}
                value={selection.adults}
                onChange={(e) =>
                  setSelection({ ...selection, adults: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Children
              <input
                required
                type="number"
                min="0"
                max={detail.maxTravelers}
                value={selection.children}
                onChange={(e) =>
                  setSelection({
                    ...selection,
                    children: Number(e.target.value),
                  })
                }
              />
            </label>
            {detail.scheduleModel === "fixed_departures" ? (
              <label>
                Departure
                <select
                  required
                  value={selection.departureId}
                  onChange={(e) =>
                    setSelection({ ...selection, departureId: e.target.value })
                  }
                >
                  <option value="">Choose a departure</option>
                  {detail.departures
                    .filter((d) => new Date(d.bookingCutoffAt) > new Date())
                    .map((d) => (
                      <option value={d.id} key={d.id}>
                        {new Date(d.startsAt).toLocaleString("en-PH", {
                          timeZone: "Asia/Manila",
                        })}{" "}
                        · {d.remainingCapacity} seats currently available
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <>
                <label>
                  Travel start
                  <input
                    type="date"
                    required
                    min={detail.openDateWindow?.startsOn}
                    max={detail.openDateWindow?.endsOn}
                    value={selection.startsOn}
                    onChange={(e) =>
                      setSelection({ ...selection, startsOn: e.target.value })
                    }
                  />
                </label>
                <label>
                  Travel end
                  <input
                    type="date"
                    required
                    min={selection.startsOn || detail.openDateWindow?.startsOn}
                    max={detail.openDateWindow?.endsOn}
                    value={selection.endsOn}
                    onChange={(e) =>
                      setSelection({ ...selection, endsOn: e.target.value })
                    }
                  />
                </label>
              </>
            )}
            <label>
              Contact name
              <input
                required
                autoComplete="name"
                maxLength={120}
                value={contact.contactName}
                onChange={(e) =>
                  setContact({ ...contact, contactName: e.target.value })
                }
              />
            </label>
            <label>
              Contact email
              <input
                required
                type="email"
                autoComplete="email"
                maxLength={254}
                value={contact.contactEmail}
                onChange={(e) =>
                  setContact({ ...contact, contactEmail: e.target.value })
                }
              />
            </label>
            <label>
              Contact phone
              <input
                required
                type="tel"
                autoComplete="tel"
                minLength={7}
                maxLength={40}
                value={contact.contactPhone}
                onChange={(e) =>
                  setContact({ ...contact, contactPhone: e.target.value })
                }
              />
            </label>
            <label className="gh-full">
              Notes for the agency
              <textarea
                maxLength={2000}
                value={contact.notes}
                onChange={(e) =>
                  setContact({ ...contact, notes: e.target.value })
                }
              />
            </label>
          </div>
        </fieldset>
        <p>
          Quoted total{" "}
          <strong>
            {total === null
              ? "Choose eligible travelers and a price option"
              : formatPrice(total, detail.currencyCode)}
          </strong>
        </p>
        {quoteError && <p>{quoteError}</p>}
        <h3>Terms of this request</h3>
        <p>{detail.policies.cancellationTerms}</p>
        <p>{detail.policies.reschedulingTerms}</p>
        <p>{detail.policies.noShowTerms}</p>
        <p>{detail.policies.agencyCancellationTerms}</p>
        {error && <p role="alert">{error}</p>}
        <div className="gh-form-actions">
          <button
            className="gh-action gh-orange"
            disabled={busy || total === null}
            type="submit"
          >
            {busy
              ? "Sending…"
              : attempt
                ? "Retry request"
                : "Send booking request"}
          </button>
          <button
            className="gh-action gh-secondary"
            type="button"
            onClick={navigation.openTrips}
          >
            Check My Trips
          </button>
          {attempt && (
            <button
              className="gh-action gh-secondary"
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Check My Trips first. Starting a new request may create another booking if your previous request was saved. Continue?",
                  )
                ) {
                  setAttempt(null);
                  setError("");
                  setSelection({
                    ...selection,
                    submissionKey: newSelection().submissionKey,
                  });
                }
              }}
            >
              Start a new request
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
