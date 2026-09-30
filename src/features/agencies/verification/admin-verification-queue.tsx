"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type AdminVerificationQueueItem = {
  id: string;
  agencyName: string;
  status: "submitted" | "under_review";
  submittedAt: string | null;
  documentCount: number;
};

type AdminVerificationQueueProps = {
  items: AdminVerificationQueueItem[];
};

const statusLabels = {
  submitted: "Submitted",
  under_review: "Under review",
} as const;

export function AdminVerificationQueue({ items }: AdminVerificationQueueProps) {
  const [filter, setFilter] = useState<
    "all" | AdminVerificationQueueItem["status"]
  >("all");
  const visibleItems = useMemo(
    () =>
      filter === "all" ? items : items.filter((item) => item.status === filter),
    [filter, items],
  );

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              GiyaHero Admin
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Agency Verifications
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-slate-600">
              Review submitted agency records and make an auditable verification
              decision.
            </p>
          </div>

          <label className="text-sm font-semibold text-slate-700">
            Status
            <select
              className="mt-2 block rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal text-slate-800 shadow-sm"
              onChange={(event) =>
                setFilter(
                  event.target.value as
                    "all" | AdminVerificationQueueItem["status"],
                )
              }
              value={filter}
            >
              <option value="all">All active</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under review</option>
            </select>
          </label>
        </div>

        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {visibleItems.length === 0 ? (
            <div className="p-10 text-center">
              <h2 className="font-semibold text-slate-950">No applications</h2>
              <p className="mt-2 text-sm text-slate-600">
                There are no verification applications in this view.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {visibleItems.map((item) => (
                <article
                  className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center sm:px-6"
                  key={item.id}
                >
                  <div>
                    <h2 className="font-semibold text-slate-950">
                      {item.agencyName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.submittedAt
                        ? `Submitted ${new Date(item.submittedAt).toLocaleString()}`
                        : "Submission date unavailable"}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                    {statusLabels[item.status]}
                  </span>
                  <span className="text-sm font-medium text-slate-600">
                    {item.documentCount} documents
                  </span>
                  <Link
                    className="w-fit rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                    href={`/admin/verifications/${item.id}`}
                  >
                    Review
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
