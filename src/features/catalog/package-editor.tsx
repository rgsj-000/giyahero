"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PackageDraftInput } from "../../modules/catalog/types";
import { packagePublicationInputSchema } from "../../modules/catalog/package";
import {
  currencyScale,
  manilaDateTimeInput,
  manilaInputToIso,
} from "../../modules/catalog/editor-values";
import {
  savePackageDraft,
  getPackageDraft,
  submitPackageReview,
  setPackagePublication,
} from "./catalog-management-service";
import { uploadPackageImage, removePackageImage } from "./catalog-media";
import { CatalogState, useData } from "./catalog-state";
const emptyDraft: PackageDraftInput = {
  slug: "",
  title: "",
  overview: "",
  tripType: "tour",
  durationDays: 1,
  minTravelers: 1,
  maxTravelers: 8,
  currencyCode: "PHP",
  pricingModel: "per_person",
  scheduleModel: "open_dates",
  openDateWindow: null,
  destinationIds: [],
  itinerary: [],
  inclusions: [],
  exclusions: [],
  prices: [],
  policies: {
    cancellationTerms: "",
    reschedulingTerms: "",
    noShowTerms: "",
    agencyCancellationTerms: "",
  },
  departures: [],
};
export function PackageEditor({
  client,
  agencyId,
  packageId,
  onSaved,
}: {
  client: SupabaseClient;
  agencyId: string;
  packageId: string | null;
  onSaved: (id: string) => void;
}) {
  const [draft, setDraft] = useState<PackageDraftInput>(emptyDraft);
  const [savedId, setSavedId] = useState(packageId);
  const [version, setVersion] = useState<number | null>(null);
  const [status, setStatus] = useState("draft");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [alt, setAlt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const loaded = useData(
    useCallback(
      () =>
        packageId ? getPackageDraft(client, packageId) : Promise.resolve(null),
      [client, packageId],
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
  const media = useData(
    useCallback(async () => {
      if (!savedId) return [];
      const { data, error } = await client
        .from("package_media")
        .select("id,alt_text")
        .eq("package_id", savedId);
      if (error) throw new Error(error.message);
      return data ?? [];
    }, [client, savedId]),
  );
  useEffect(() => {
    if (loaded.data) {
      setDraft(loaded.data.input);
      setSavedId(packageId);
      setVersion(loaded.data.version);
      setStatus(loaded.data.status);
      setReviewed(!!loaded.data.firstReviewedAt);
    }
  }, [loaded.data, packageId]);
  const editable = !["pending_first_review", "archived", "suspended"].includes(
    status,
  );
  function field<K extends keyof PackageDraftInput>(
    key: K,
    value: PackageDraftInput[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
    setNotice("");
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reload(id: string) {
    const current = await getPackageDraft(client, id);
    setDraft(current.input);
    setVersion(current.version);
    setStatus(current.status);
    setReviewed(!!current.firstReviewedAt);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const id = await savePackageDraft(
        client,
        agencyId,
        savedId,
        version,
        draft,
      );
      setSavedId(id);
      await reload(id);
      setNotice("Draft saved");
      onSaved(id);
    });
  }
  async function publish() {
    if (!savedId || version === null) return;
    await run(async () => {
      const normalized = {
        ...draft,
        departures: draft.departures.map((d) => ({
          ...d,
          startsAt: new Date(d.startsAt).toISOString(),
          endsAt: new Date(d.endsAt).toISOString(),
          bookingCutoffAt: new Date(d.bookingCutoffAt).toISOString(),
        })),
      };
      const valid = packagePublicationInputSchema.safeParse(normalized);
      if (!valid.success)
        throw new Error(
          valid.error.issues
            .map((i) => i.path.join(".") + ": " + i.message)
            .join("; "),
        );
      await savePackageDraft(client, agencyId, savedId, version, normalized);
      const current = await getPackageDraft(client, savedId);
      if (reviewed)
        await setPackagePublication(
          client,
          savedId,
          current.version,
          "published",
        );
      else await submitPackageReview(client, savedId, current.version);
      await reload(savedId);
      setNotice(
        reviewed ? "Package published" : "Awaiting first publication review",
      );
    });
  }
  return (
    <CatalogState
      loading={loaded.loading}
      error={loaded.error}
      onRetry={loaded.refresh}
    >
      <h1>{savedId ? "Edit package" : "Create package"}</h1>
      <p className="gh-status">{status.replaceAll("_", " ")}</p>
      <form onSubmit={save}>
        <fieldset disabled={busy || !editable} className="gh-editor-fieldset">
          <section className="gh-panel gh-form-grid">
            <label>
              Package title
              <input
                required
                minLength={5}
                maxLength={180}
                value={draft.title}
                onChange={(e) => field("title", e.target.value)}
              />
            </label>
            <label>
              Package address
              <input
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={draft.slug}
                onChange={(e) => field("slug", e.target.value)}
                placeholder="quezon-island-trip"
              />
            </label>
            <label className="gh-full">
              Overview
              <textarea
                maxLength={8000}
                value={draft.overview}
                onChange={(e) => field("overview", e.target.value)}
              />
            </label>
            <label>
              Trip type
              <input
                required
                value={draft.tripType}
                onChange={(e) => field("tripType", e.target.value)}
              />
            </label>
            <label>
              Duration in days
              <input
                required
                type="number"
                min={1}
                max={90}
                value={draft.durationDays}
                onChange={(e) => field("durationDays", Number(e.target.value))}
              />
            </label>
            <label>
              Minimum travelers
              <input
                required
                type="number"
                min={1}
                value={draft.minTravelers}
                onChange={(e) => field("minTravelers", Number(e.target.value))}
              />
            </label>
            <label>
              Maximum travelers
              <input
                required
                type="number"
                min={draft.minTravelers}
                value={draft.maxTravelers}
                onChange={(e) => field("maxTravelers", Number(e.target.value))}
              />
            </label>
            <label>
              Currency
              <input
                required
                pattern="[A-Z]{3}"
                maxLength={3}
                value={draft.currencyCode}
                onChange={(e) =>
                  field("currencyCode", e.target.value.toUpperCase())
                }
              />
            </label>
            <label>
              Pricing model
              <select
                value={draft.pricingModel}
                onChange={(e) =>
                  field(
                    "pricingModel",
                    e.target.value as PackageDraftInput["pricingModel"],
                  )
                }
              >
                <option value="per_person">Per traveler</option>
                <option value="per_group">Per group</option>
                <option value="tiered">Group-size tiers (per traveler)</option>
                <option value="variant">Labeled options (per traveler)</option>
              </select>
            </label>
          </section>
          <section className="gh-panel">
            <h2>Destinations</h2>
            {destinations.error && <p role="alert">{destinations.error}</p>}
            <div className="gh-check-grid">
              {destinations.data?.map((d) => (
                <label className="gh-check" key={d.id}>
                  <input
                    type="checkbox"
                    checked={draft.destinationIds.includes(d.id)}
                    onChange={(e) =>
                      field(
                        "destinationIds",
                        e.target.checked
                          ? [...draft.destinationIds, d.id]
                          : draft.destinationIds.filter((id) => id !== d.id),
                      )
                    }
                  />
                  {d.name}
                </label>
              ))}
            </div>
          </section>
          <section className="gh-panel">
            <h2>Itinerary</h2>
            {draft.itinerary.map((day, i) => (
              <div className="gh-editor-row" key={i}>
                <label>
                  {"Day " + day.dayNumber + " title"}
                  <input
                    value={day.title}
                    onChange={(e) =>
                      field(
                        "itinerary",
                        draft.itinerary.map((d, j) =>
                          j === i ? { ...d, title: e.target.value } : d,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  {"Day " + day.dayNumber + " description"}
                  <textarea
                    value={day.description}
                    onChange={(e) =>
                      field(
                        "itinerary",
                        draft.itinerary.map((d, j) =>
                          j === i ? { ...d, description: e.target.value } : d,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="gh-action gh-secondary"
                  onClick={() =>
                    field(
                      "itinerary",
                      draft.itinerary
                        .filter((_, j) => j !== i)
                        .map((d, j) => ({ ...d, dayNumber: j + 1 })),
                    )
                  }
                >
                  Remove day {day.dayNumber}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="gh-action gh-secondary"
              onClick={() =>
                field("itinerary", [
                  ...draft.itinerary,
                  {
                    dayNumber: draft.itinerary.length + 1,
                    title: "",
                    description: "",
                  },
                ])
              }
            >
              Add itinerary day
            </button>
          </section>
          <section className="gh-panel gh-form-grid">
            <label>
              Included (one per line)
              <textarea
                value={draft.inclusions.join("\n")}
                onChange={(e) =>
                  field("inclusions", e.target.value.split("\n"))
                }
              />
            </label>
            <label>
              Additional expenses (one per line)
              <textarea
                value={draft.exclusions.join("\n")}
                onChange={(e) =>
                  field("exclusions", e.target.value.split("\n"))
                }
              />
            </label>
          </section>
          <section className="gh-panel">
            <h2>Price options</h2>
            {draft.prices.map((rate, i) => (
              <div className="gh-editor-row gh-form-grid" key={rate.id ?? i}>
                <label>
                  {"Price option " + (i + 1) + " label"}
                  <input
                    value={rate.label}
                    onChange={(e) =>
                      field(
                        "prices",
                        draft.prices.map((r, j) =>
                          j === i ? { ...r, label: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  {"Price option " + (i + 1) + " amount"}
                  <input
                    type="number"
                    min=".01"
                    step=".01"
                    value={
                      rate.amountMinor / currencyScale(draft.currencyCode) || ""
                    }
                    onChange={(e) =>
                      field(
                        "prices",
                        draft.prices.map((r, j) =>
                          j === i
                            ? {
                                ...r,
                                amountMinor: Math.round(
                                  Number(e.target.value) *
                                    currencyScale(draft.currencyCode),
                                ),
                              }
                            : r,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  {"Price option " + (i + 1) + " minimum travelers"}
                  <input
                    type="number"
                    min={1}
                    value={rate.minTravelers}
                    onChange={(e) =>
                      field(
                        "prices",
                        draft.prices.map((r, j) =>
                          j === i
                            ? { ...r, minTravelers: Number(e.target.value) }
                            : r,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  {"Price option " + (i + 1) + " maximum travelers"}
                  <input
                    type="number"
                    min={rate.minTravelers}
                    value={rate.maxTravelers ?? ""}
                    placeholder="No upper limit"
                    onChange={(e) =>
                      field(
                        "prices",
                        draft.prices.map((r, j) =>
                          j === i
                            ? {
                                ...r,
                                maxTravelers: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              }
                            : r,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="gh-action gh-secondary"
                  onClick={() =>
                    field(
                      "prices",
                      draft.prices.filter((_, j) => j !== i),
                    )
                  }
                >
                  Remove price option {i + 1}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="gh-action gh-secondary"
              onClick={() =>
                field("prices", [
                  ...draft.prices,
                  {
                    label: "",
                    amountMinor: 0,
                    minTravelers: 1,
                    maxTravelers: null,
                  },
                ])
              }
            >
              Add price option
            </button>
          </section>
          <section className="gh-panel">
            <h2>Travel dates</h2>
            <label>
              Schedule
              <select
                value={draft.scheduleModel}
                onChange={(e) => {
                  const model = e.target
                    .value as PackageDraftInput["scheduleModel"];
                  setDraft((d) => ({
                    ...d,
                    scheduleModel: model,
                    departures: [],
                    openDateWindow: null,
                  }));
                }}
              >
                <option value="open_dates">Traveler-selected dates</option>
                <option value="fixed_departures">Scheduled departures</option>
              </select>
            </label>
            {draft.scheduleModel === "open_dates" ? (
              <div className="gh-form-grid">
                <label>
                  Available from
                  <input
                    type="date"
                    value={draft.openDateWindow?.startsOn ?? ""}
                    onChange={(e) =>
                      field("openDateWindow", {
                        startsOn: e.target.value,
                        endsOn: draft.openDateWindow?.endsOn ?? "",
                      })
                    }
                  />
                </label>
                <label>
                  Available until
                  <input
                    type="date"
                    value={draft.openDateWindow?.endsOn ?? ""}
                    onChange={(e) =>
                      field("openDateWindow", {
                        startsOn: draft.openDateWindow?.startsOn ?? "",
                        endsOn: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
            ) : (
              <>
                {draft.departures.map((d, i) => (
                  <div className="gh-editor-row gh-form-grid" key={d.id ?? i}>
                    {(["startsAt", "endsAt", "bookingCutoffAt"] as const).map(
                      (key, k) => (
                        <label key={key}>
                          {"Departure " +
                            (i + 1) +
                            " " +
                            ["start", "end", "booking cutoff"][k] +
                            " (Philippine time, UTC+8)"}
                          <input
                            type="datetime-local"
                            value={d[key] ? manilaDateTimeInput(d[key]) : ""}
                            onChange={(e) =>
                              field(
                                "departures",
                                draft.departures.map((row, j) =>
                                  j === i
                                    ? {
                                        ...row,
                                        [key]: e.target.value
                                          ? manilaInputToIso(e.target.value)
                                          : "",
                                      }
                                    : row,
                                ),
                              )
                            }
                          />
                        </label>
                      ),
                    )}
                    <label>
                      {"Departure " + (i + 1) + " capacity"}
                      <input
                        type="number"
                        min={1}
                        value={d.capacity}
                        onChange={(e) =>
                          field(
                            "departures",
                            draft.departures.map((row, j) =>
                              j === i
                                ? { ...row, capacity: Number(e.target.value) }
                                : row,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="gh-action gh-secondary"
                      onClick={() =>
                        field(
                          "departures",
                          draft.departures.filter((_, j) => j !== i),
                        )
                      }
                    >
                      Remove departure {i + 1}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="gh-action gh-secondary"
                  onClick={() =>
                    field("departures", [
                      ...draft.departures,
                      {
                        startsAt: "",
                        endsAt: "",
                        bookingCutoffAt: "",
                        capacity: 1,
                      },
                    ])
                  }
                >
                  Add departure
                </button>
              </>
            )}
          </section>
          <section className="gh-panel gh-form-grid">
            {(
              [
                "cancellationTerms",
                "reschedulingTerms",
                "noShowTerms",
                "agencyCancellationTerms",
              ] as const
            ).map((key, i) => (
              <label key={key}>
                {
                  [
                    "Cancellation terms",
                    "Rescheduling terms",
                    "Missed departure terms",
                    "Agency cancellation terms",
                  ][i]
                }
                <textarea
                  value={draft.policies[key]}
                  maxLength={4000}
                  onChange={(e) =>
                    field("policies", {
                      ...draft.policies,
                      [key]: e.target.value,
                    })
                  }
                />
              </label>
            ))}
          </section>
          <button className="gh-action gh-orange" type="submit">
            {busy ? "Saving…" : "Save draft"}
          </button>
        </fieldset>
      </form>
      {savedId && editable && (
        <div className="gh-form-actions">
          <button className="gh-action" disabled={busy} onClick={publish}>
            {reviewed ? "Publish package" : "Submit for review"}
          </button>
          {status === "published" && (
            <button
              className="gh-action gh-secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await setPackagePublication(
                    client,
                    savedId,
                    version!,
                    "unpublished",
                  );
                  await reload(savedId);
                  setNotice("Package unpublished");
                })
              }
            >
              Unpublish package
            </button>
          )}
          <button
            className="gh-action gh-secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                if (
                  !window.confirm(
                    "Archive this package? It will no longer accept new requests.",
                  )
                )
                  return;
                await setPackagePublication(
                  client,
                  savedId,
                  version!,
                  "archived",
                );
                await reload(savedId);
                setNotice("Package archived");
              })
            }
          >
            Archive package
          </button>
        </div>
      )}
      {savedId && editable && (
        <section className="gh-panel">
          <h2>Package images</h2>
          <label>
            Image description
            <input
              value={alt}
              maxLength={200}
              onChange={(e) => setAlt(e.target.value)}
            />
          </label>
          <label>
            Package image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            className="gh-action gh-secondary"
            disabled={busy || !file}
            onClick={() =>
              run(async () => {
                await uploadPackageImage(client, savedId, file!, alt);
                await reload(savedId);
                media.refresh();
                setFile(null);
                setNotice("Image uploaded");
              })
            }
          >
            Upload image
          </button>
          {media.data?.map((m) => (
            <p key={m.id}>
              {m.alt_text}{" "}
              <button
                className="gh-action gh-secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await removePackageImage(client, m.id);
                    await reload(savedId);
                    media.refresh();
                    setNotice("Image removed");
                  })
                }
              >
                Remove image
              </button>
            </p>
          ))}
        </section>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <div role="alert" className="gh-feedback">
          <p>{error}</p>
          <button
            className="gh-action gh-secondary"
            onClick={() => {
              loaded.refresh();
              setError("");
            }}
          >
            Reload latest version
          </button>
        </div>
      )}
    </CatalogState>
  );
}
