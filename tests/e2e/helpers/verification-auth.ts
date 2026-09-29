import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for verification E2E tests`);
  return value;
}

function createE2EAdminClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function provisionE2EUser(label: string): Promise<{
  id: string;
  email: string;
  password: string;
}> {
  const suffix = randomUUID();
  const email = `${label}-${suffix}@example.test`;
  const password = `GiyaHero-${suffix}!`;
  const admin = createE2EAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: label },
  });

  if (error || !data.user) {
    throw error ?? new Error("failed to create E2E user");
  }

  return { id: data.user.id, email, password };
}

export async function signInThroughUi(
  page: Page,
  identity: { email: string; password: string },
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/^email$/i).fill(identity.email);
  await page.getByLabel(/^password$/i).fill(identity.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

export async function removeE2EUser(userId: string): Promise<void> {
  const { error } = await createE2EAdminClient().auth.admin.deleteUser(userId);
  if (error) throw error;
}

export function getE2EAdminClient() {
  return createE2EAdminClient();
}
