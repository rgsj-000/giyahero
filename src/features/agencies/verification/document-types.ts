import type {
  VerificationDocumentDefinition,
  VerificationDocumentRecord,
  VerificationDocumentType,
} from "./types";

export const VERIFICATION_DOCUMENT_TYPES = [
  {
    type: "business_registration",
    label: "Business Registration",
    required: true,
    description: "Proof of legal business registration.",
  },
  {
    type: "business_permit",
    label: "Current Business Permit",
    required: true,
    description: "Current local business permit for the agency.",
  },
  {
    type: "authorized_representative_id",
    label: "Authorized Representative ID",
    required: true,
    description: "Identification for the authorized agency representative.",
  },
  {
    type: "dot_accreditation",
    label: "DOT Accreditation",
    required: false,
    description:
      "Optional Department of Tourism accreditation evidence when applicable.",
  },
] as const satisfies readonly VerificationDocumentDefinition[];

const requiredDocumentTypes = VERIFICATION_DOCUMENT_TYPES.filter(
  (definition) => definition.required,
).map((definition) => definition.type) as VerificationDocumentType[];

export function getVerificationCompleteness(
  documents: readonly VerificationDocumentRecord[],
): {
  complete: boolean;
  missingRequired: VerificationDocumentType[];
} {
  const presentTypes = new Set(documents.map((document) => document.document_type));
  const missingRequired = requiredDocumentTypes.filter(
    (type) => !presentTypes.has(type),
  );

  return {
    complete: missingRequired.length === 0,
    missingRequired,
  };
}
