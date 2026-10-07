"use client";
import { useCallback, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPackageDraft, reviewPackage } from "./catalog-management-service";
import { useData, CatalogState } from "./catalog-state";
import { formatPrice } from "../../modules/catalog/package";
import { CatalogPhoto } from "./catalog-photo";
export function PublicationReview({ client }: { client: SupabaseClient }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const queue = useData(
    useCallback(async () => {
      const { data, error } = await client
        .from("packages")
        .select("id,title,version")
        .eq("publication_status", "pending_first_review")
        .order("updated_at");
      if (error) throw new Error(error.message);
      return data ?? [];
    }, [client]),
  );
  const detail = useData(
    useCallback(
      () =>
        selected ? getPackageDraft(client, selected) : Promise.resolve(null),
      [client, selected],
    ),
  );
  async function decide(approve: boolean) {
    if (!selected || !detail.data || busy) return;
    setBusy(true);
    setError("");
    try {
      if (
        !window.confirm(
          approve
            ? "Approve and publish this package?"
            : "Request changes to this package?",
        )
      )
        return;
      await reviewPackage(client, selected, detail.data.version, approve, note);
      setSelected(null);
      setNote("");
      queue.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
      detail.refresh();
    } finally {
      setBusy(false);
    }
  }
  const p = detail.data?.input;
  const preview = useData(
    useCallback(async () => {
      if (!selected) return { destinations: [], media: [] };
      const [places, photos] = await Promise.all([
        client.from("destinations").select("id,name"),
        client
          .from("package_media")
          .select("id,storage_path,alt_text")
          .eq("package_id", selected),
      ]);
      if (places.error || photos.error)
        throw new Error(places.error?.message ?? photos.error?.message);
      return { destinations: places.data ?? [], media: photos.data ?? [] };
    }, [client, selected]),
  );
  return (
    <>
      <h1>First publication reviews</h1>
      <CatalogState
        loading={queue.loading}
        error={queue.error}
        onRetry={queue.refresh}
      >
        {queue.data?.length ? (
          queue.data.map((row) => (
            <button
              className="gh-action gh-secondary gh-wide"
              key={row.id}
              onClick={() => {
                setSelected(row.id);
                setError("");
              }}
            >
              {row.title}
            </button>
          ))
        ) : (
          <p>No packages are awaiting review.</p>
        )}
      </CatalogState>
      {selected && (
        <CatalogState
          loading={detail.loading}
          error={detail.error}
          onRetry={detail.refresh}
        >
          {p && (
            <section className="gh-panel">
              <h2>{p.title}</h2>
              <p>{p.overview}</p>
              <CatalogState
                loading={preview.loading}
                error={preview.error}
                onRetry={preview.refresh}
              >
                <p>
                  {preview.data?.destinations
                    .filter((d) => p.destinationIds.includes(d.id))
                    .map((d) => d.name)
                    .join(", ")}
                </p>
                {preview.data?.media.map((m) => (
                  <CatalogPhoto
                    key={m.id}
                    client={client}
                    path={m.storage_path}
                    alt={m.alt_text}
                  />
                ))}
              </CatalogState>
              <p>
                {p.durationDays} days · {p.minTravelers}–{p.maxTravelers}{" "}
                travelers · {p.scheduleModel.replaceAll("_", " ")}
              </p>
              <h3>Itinerary</h3>
              {p.itinerary.map((d) => (
                <p key={d.dayNumber}>
                  Day {d.dayNumber}: {d.title} — {d.description}
                </p>
              ))}
              <h3>Pricing</h3>
              {p.prices.map((r, i) => (
                <p key={r.id ?? i}>
                  {r.label}: {formatPrice(r.amountMinor, p.currencyCode)} ·{" "}
                  {r.minTravelers}–{r.maxTravelers ?? "unlimited"} travelers
                </p>
              ))}
              <h3>Included</h3>
              <p>{p.inclusions.join(", ")}</p>
              <h3>Additional expenses</h3>
              <p>{p.exclusions.join(", ")}</p>
              <h3>Dates</h3>
              {p.openDateWindow ? (
                <p>
                  {p.openDateWindow.startsOn} to {p.openDateWindow.endsOn}
                </p>
              ) : (
                p.departures.map((d, i) => (
                  <p key={d.id ?? i}>
                    {d.startsAt} to {d.endsAt} · {d.capacity} seats · cutoff{" "}
                    {d.bookingCutoffAt}
                  </p>
                ))
              )}
              <h3>Policies</h3>
              {Object.values(p.policies).map((text, i) => (
                <p key={i}>{text}</p>
              ))}
              <label>
                Review notes
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={4000}
                />
              </label>
              <div className="gh-form-actions">
                <button
                  className="gh-action"
                  disabled={busy}
                  onClick={() => decide(true)}
                >
                  Approve and publish
                </button>
                <button
                  className="gh-action gh-secondary"
                  disabled={busy || !note.trim()}
                  onClick={() => decide(false)}
                >
                  Request changes
                </button>
              </div>
              {error && <p role="alert">{error}</p>}
            </section>
          )}
        </CatalogState>
      )}
    </>
  );
}
