"use client";
import { useCallback, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ShieldCheck, ArrowUpRight, MapPin } from "lucide-react";
import { formatPrice } from "../../modules/catalog/package";
import type { CatalogCard, CatalogFilters } from "../../modules/catalog/types";
import type { MarketplaceNavigation } from "./navigation";
import { listPublishedPackages } from "./catalog-service";
import { CatalogState, useData } from "./catalog-state";
import { CatalogPhoto } from "./catalog-photo";
export function CatalogList({
  client,
  navigation,
}: {
  client: SupabaseClient;
  navigation: MarketplaceNavigation;
}) {
  const [destinationId, setDestination] = useState("");
  const [budget, setBudget] = useState("");
  const [travelers, setTravelers] = useState("1");
  const [startsOn, setStart] = useState("");
  const [filters, setFilters] = useState<CatalogFilters>({ limit: 20 });
  const [extra, setExtra] = useState<CatalogCard[]>([]);
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState("");
  const catalog = useData(
    useCallback(
      () => listPublishedPackages(client, filters),
      [client, filters],
    ),
  );
  const destinations = useData(
    useCallback(async () => {
      const { data, error } = await client
        .from("destinations")
        .select("id,name")
        .eq("is_active", true)
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    }, [client]),
  );
  function search(event: FormEvent) {
    event.preventDefault();
    setExtra([]);
    setMoreError("");
    setFilters({
      limit: 20,
      ...(destinationId ? { destinationId } : {}),
      travelers: Number(travelers),
      ...(budget ? { maxBudgetMinor: Math.round(Number(budget) * 100) } : {}),
      ...(startsOn ? { startsOn } : {}),
    });
  }
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  async function more() {
    if (moreBusy) return;
    setMoreBusy(true);
    setMoreError("");
    try {
      const page = await listPublishedPackages(client, {
        ...filters,
        cursor: cursor ?? catalog.data?.nextCursor ?? undefined,
      });
      setExtra((items) => [...items, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      setMoreError(
        e instanceof Error ? e.message : "Could not load more packages.",
      );
    } finally {
      setMoreBusy(false);
    }
  }
  const items = [...(catalog.data?.items ?? []), ...extra];
  return (
    <>
      <section className="gh-live-hero">
        <p className="gh-eyebrow">LOCAL KNOWLEDGE. REAL JOURNEYS.</p>
        <h1>Find your next trip</h1>
        <p>Discover Quezon with verified travel agencies.</p>
      </section>
      <form
        className="gh-search-form"
        onSubmit={(event) => {
          setCursor(undefined);
          search(event);
        }}
      >
        <label>
          Destination
          <select
            value={destinationId}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value="">All destinations</option>
            {destinations.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Travelers
          <input
            type="number"
            min="1"
            max="32767"
            required
            value={travelers}
            onChange={(e) => setTravelers(e.target.value)}
          />
        </label>
        <label>
          Maximum total budget (PHP)
          <input
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Any budget"
          />
        </label>
        <label>
          Travel date
          <input
            type="date"
            value={startsOn}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <button className="gh-action gh-orange" type="submit">
          Find packages
        </button>
      </form>
      {destinations.error && (
        <p className="gh-muted">
          Destination options are unavailable. You can still browse all
          packages.
        </p>
      )}
      <div className="gh-section-title">
        <h2>Trips from verified agencies</h2>
        <span className="gh-muted">Made for your next getaway</span>
      </div>
      <CatalogState
        loading={catalog.loading}
        error={catalog.error}
        onRetry={catalog.refresh}
      >
        {items.length === 0 ? (
          <div className="gh-empty">
            <MapPin aria-hidden="true" />
            <h3>No packages match your trip.</h3>
            <p>Try another date or budget, or check back for new trips.</p>
          </div>
        ) : (
          <div className="gh-catalog-grid">
            {items.map((item) => (
              <article className="gh-trip-card" key={item.id}>
                <CatalogPhoto
                  client={client}
                  path={item.imagePath}
                  alt={item.title}
                />
                <div className="gh-trip-body">
                  <span className="gh-verified">
                    <ShieldCheck size={15} aria-hidden="true" />
                    Verified agency
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.agencyName}</p>
                  <p className="gh-muted">
                    {item.destinationNames.join(" · ")} · {item.durationDays}{" "}
                    days
                  </p>
                  <div className="gh-card-bottom">
                    <strong>
                      From{" "}
                      {formatPrice(item.fromAmountMinor, item.currencyCode)}
                    </strong>
                    <button
                      aria-label={"View " + item.title}
                      className="gh-icon-action"
                      onClick={() => navigation.openPackage(item.id)}
                    >
                      <ArrowUpRight aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {(cursor === undefined ? catalog.data?.nextCursor : cursor) && (
          <button
            className="gh-action gh-secondary"
            disabled={moreBusy}
            onClick={more}
          >
            {moreBusy ? "Loading…" : "More packages"}
          </button>
        )}
        {moreError && <p role="alert">{moreError}</p>}
      </CatalogState>
    </>
  );
}
