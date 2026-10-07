import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  CatalogCard,
  CatalogDetail,
  CatalogFilters,
} from "../../modules/catalog/types";

const filtersSchema = z.object({
  destinationId: z.uuid().optional(),
  maxBudgetMinor: z.number().int().nonnegative().safe().optional(),
  travelers: z.number().int().min(1).max(32767).optional(),
  startsOn: z.iso.date().optional(),
  cursor: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export async function listPublishedPackages(
  client: SupabaseClient,
  filters: CatalogFilters,
): Promise<{ items: CatalogCard[]; nextCursor: string | null }> {
  const { data, error } = await client.rpc("search_published_packages", {
    filters: filtersSchema.parse(filters),
  });
  if (error) throw new Error(error.message);
  if (!data || !Array.isArray(data.items))
    throw new Error("The catalog returned an invalid response.");
  return data;
}
export async function getPackageDetail(
  client: SupabaseClient,
  id: string,
): Promise<CatalogDetail | null> {
  const { data, error } = await client.rpc("get_public_package_detail", {
    target_package_id: z.uuid().parse(id),
  });
  if (error) throw new Error(error.message);
  return data ?? null;
}
export async function catalogImageUrl(
  client: SupabaseClient,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await client.storage
    .from("package-media")
    .createSignedUrl(path, 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
