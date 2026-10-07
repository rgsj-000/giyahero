import type { SupabaseClient } from "@supabase/supabase-js";
import type { PackageDraftInput } from "../../modules/catalog/types";
async function call<T>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export function savePackageDraft(
  client: SupabaseClient,
  agencyId: string,
  packageId: string | null,
  version: number | null,
  input: PackageDraftInput,
): Promise<string> {
  return call(client, "save_package_draft", {
    target_agency_id: agencyId,
    target_package_id: packageId,
    expected_version: version,
    package_input: input,
  });
}
export function submitPackageReview(
  client: SupabaseClient,
  packageId: string,
  version: number,
): Promise<void> {
  return call(client, "submit_package_review", {
    target_package_id: packageId,
    expected_version: version,
  });
}
export function reviewPackage(
  client: SupabaseClient,
  packageId: string,
  version: number,
  approve: boolean,
  reviewNote: string,
): Promise<void> {
  return call(client, "review_package", {
    target_package_id: packageId,
    expected_version: version,
    approve,
    review_note: reviewNote,
  });
}
export function setPackagePublication(
  client: SupabaseClient,
  packageId: string,
  version: number,
  status: "published" | "unpublished" | "archived",
): Promise<void> {
  return call(client, "set_package_publication", {
    target_package_id: packageId,
    expected_version: version,
    target_status: status,
  });
}
export function getPackageDraft(
  client: SupabaseClient,
  packageId: string,
): Promise<{
  input: PackageDraftInput;
  version: number;
  status: string;
  firstReviewedAt: string | null;
}> {
  return call(client, "get_package_draft", { target_package_id: packageId });
}
export async function listAgencyPackages(
  client: SupabaseClient,
  agencyId: string,
): Promise<{ id: string; title: string; version: number; status: string }[]> {
  const { data, error } = await client
    .from("packages")
    .select("id,title,version,publication_status")
    .eq("agency_id", agencyId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    version: p.version,
    status: p.publication_status,
  }));
}
export async function listMyAgencies(
  client: SupabaseClient,
): Promise<{ id: string; name: string; role: string }[]> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError) throw new Error(authError.message);
  if (!user) return [];
  const { data, error } = await client
    .from("agency_members")
    .select("agency_id,role,agencies(name)")
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.agency_id,
    name: (p.agencies as unknown as { name: string }).name,
    role: p.role,
  }));
}
