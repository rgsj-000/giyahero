import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server";
import { WebAgencyWorkspace } from "@/features/catalog/web-agency-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ agencyId: string }>;
}) {
  const { agencyId } = await params;
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    redirect(
      "/login?next=" + encodeURIComponent("/agency/" + agencyId + "/packages"),
    );
  return <WebAgencyWorkspace agencyId={agencyId} />;
}
