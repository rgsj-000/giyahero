import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseEnv } from "@/infrastructure/config/env";

const env = parseEnv(process.env);

export type AgencyMemberRole =
  "owner" | "manager" | "booking_staff" | "content_staff" | "read_only";

export type PlatformAdminRole =
  | "super_admin"
  | "agency_verifier"
  | "moderator"
  | "support"
  | "finance"
  | "content_admin";

export const verificationAdminClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export function createAnonymousTestClient(): SupabaseClient {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function createTestIdentity(label: string): Promise<{
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}> {
  const suffix = randomUUID();
  const email = `${label}-${suffix}@example.test`;
  const password = `Test-${suffix}-Aa1!`;

  const { data, error } = await verificationAdminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw error ?? new Error("Could not create verification test identity");
  }

  const client = createAnonymousTestClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    await verificationAdminClient.auth.admin.deleteUser(data.user.id);
    throw signInError;
  }

  return { id: data.user.id, email, password, client };
}

export async function createAgencyFixture(
  ownerUserId: string,
  label: string,
): Promise<string> {
  const slug = `${label}-${randomUUID()}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const { data, error } = await verificationAdminClient
    .from("agencies")
    .insert({
      name: `${label} Travel Agency`,
      legal_name: `${label} Travel Agency`,
      slug,
      contact_email: `${label}@example.test`,
      created_by: ownerUserId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Could not create verification test agency");
  }

  const { error: membershipError } = await verificationAdminClient
    .from("agency_members")
    .insert({ agency_id: data.id, user_id: ownerUserId, role: "owner" });

  if (membershipError) {
    throw membershipError;
  }

  return data.id as string;
}

export async function addAgencyMember(
  agencyId: string,
  userId: string,
  role: AgencyMemberRole,
): Promise<void> {
  const { error } = await verificationAdminClient
    .from("agency_members")
    .insert({
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
  const { error } = await verificationAdminClient
    .from("platform_admin_memberships")
    .insert({ user_id: userId, role });

  if (error) throw error;
}

export async function deleteTestIdentity(userId: string): Promise<void> {
  const { error } = await verificationAdminClient.auth.admin.deleteUser(userId);
  if (error) throw error;
}
