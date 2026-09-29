export type VerificationDocumentType =
  | "business_registration"
  | "business_permit"
  | "authorized_representative_id"
  | "dot_accreditation";

export type VerificationDocumentDefinition = {
  type: VerificationDocumentType;
  label: string;
  required: boolean;
  description: string;
};

export type VerificationDocumentRecord = {
  document_type: string;
};

export type VerificationDocument = {
  id: string;
  document_type: VerificationDocumentType;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
};

export type VerificationSubmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "verified"
  | "rejected";

export type AgencyVerificationSubmission = {
  id: string;
  status: VerificationSubmissionStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  decision_notes: string | null;
};

export type AgencyVerificationAgency = {
  id: string;
  name: string;
  status: string;
  verified_at: string | null;
};
