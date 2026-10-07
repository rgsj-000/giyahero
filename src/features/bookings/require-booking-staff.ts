import "server-only";
import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "../../infrastructure/supabase/server";
export async function requireBookingStaff(
  agencyId: string,
  returnPath: string,
) {
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login?next=" + encodeURIComponent(returnPath));
  const { data, error } = await client.rpc("has_agency_role", {
    target_agency_id: agencyId,
    allowed_roles: ["owner", "manager", "booking_staff"],
  });
  if (error || !data) notFound();
}
