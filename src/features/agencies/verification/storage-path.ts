export function sanitizeVerificationFilename(filename: string): string {
  const normalized = filename.replaceAll("\\", "/");
  const lastSegment = normalized.split("/").at(-1)?.trim() ?? "";

  if (!lastSegment) return "document";

  const extensionMatch = lastSegment.match(/\.([a-zA-Z0-9]{1,10})$/);
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : "";
  const stem = extension
    ? lastSegment.slice(0, -extension.length)
    : lastSegment;

  const sanitizedStem = stem
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

  if (!sanitizedStem) return "document";

  return `${sanitizedStem}${extension}`;
}

export function buildVerificationStoragePath(input: {
  agencyId: string;
  submissionId: string;
  uploadId: string;
  filename: string;
}): string {
  return [
    "agency",
    input.agencyId,
    input.submissionId,
    input.uploadId,
    sanitizeVerificationFilename(input.filename),
  ].join("/");
}
