import { notFound, redirect } from "next/navigation";
import {
  AdminVerificationReview,
  type AdminVerificationAgencyProfile,
  type AdminVerificationSubmission,
} from "@/features/agencies/verification/admin-verification-review";
import type {
  VerificationDocument,
  VerificationDocumentType,
  VerificationSubmissionStatus,
} from "@/features/agencies/verification/types";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server";

const REVIEWER_ROLES = ["super_admin", "agency_verifier"] as const;

type AdminVerificationReviewPageProps = {
  params: Promise<{ submissionId: string }>;
};

async function requireVerificationReviewer(nextPath: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const { data: memberships, error } = await supabase
    .from("platform_admin_memberships")
    .select("role")
    .eq("user_id", user.id)
    .in("role", [...REVIEWER_ROLES])
    .limit(1);

  if (error) throw error;
  if (!memberships?.length) redirect("/");

  return supabase;
}

export default async function AdminVerificationReviewPage({
  params,
}: AdminVerificationReviewPageProps) {
  const { submissionId } = await params;
  const path = `/admin/verifications/${submissionId}`;
  const supabase = await requireVerificationReviewer(path);

  const { data: submission, error: submissionError } = await supabase
    .from("agency_verification_submissions")
    .select("id,agency_id,status,submitted_at,reviewed_at,decision_notes")
    .eq("id", submissionId)
    .maybeSingle();

  if (submissionError) throw submissionError;
  if (!submission) notFound();

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .select(
      "id,name,legal_name,contact_email,contact_phone,website_url,description",
    )
    .eq("id", submission.agency_id)
    .maybeSingle();

  if (agencyError) throw agencyError;
  if (!agency) notFound();

  const { data: documents, error: documentError } = await supabase
    .from("agency_verification_documents")
    .select(
      "id,document_type,storage_path,original_name,mime_type,size_bytes,uploaded_at",
    )
    .eq("submission_id", submission.id)
    .order("uploaded_at", { ascending: true });

  if (documentError) throw documentError;

  const agencyModel: AdminVerificationAgencyProfile = {
    id: agency.id,
    name: agency.name,
    legalName: agency.legal_name,
    contactEmail: agency.contact_email,
    contactPhone: agency.contact_phone,
    websiteUrl: agency.website_url,
    description: agency.description,
  };
  const submissionModel: AdminVerificationSubmission = {
    id: submission.id,
    status: submission.status as VerificationSubmissionStatus,
    submittedAt: submission.submitted_at,
    reviewedAt: submission.reviewed_at,
    decisionNotes: submission.decision_notes,
  };
  const documentModels: VerificationDocument[] = (documents ?? []).map(
    (document) => ({
      id: document.id,
      document_type: document.document_type as VerificationDocumentType,
      storage_path: document.storage_path,
      original_name: document.original_name,
      mime_type: document.mime_type,
      size_bytes: Number(document.size_bytes),
      uploaded_at: document.uploaded_at,
    }),
  );

  return (
    <AdminVerificationReview
      agency={agencyModel}
      documents={documentModels}
      initialSubmission={submissionModel}
    />
  );
}
