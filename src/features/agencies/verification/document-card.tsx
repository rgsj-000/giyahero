"use client";

import type {
  VerificationDocument,
  VerificationDocumentDefinition,
} from "./types";

type DocumentCardProps = {
  definition: VerificationDocumentDefinition;
  document: VerificationDocument | null;
  editable: boolean;
  busy: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  onView: () => Promise<void>;
};

export function DocumentCard({
  definition,
  document,
  editable,
  busy,
  onUpload,
  onRemove,
  onView,
}: DocumentCardProps) {
  return (
    <article
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      data-testid={`verification-${definition.type}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-950">{definition.label}</h3>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                definition.required
                  ? "bg-amber-50 text-amber-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {definition.required ? "Required" : "Optional"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {definition.description}
          </p>
        </div>
        <span
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
            document ? "bg-emerald-500" : "bg-slate-300"
          }`}
          aria-hidden="true"
        />
      </div>

      {document ? (
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="break-all text-sm font-medium text-slate-900">
            {document.original_name}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Uploaded {new Date(document.uploaded_at).toLocaleString()}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              disabled={busy}
              onClick={() => void onView()}
              type="button"
            >
              View document
            </button>
            {editable ? (
              <button
                className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => void onRemove()}
                type="button"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {editable ? (
        <label className="mt-4 block text-sm font-semibold text-emerald-800">
          {document ? `Replace ${definition.label}` : `Upload ${definition.label}`}
          <input
            accept="application/pdf,image/jpeg,image/png,image/webp"
            aria-label={`Upload ${definition.label}`}
            className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:font-semibold file:text-emerald-800 hover:file:bg-emerald-100 disabled:opacity-50"
            disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void onUpload(file);
            }}
            type="file"
          />
        </label>
      ) : null}
    </article>
  );
}
