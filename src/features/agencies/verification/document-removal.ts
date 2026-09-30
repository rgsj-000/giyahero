type RemoveVerificationDocumentSafelyInput = {
  documentId: string;
  fallbackStoragePath: string;
  removeMetadata: (documentId: string) => Promise<string | null>;
  removeStorage: (storagePath: string) => Promise<void>;
};

export async function removeVerificationDocumentSafely({
  documentId,
  fallbackStoragePath,
  removeMetadata,
  removeStorage,
}: RemoveVerificationDocumentSafelyInput): Promise<{
  storageCleanupError: unknown | null;
}> {
  const storagePath =
    (await removeMetadata(documentId))?.trim() || fallbackStoragePath;

  try {
    await removeStorage(storagePath);
    return { storageCleanupError: null };
  } catch (error) {
    return { storageCleanupError: error };
  }
}
