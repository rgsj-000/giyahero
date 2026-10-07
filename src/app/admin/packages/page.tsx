import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server";
import { WebPublicationReview } from "@/features/catalog/web-publication-review";
export default async function Page() {
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Fpackages");
  const { data, error } = await client
    .from("platform_admin_memberships")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["content_admin", "super_admin"])
    .limit(1);
  if (error) throw error;
  if (!data?.length) redirect("/");
  return <WebPublicationReview />;
}
