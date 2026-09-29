import type { VerificationDocumentType } from "./types";

export interface VerificationDocumentDefinition {
  type: VerificationDocumentType;
  label: string;
  required: boolean;
  description: string;
}

export const VERIFICATION_DOCUMENT_TYPES = [
  {
    type: "business_registration",
    label: "Business registration",
    required: true,
    description: "Registration document identifying the agency business.",
  },
  {
    type: "business_permit",
    label: "Current business permit",
    required: true,
    description: "Current permit for the agency business operation.",
  },
  {
    type: "authorized_representative_id",
    label: "Authorized representative ID",
    required: true,
    description: "Identification for the authorized agency representative.",
  },
  {
    type: "dot_accreditation",
    label: "DOT accreditation",
    required: false,
    description: "Optional Department of Tourism accreditation evidence.",
  },
] as const satisfies readonly VerificationDocumentDefinition[];

const requiredDocumentTypes = VERIFICATION_DOCUMENT_TYPES.filter(
  ({ required }) => required,
).map(({ type }) => type);

export function getVerificationCompleteness(
  documents: readonly { documentType: VerificationDocumentType }[],
): {
  complete: boolean;
  missingRequired: VerificationDocumentType[];
} {
  const uploadedTypes = new Set(documents.map(({ documentType }) => documentType));
  const missingRequired = requiredDocumentTypes.filter(
    (documentType) => !uploadedTypes.has(documentType),
  );

  return {
    complete: missingRequired.length === 0,
    missingRequired,
  };
}
