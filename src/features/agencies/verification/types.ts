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
