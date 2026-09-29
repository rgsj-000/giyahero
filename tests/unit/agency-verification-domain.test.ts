import { describe, expect, it } from "vitest";
import {
  VERIFICATION_DOCUMENT_TYPES,
  getVerificationCompleteness,
} from "@/features/agencies/verification/document-types";
import {
  buildVerificationStoragePath,
  sanitizeVerificationFilename,
} from "@/features/agencies/verification/storage-path";

describe("agency verification document domain", () => {
  it("defines the exact Release 1 document requirements", () => {
    expect(
      VERIFICATION_DOCUMENT_TYPES.map(({ type, required }) => ({
        type,
        required,
      })),
    ).toEqual([
      { type: "business_registration", required: true },
      { type: "business_permit", required: true },
      { type: "authorized_representative_id", required: true },
      { type: "dot_accreditation", required: false },
    ]);
  });

  it("reports missing required categories without counting duplicates", () => {
    expect(
      getVerificationCompleteness([
        { documentType: "business_registration" },
        { documentType: "business_registration" },
      ]),
    ).toEqual({
      complete: false,
      missingRequired: [
        "business_permit",
        "authorized_representative_id",
      ],
    });

    expect(
      getVerificationCompleteness([
        { documentType: "business_registration" },
        { documentType: "business_permit" },
        { documentType: "authorized_representative_id" },
      ]),
    ).toEqual({ complete: true, missingRequired: [] });
  });

  it("sanitizes hostile and blank filenames deterministically", () => {
    expect(sanitizeVerificationFilename("../../Mayor's Permit 2026.PDF")).toBe(
      "Mayor-s-Permit-2026.pdf",
    );
    expect(sanitizeVerificationFilename("..\\..\\valid id.PNG")).toBe(
      "valid-id.png",
    );
    expect(sanitizeVerificationFilename("...///   ")).toBe("document");
  });

  it("builds agency scoped storage paths with sanitized filenames", () => {
    expect(
      buildVerificationStoragePath({
        agencyId: "agency-123",
        submissionId: "submission-456",
        uploadId: "upload-789",
        filename: "Mayor's Permit.PDF",
      }),
    ).toBe(
      "agency/agency-123/submission-456/upload-789/Mayor-s-Permit.pdf",
    );
  });
});
