import { randomUUID } from "node:crypto";
import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { parseEnv } from "@/infrastructure/config/env";

const env = parseEnv(process.env);

export type AgencyMemberRole =
  | "owner"
  | "manager"
  | "booking_staff"
  | "content_staff"
  | "read_only";

export type PlatformAdminRole =
  | "super_admin"
  | "agency_verifier"
  | "moderator"
  | "support"
  | "finance"
  | "content_admin";

const adminClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function createPublicClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function safeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function createAnonymousClient(): SupabaseClient {
  return createPublicClient();
}

export function getAdminClient(): SupabaseClient {
  return adminClient;
}

export async function createTestIdentity(label: string): Promise<{
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}> {
  const nonce = randomUUID().replaceAll("-", "").slice(0, 12);
  const email = `${safeLabel(label) || "verification"}-${nonce}@example.test`;
  const password = `Test-${nonce}-Aa1!`;

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: label },
  });

  if (error || !data.user) {
    throw error ?? new Error("Unable to create verification test user");
  }

  const client = createPublicClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    await adminClient.auth.admin.deleteUser(data.user.id);
    throw signInError;
  }

  return { id: data.user.id, email, password, client };
}

export async function createAgencyFixture(
  ownerUserId: string,
  label: string,
): Promise<string> {
  const nonce = randomUUID().replaceAll("-", "").slice(0, 10);
  const slugBase = safeLabel(label) || "verification-agency";

  const { data: agency, error: agencyError } = await adminClient
    .from("agencies")
    .insert({
      name: label,
      legal_name: `${label} Legal Name`,
      slug: `${slugBase}-${nonce}`,
      contact_email: `${slugBase}-${nonce}@example.test`,
      created_by: ownerUserId,
    })
    .select("id")
    .single();

  if (agencyError || !agency) {
    throw agencyError ?? new Error("Unable to create agency fixture");
  }

  const { error: memberError } = await adminClient.from("agency_members").insert({
    agency_id: agency.id,
    user_id: ownerUserId,
    role: "owner",
  });

  if (memberError) {
    await adminClient.from("agencies").delete().eq("id", agency.id);
    throw memberError;
  }

  return agency.id as string;
}

export async function addAgencyMember(
  agencyId: string,
  userId: string,
  role: AgencyMemberRole,
): Promise<void> {
  const { error } = await adminClient.from("agency_members").insert({
    agency_id: agencyId,
    user_id: userId,
    role,
  });

  if (error) throw error;
}

export async function grantPlatformRole(
  userId: string,
  role: PlatformAdminRole,
): Promise<void> {
  const { error } = await adminClient.from("platform_admin_memberships").insert({
    user_id: userId,
    role,
  });

  if (error) throw error;
}

export async function deleteTestIdentity(userId: string): Promise<void> {
  await adminClient.from("agencies").delete().eq("created_by", userId);
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) throw error;
}
