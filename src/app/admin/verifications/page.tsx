import { redirect } from "next/navigation";
import {
  AdminVerificationQueue,
  type AdminVerificationQueueItem,
} from "@/features/agencies/verification/admin-verification-queue";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server";

const REVIEWER_ROLES = ["super_admin", "agency_verifier"] as const;

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

export default async function AdminVerificationsPage() {
  const supabase = await requireVerificationReviewer("/admin/verifications");
  const { data: submissions, error: submissionError } = await supabase
    .from("agency_verification_submissions")
    .select("id,agency_id,status,submitted_at")
    .in("status", ["submitted", "under_review"])
    .order("submitted_at", { ascending: true });

  if (submissionError) throw submissionError;

  const agencyIds = Array.from(
    new Set((submissions ?? []).map((submission) => submission.agency_id)),
  );
  const submissionIds = (submissions ?? []).map((submission) => submission.id);

  const agenciesById = new Map<string, string>();
  if (agencyIds.length) {
    const { data: agencies, error } = await supabase
      .from("agencies")
      .select("id,name")
      .in("id", agencyIds);
    if (error) throw error;

    for (const agency of agencies ?? []) {
      agenciesById.set(agency.id, agency.name);
    }
  }

  const documentCounts = new Map<string, number>();
  if (submissionIds.length) {
    const { data: documents, error } = await supabase
      .from("agency_verification_documents")
      .select("submission_id")
      .in("submission_id", submissionIds);
    if (error) throw error;

    for (const document of documents ?? []) {
      documentCounts.set(
        document.submission_id,
        (documentCounts.get(document.submission_id) ?? 0) + 1,
      );
    }
  }

  const items: AdminVerificationQueueItem[] = (submissions ?? []).map(
    (submission) => ({
      id: submission.id,
      agencyName:
        agenciesById.get(submission.agency_id) ?? "Agency profile unavailable",
      status: submission.status as AdminVerificationQueueItem["status"],
      submittedAt: submission.submitted_at,
      documentCount: documentCounts.get(submission.id) ?? 0,
    }),
  );

  return <AdminVerificationQueue items={items} />;
}
