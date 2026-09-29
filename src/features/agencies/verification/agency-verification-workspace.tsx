"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser";
import {
  getVerificationCompleteness,
  VERIFICATION_DOCUMENT_TYPES,
} from "./document-types";
import { DocumentCard } from "./document-card";
import { buildVerificationStoragePath } from "./storage-path";
import type {
  AgencyVerificationAgency,
  AgencyVerificationSubmission,
  VerificationDocument,
  VerificationDocumentDefinition,
  VerificationDocumentType,
} from "./types";

const BUCKET = "agency-verification";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  verified: "Verified",
  rejected: "Rejected",
  suspended: "Suspended",
};

type AgencyVerificationWorkspaceProps = {
  agency: AgencyVerificationAgency;
  initialSubmission: AgencyVerificationSubmission | null;
  initialDocuments: VerificationDocument[];
};

function displayFileName(filename: string) {
  return filename.split(/[\\/]/).pop()?.trim() || "verification-document";
}

export function AgencyVerificationWorkspace({
  agency,
  initialSubmission,
  initialDocuments,
}: AgencyVerificationWorkspaceProps) {
  const router = useRouter();
  const [submission, setSubmission] = useState(initialSubmission);
  const [documents, setDocuments] = useState(initialDocuments);
  const [busyType, setBusyType] = useState<VerificationDocumentType | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const editable = submission?.status === "draft";
  const completeness = useMemo(
    () => getVerificationCompleteness(documents),
    [documents],
  );
  const status = submission?.status ?? agency.status;
  const statusLabel = statusLabels[status] ?? status;

  async function removeDocument(document: VerificationDocument) {
    const supabase = createBrowserSupabaseClient();
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([document.storage_path]);

    if (storageError) {
      throw new Error(
        `Could not remove the stored file: ${storageError.message}`,
      );
    }

    const { error: metadataError } = await supabase.rpc(
      "remove_verification_document",
      { target_document_id: document.id },
    );

    if (metadataError) {
      throw new Error(
        "The file was removed, but its verification record could not be cleared. Retry the removal before uploading a replacement.",
      );
    }

    setDocuments((current) =>
      current.filter((item) => item.id !== document.id),
    );
  }

  async function handleUpload(
    definition: VerificationDocumentDefinition,
    file: File,
  ) {
    if (!submission || !editable) return;

    setBusyType(definition.type);
    setErrorMessage(null);

    try {
      const currentDocument = documents.find(
        (document) => document.document_type === definition.type,
      );
      if (currentDocument) await removeDocument(currentDocument);

      const uploadId = crypto.randomUUID();
      const originalName = displayFileName(file.name);
      const storagePath = buildVerificationStoragePath({
        agencyId: agency.id,
        submissionId: submission.id,
        documentType: definition.type,
        uploadId,
        filename: originalName,
      });
      const supabase = createBrowserSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: documentId, error: metadataError } = await supabase.rpc(
        "register_verification_document",
        {
          target_submission_id: submission.id,
          target_document_id: uploadId,
          target_document_type: definition.type,
          target_storage_path: storagePath,
          target_original_name: originalName,
          target_mime_type: file.type || "application/octet-stream",
          target_size_bytes: file.size,
        },
      );

      if (metadataError) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
        throw metadataError;
      }

      setDocuments((current) => [
        ...current.filter(
          (document) => document.document_type !== definition.type,
        ),
        {
          id: typeof documentId === "string" ? documentId : uploadId,
          document_type: definition.type,
          storage_path: storagePath,
          original_name: originalName,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          uploaded_at: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Document upload failed.",
      );
    } finally {
      setBusyType(null);
    }
  }

  async function handleRemove(document: VerificationDocument) {
    setBusyType(document.document_type);
    setErrorMessage(null);
    try {
      await removeDocument(document);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Document removal failed.",
      );
    } finally {
      setBusyType(null);
    }
  }

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

  async function handleSubmit() {
    if (!submission || !editable || !completeness.complete) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    const supabase = createBrowserSupabaseClient();

    try {
      const { error } = await supabase.rpc("submit_agency_verification", {
        target_submission_id: submission.id,
      });
      if (error) throw error;

      setSubmission({
        ...submission,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      });
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Submission failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              {agency.name}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Agency Verification
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-slate-600">
              Submit private business records for GiyaHero review. GiyaHero
              verification is separate from government or DOT accreditation.
            </p>
          </div>
          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200">
            {statusLabel}
          </div>
        </div>

        {status === "rejected" && submission?.decision_notes ? (
          <section className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
            <p className="font-semibold">Verification was not approved</p>
            <p className="mt-2 text-sm leading-6">
              {submission.decision_notes}
            </p>
          </section>
        ) : null}

        {status === "verified" ? (
          <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
            <p className="font-semibold">Agency verified by GiyaHero</p>
            {agency.verified_at ? (
              <p className="mt-1 text-sm text-emerald-800">
                Verified {new Date(agency.verified_at).toLocaleDateString()}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Verification documents
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Three records are required. DOT accreditation is optional.
              </p>
            </div>
            <p className="text-sm font-medium text-slate-600">
              {completeness.complete
                ? "Required documents complete"
                : `${completeness.missingRequired.length} required remaining`}
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {VERIFICATION_DOCUMENT_TYPES.map((definition) => {
              const document =
                documents.find(
                  (item) => item.document_type === definition.type,
                ) ?? null;
              return (
                <DocumentCard
                  busy={busyType === definition.type}
                  definition={definition}
                  document={document}
                  editable={editable}
                  key={definition.type}
                  onRemove={() =>
                    document ? handleRemove(document) : Promise.resolve()
                  }
                  onUpload={(file) => handleUpload(definition, file)}
                  onView={() =>
                    document ? handleView(document) : Promise.resolve()
                  }
                />
              );
            })}
          </div>
        </section>

        {errorMessage ? (
          <p
            aria-live="polite"
            className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {errorMessage}
          </p>
        ) : null}

        {editable ? (
          <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-900">Ready for review?</p>
              <p className="mt-1 text-sm text-slate-600">
                Submission locks these files while GiyaHero reviews the agency.
              </p>
            </div>
            <button
              className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!completeness.complete || isSubmitting || !!busyType}
              onClick={() => void handleSubmit()}
              type="button"
            >
              {isSubmitting ? "Submitting…" : "Submit for Verification"}
            </button>
          </section>
        ) : null}

        {status === "submitted" || status === "under_review" ? (
          <p className="mt-6 rounded-2xl bg-slate-100 p-5 text-sm leading-6 text-slate-700">
            {status === "submitted"
              ? "Your application is submitted and cannot be edited while awaiting review."
              : "Your application is under review and cannot be edited."}
          </p>
        ) : null}
      </div>
    </main>
  );
}
