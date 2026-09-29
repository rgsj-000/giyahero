import { redirect } from "next/navigation";
import { AgencyVerificationWorkspace } from "@/features/agencies/verification/agency-verification-workspace";
import type {
  AgencyVerificationAgency,
  AgencyVerificationSubmission,
  VerificationDocument,
  VerificationDocumentType,
  VerificationSubmissionStatus,
} from "@/features/agencies/verification/types";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server";

type VerificationPageProps = {
  params: Promise<{ agencyId: string }>;
};

export default async function AgencyVerificationPage({
  params,
}: VerificationPageProps) {
  const { agencyId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/agency/${agencyId}/verification`)}`,
    );
  }

  const { data: membership } = await supabase
    .from("agency_members")
    .select("role")
    .eq("agency_id", agencyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["owner", "manager"].includes(membership.role)) {
    redirect("/agency/onboarding");
  }

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .select("id,name,status,verified_at")
    .eq("id", agencyId)
    .single();

  if (agencyError || !agency) {
    redirect("/agency/onboarding");
  }

  const submissionResult = await supabase
    .from("agency_verification_submissions")
    .select("id,status,submitted_at,reviewed_at,decision_notes")
    .eq("agency_id", agencyId)
    .limit(1)
    .maybeSingle();
  let submission = submissionResult.data;

  if (submissionResult.error) throw submissionResult.error;

  if (!submission && agency.status === "draft") {
    const { data: draftId, error: draftError } = await supabase.rpc(
      "create_verification_draft",
      { target_agency_id: agencyId },
    );
    if (draftError || typeof draftId !== "string") {
      throw draftError ?? new Error("Could not create verification draft.");
    }

    const draftResult = await supabase
      .from("agency_verification_submissions")
      .select("id,status,submitted_at,reviewed_at,decision_notes")
      .eq("id", draftId)
      .single();
    if (draftResult.error) throw draftResult.error;
    submission = draftResult.data;
  }

  let documents: VerificationDocument[] = [];
  if (submission) {
    const { data, error } = await supabase
      .from("agency_verification_documents")
      .select(
        "id,document_type,storage_path,original_name,mime_type,size_bytes,uploaded_at",
      )
      .eq("submission_id", submission.id)
      .order("uploaded_at", { ascending: true });
    if (error) throw error;

    documents = (data ?? []).map((document) => ({
      id: document.id,
      document_type: document.document_type as VerificationDocumentType,
      storage_path: document.storage_path,
      original_name: document.original_name,
      mime_type: document.mime_type,
      size_bytes: Number(document.size_bytes),
      uploaded_at: document.uploaded_at,
    }));
  }

  const agencyModel: AgencyVerificationAgency = {
    id: agency.id,
    name: agency.name,
    status: agency.status,
    verified_at: agency.verified_at,
  };
  const submissionModel: AgencyVerificationSubmission | null = submission
    ? {
        id: submission.id,
        status: submission.status as VerificationSubmissionStatus,
        submitted_at: submission.submitted_at,
        reviewed_at: submission.reviewed_at,
        decision_notes: submission.decision_notes,
      }
    : null;

  return (
    <AgencyVerificationWorkspace
      agency={agencyModel}
      initialDocuments={documents}
      initialSubmission={submissionModel}
    />
  );
}
