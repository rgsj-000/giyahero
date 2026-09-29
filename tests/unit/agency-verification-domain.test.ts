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
  it("marks the three core evidence categories required and DOT optional", () => {
    const byType = Object.fromEntries(
      VERIFICATION_DOCUMENT_TYPES.map((definition) => [
        definition.type,
        definition,
      ]),
    );

    expect(byType.business_registration.required).toBe(true);
    expect(byType.business_permit.required).toBe(true);
    expect(byType.authorized_representative_id.required).toBe(true);
    expect(byType.dot_accreditation.required).toBe(false);
  });

  it("computes completeness from unique required document categories", () => {
    expect(
      getVerificationCompleteness([
        { document_type: "business_registration" },
        { document_type: "business_registration" },
        { document_type: "business_permit" },
      ]),
    ).toEqual({
      complete: false,
      missingRequired: ["authorized_representative_id"],
    });

    expect(
      getVerificationCompleteness([
        { document_type: "authorized_representative_id" },
        { document_type: "business_permit" },
        { document_type: "business_registration" },
        { document_type: "dot_accreditation" },
      ]),
    ).toEqual({ complete: true, missingRequired: [] });
  });

  it("sanitizes hostile filenames without losing a safe extension", () => {
    const sanitized = sanitizeVerificationFilename(
      "../../Mayor's Permit 2026.PDF",
    );

    expect(sanitized).not.toContain("/");
    expect(sanitized).not.toContain("\\");
    expect(sanitized).not.toContain("..");
    expect(sanitized.toLowerCase()).toMatch(/\.pdf$/);
  });

  it("falls back to a deterministic safe filename when input is unusable", () => {
    expect(sanitizeVerificationFilename("   ../..   ")).toBe(
      "verification-document",
    );
    expect(sanitizeVerificationFilename("\u0000\u0001")).toBe(
      "verification-document",
    );
  });

  it("builds the agency-scoped private storage path from the approved shape", () => {
    expect(
      buildVerificationStoragePath({
        agencyId: "agency-id",
        submissionId: "submission-id",
        documentType: "business_permit",
        uploadId: "upload-id",
        filename: "Mayor's Permit.pdf",
      }),
    ).toBe(
      "agency/agency-id/submission-id/business_permit/upload-id-Mayor-s-Permit.pdf",
    );
  });
});
