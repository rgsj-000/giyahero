"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser";
import { VERIFICATION_DOCUMENT_TYPES } from "./document-types";
import type {
  VerificationDocument,
  VerificationSubmissionStatus,
} from "./types";

const BUCKET = "agency-verification";

const statusLabels: Record<VerificationSubmissionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  verified: "Verified",
  rejected: "Rejected",
};

export type AdminVerificationAgencyProfile = {
  id: string;
  name: string;
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  description: string | null;
};

export type AdminVerificationSubmission = {
  id: string;
  status: VerificationSubmissionStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  decisionNotes: string | null;
};

type AdminVerificationReviewProps = {
  agency: AdminVerificationAgencyProfile;
  initialSubmission: AdminVerificationSubmission;
  documents: VerificationDocument[];
};

function documentLabel(documentType: string) {
  return (
    VERIFICATION_DOCUMENT_TYPES.find(
      (definition) => definition.type === documentType,
    )?.label ?? documentType
  );
}

export function AdminVerificationReview({
  agency,
  initialSubmission,
  documents,
}: AdminVerificationReviewProps) {
  const router = useRouter();
  const [submission, setSubmission] = useState(initialSubmission);
  const [reason, setReason] = useState("");
  const [showVerificationConfirmation, setShowVerificationConfirmation] =
    useState(false);
  const [busyAction, setBusyAction] = useState<
    "review" | "verify" | "reject" | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleView(document: VerificationDocument) {
    setErrorMessage(null);
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(document.storage_path, 60);

    if (error || !data?.signedUrl) {
      setErrorMessage(error?.message ?? "Could not open the document.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function startReview() {
    setBusyAction("review");
    setErrorMessage(null);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("start_agency_verification_review", {
      target_submission_id: submission.id,
    });

    if (error) {
      setErrorMessage(error.message);
      setBusyAction(null);
      return;
    }

    setSubmission((current) => ({
      ...current,
      status: "under_review",
      reviewedAt: new Date().toISOString(),
    }));
    setBusyAction(null);
    router.refresh();
  }

  async function decide(
    decision: "verified" | "rejected",
    notes: string | null,
  ) {
    setBusyAction(decision === "verified" ? "verify" : "reject");
    setErrorMessage(null);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("decide_agency_verification", {
      target_submission_id: submission.id,
      target_decision: decision,
      target_notes: notes,
    });

    if (error) {
      setErrorMessage(error.message);
      setBusyAction(null);
      return;
    }

    setSubmission((current) => ({
      ...current,
      status: decision,
      decisionNotes: notes,
      reviewedAt: new Date().toISOString(),
    }));
    setBusyAction(null);
    setShowVerificationConfirmation(false);
    router.refresh();
  }

  const isTerminal =
    submission.status === "verified" || submission.status === "rejected";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Verification Review
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {agency.name}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {agency.legalName ?? "Legal name not provided"}
            </p>
          </div>
          <span className="w-fit rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200">
            {statusLabels[submission.status]}
          </span>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-semibold text-slate-950">
                Agency profile
              </h2>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact email
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {agency.contactEmail ?? "Not provided"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact phone
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {agency.contactPhone ?? "Not provided"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Website
                  </dt>
                  <dd className="mt-1 break-all text-sm text-slate-900">
                    {agency.websiteUrl ?? "Not provided"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Application received
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {submission.submittedAt
                      ? new Date(submission.submittedAt).toLocaleString()
                      : "Unavailable"}
                  </dd>
                </div>
              </dl>
              {agency.description ? (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Description
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {agency.description}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-semibold text-slate-950">
                Verification evidence
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Files remain private. Each view link is a short lived signed
                URL.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {documents.map((document) => (
                  <article
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                    key={document.id}
                  >
                    <h3 className="font-semibold text-slate-950">
                      {documentLabel(document.document_type)}
                    </h3>
                    <p className="mt-2 break-all text-sm text-slate-600">
                      {document.original_name}
                    </p>
                    <button
                      className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                      onClick={() => void handleView(document)}
                      type="button"
                    >
                      View document
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Review decision
            </h2>

            {submission.status === "submitted" ? (
              <>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Claim this application before making a final decision.
                </p>
                <button
                  className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
                  disabled={busyAction !== null}
                  onClick={() => void startReview()}
                  type="button"
                >
                  {busyAction === "review"
                    ? "Starting review…"
                    : "Start Review"}
                </button>
              </>
            ) : null}

            {submission.status === "under_review" ? (
              <div className="mt-4 space-y-5">
                <div>
                  <button
                    className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
                    disabled={busyAction !== null}
                    onClick={() => setShowVerificationConfirmation(true)}
                    type="button"
                  >
                    Verify Agency
                  </button>

                  {showVerificationConfirmation ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm leading-6 text-emerald-950">
                        Confirm that the submitted evidence supports GiyaHero
                        verification. This does not represent government or DOT
                        accreditation.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          disabled={busyAction !== null}
                          onClick={() => void decide("verified", null)}
                          type="button"
                        >
                          {busyAction === "verify"
                            ? "Confirming…"
                            : "Confirm Verification"}
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                          disabled={busyAction !== null}
                          onClick={() => setShowVerificationConfirmation(false)}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="border-t border-slate-200 pt-5">
                  <label
                    className="text-sm font-semibold text-slate-800"
                    htmlFor="rejection-reason"
                  >
                    Rejection reason
                  </label>
                  <textarea
                    className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    id="rejection-reason"
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explain what the agency must correct"
                    value={reason}
                  />
                  <button
                    className="mt-3 w-full rounded-xl border border-rose-200 bg-white px-4 py-3 font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={reason.trim().length === 0 || busyAction !== null}
                    onClick={() => void decide("rejected", reason.trim())}
                    type="button"
                  >
                    {busyAction === "reject" ? "Rejecting…" : "Reject Agency"}
                  </button>
                </div>
              </div>
            ) : null}

            {isTerminal ? (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Decision recorded
                </p>
                {submission.decisionNotes ? (
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {submission.decisionNotes}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">
                    No decision note was required.
                  </p>
                )}
              </div>
            ) : null}

            {errorMessage ? (
              <p
                aria-live="polite"
                className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
              >
                {errorMessage}
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
