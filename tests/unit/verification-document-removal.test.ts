import { describe, expect, it, vi } from "vitest";
import { removeVerificationDocumentSafely } from "@/features/agencies/verification/document-removal";

describe("removeVerificationDocumentSafely", () => {
  it("removes metadata before deleting the storage object", async () => {
    const calls: string[] = [];
    const removeMetadata = vi.fn(async () => {
      calls.push("metadata");
      return "agency/a/submission/business_permit/file.pdf";
    });
    const removeStorage = vi.fn(async () => {
      calls.push("storage");
    });

    const result = await removeVerificationDocumentSafely({
      documentId: "document-id",
      fallbackStoragePath: "fallback.pdf",
      removeMetadata,
      removeStorage,
    });

    expect(calls).toEqual(["metadata", "storage"]);
    expect(removeStorage).toHaveBeenCalledWith(
      "agency/a/submission/business_permit/file.pdf",
    );
    expect(result.storageCleanupError).toBeNull();
  });

  it("does not delete storage when metadata removal fails", async () => {
    const removeMetadata = vi.fn(async () => {
      throw new Error("metadata unavailable");
    });
    const removeStorage = vi.fn(async () => undefined);

    await expect(
      removeVerificationDocumentSafely({
        documentId: "document-id",
        fallbackStoragePath: "fallback.pdf",
        removeMetadata,
        removeStorage,
      }),
    ).rejects.toThrow("metadata unavailable");
    expect(removeStorage).not.toHaveBeenCalled();
  });

  it("reports storage cleanup failure after metadata is already removed", async () => {
    const removeMetadata = vi.fn(async () => "stored.pdf");
    const cleanupError = new Error("storage unavailable");
    const removeStorage = vi.fn(async () => {
      throw cleanupError;
    });

    const result = await removeVerificationDocumentSafely({
      documentId: "document-id",
      fallbackStoragePath: "fallback.pdf",
      removeMetadata,
      removeStorage,
    });

    expect(result.storageCleanupError).toBe(cleanupError);
  });
});
