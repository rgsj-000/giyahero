import type { VerificationDocumentType } from "./types";

const FALLBACK_FILENAME = "verification-document";
const MAX_FILENAME_LENGTH = 120;

function splitExtension(filename: string): { stem: string; extension: string } {
  const match = filename.match(/^(.*?)(\.[A-Za-z0-9]{1,10})$/);
  if (!match) return { stem: filename, extension: "" };

  return { stem: match[1], extension: match[2] };
}

export function sanitizeVerificationFilename(filename: string): string {
  const leaf = filename
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .split(/[\\/]/)
    .pop()
    ?.trim();

  if (!leaf || /^\.*$/.test(leaf)) return FALLBACK_FILENAME;

  const { stem, extension } = splitExtension(leaf);
  const safeStem = stem
    .replace(/\.\./g, "-")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  const safeExtension = extension.replace(/[^A-Za-z0-9.]/g, "");

  const normalizedStem = safeStem || FALLBACK_FILENAME;
  const maxStemLength = Math.max(1, MAX_FILENAME_LENGTH - safeExtension.length);
  const truncatedStem = normalizedStem.slice(0, maxStemLength);

  return `${truncatedStem}${safeExtension}`;
}

export function buildVerificationStoragePath(input: {
  agencyId: string;
  submissionId: string;
  documentType: VerificationDocumentType;
  uploadId: string;
  filename: string;
}): string {
  const filename = sanitizeVerificationFilename(input.filename);
  return `agency/${input.agencyId}/${input.submissionId}/${input.documentType}/${input.uploadId}-${filename}`;
}
