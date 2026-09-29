export type VerificationDocumentType =
  | "business_registration"
  | "business_permit"
  | "authorized_representative_id"
  | "dot_accreditation";

export type AgencyVerificationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "verified"
  | "rejected";

export interface VerificationDocumentRecord {
  id: string;
  documentType: VerificationDocumentType;
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}
