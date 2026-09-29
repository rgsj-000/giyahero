import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  getE2EAdminClient,
  provisionE2EUser,
  removeE2EUser,
  signInThroughUi,
} from "./helpers/verification-auth";

type Identity = Awaited<ReturnType<typeof provisionE2EUser>>;
type PlatformRole =
  | "super_admin"
  | "agency_verifier"
  | "moderator"
  | "support"
  | "finance"
  | "content_admin";

type SubmittedAgencyFixture = {
  agencyId: string;
  submissionId: string;
  agencyName: string;
  contactEmail: string;
  storagePaths: string[];
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for admin verification E2E`);
  return value;
}

async function createUserClient(identity: Identity) {
  const client = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({
    email: identity.email,
    password: identity.password,
  });
  if (error) throw error;
  return client;
}

async function grantPlatformRole(userId: string, role: PlatformRole) {
  const { error } = await getE2EAdminClient()
    .from("platform_admin_memberships")
    .insert({ user_id: userId, role });
  if (error) throw error;
}

async function seedSubmittedAgency(
  ownerId: string,
  label: string,
): Promise<SubmittedAgencyFixture> {
  const admin = getE2EAdminClient();
  const suffix = randomUUID().slice(0, 8);
  const slug = `${label}-${suffix}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const contactEmail = `${slug}@example.test`;
  const { data: agency, error: agencyError } = await admin
    .from("agencies")
    .insert({
      name: label,
      legal_name: `${label} Travel and Tours`,
      slug,
      contact_email: contactEmail,
      contact_phone: "+63 917 555 0101",
      website_url: "https://example.test",
      description: "Quezon travel agency verification fixture.",
      status: "submitted",
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (agencyError || !agency) {
    throw agencyError ?? new Error("failed to seed agency");
  }

  const { error: membershipError } = await admin.from("agency_members").insert({
    agency_id: agency.id,
    user_id: ownerId,
    role: "owner",
  });
  if (membershipError) throw membershipError;

  const { data: submission, error: submissionError } = await admin
    .from("agency_verification_submissions")
    .insert({
      agency_id: agency.id,
      status: "submitted",
      submitted_by: ownerId,
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (submissionError || !submission) {
    throw submissionError ?? new Error("failed to seed submission");
  }

  const documentTypes = [
    "business_registration",
    "business_permit",
    "authorized_representative_id",
  ] as const;
  const storagePaths: string[] = [];

  for (const documentType of documentTypes) {
    const documentId = randomUUID();
    const storagePath = `agency/${agency.id}/${submission.id}/${documentType}/${documentId}-${documentType}.pdf`;
    const bytes = Buffer.from(`%PDF-1.4\n${label} ${documentType}\n`);
    const { error: uploadError } = await admin.storage
      .from("agency-verification")
      .upload(storagePath, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { error: documentError } = await admin
      .from("agency_verification_documents")
      .insert({
        id: documentId,
        submission_id: submission.id,
        agency_id: agency.id,
        document_type: documentType,
        storage_path: storagePath,
        original_name: `${documentType}.pdf`,
        mime_type: "application/pdf",
        size_bytes: bytes.length,
        uploaded_by: ownerId,
      });
    if (documentError) throw documentError;
    storagePaths.push(storagePath);
  }

  return {
    agencyId: agency.id,
    submissionId: submission.id,
    agencyName: label,
    contactEmail,
    storagePaths,
  };
}

async function cleanupFixture(fixture: SubmittedAgencyFixture) {
  const admin = getE2EAdminClient();
  await admin.storage.from("agency-verification").remove(fixture.storagePaths);
  const { error } = await admin
    .from("agencies")
    .delete()
    .eq("id", fixture.agencyId);
  if (error) throw error;
}

test("agency verifier sees submitted applications in the queue", async ({
  page,
}) => {
  const owner = await provisionE2EUser("admin-queue-owner");
  const verifier = await provisionE2EUser("admin-queue-verifier");
  const fixture = await seedSubmittedAgency(owner.id, "Marinduque View Tours");

  try {
    await grantPlatformRole(verifier.id, "agency_verifier");
    await signInThroughUi(page, verifier);
    await page.goto("/admin/verifications");

    await expect(
      page.getByRole("heading", { name: /agency verifications/i }),
    ).toBeVisible();
    await expect(page.getByText(fixture.agencyName)).toBeVisible();
    await expect(page.getByText(/^Submitted$/)).toBeVisible();
    await expect(page.getByText(/3 documents/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /review/i }),
    ).toHaveAttribute("href", `/admin/verifications/${fixture.submissionId}`);
  } finally {
    await cleanupFixture(fixture);
    await Promise.all([
      removeE2EUser(owner.id),
      removeE2EUser(verifier.id),
    ]);
  }
});

test("super admin can access the verification queue", async ({ page }) => {
  const owner = await provisionE2EUser("admin-queue-super-owner");
  const superAdmin = await provisionE2EUser("admin-queue-super-admin");
  const fixture = await seedSubmittedAgency(owner.id, "Pacific Trail Tours");

  try {
    await grantPlatformRole(superAdmin.id, "super_admin");
    await signInThroughUi(page, superAdmin);
    await page.goto("/admin/verifications");

    await expect(page.getByText(fixture.agencyName)).toBeVisible();
  } finally {
    await cleanupFixture(fixture);
    await Promise.all([
      removeE2EUser(owner.id),
      removeE2EUser(superAdmin.id),
    ]);
  }
});

test("moderator cannot access the verification queue", async ({ page }) => {
  const moderator = await provisionE2EUser("admin-queue-moderator");

  try {
    await grantPlatformRole(moderator.id, "moderator");
    await signInThroughUi(page, moderator);
    await page.goto("/admin/verifications");

    await expect(page).not.toHaveURL(/\/admin\/verifications\/?$/);
  } finally {
    await removeE2EUser(moderator.id);
  }
});

test("ordinary authenticated user cannot access the verification queue", async ({
  page,
}) => {
  const user = await provisionE2EUser("admin-queue-ordinary");

  try {
    await signInThroughUi(page, user);
    await page.goto("/admin/verifications");

    await expect(page).not.toHaveURL(/\/admin\/verifications\/?$/);
  } finally {
    await removeE2EUser(user.id);
  }
});

test("anonymous visitor cannot access the verification queue", async ({ page }) => {
  await page.goto("/admin/verifications");
  await expect(page).toHaveURL(/\/login\?/);
});

test("verifier can start review and reject with a required reason", async ({
  browser,
  page,
}) => {
  const owner = await provisionE2EUser("admin-reject-owner");
  const verifier = await provisionE2EUser("admin-reject-verifier");
  const fixture = await seedSubmittedAgency(owner.id, "Reject Scenario Tours");

  try {
    await grantPlatformRole(verifier.id, "agency_verifier");
    await signInThroughUi(page, verifier);
    await page.goto(`/admin/verifications/${fixture.submissionId}`);

    await expect(page.getByText(fixture.agencyName)).toBeVisible();
    await expect(page.getByText(fixture.contactEmail)).toBeVisible();
    await expect(page.getByText(/submitted/i)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Business Registration$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Current Business Permit$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Authorized Representative ID$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /view document/i }),
    ).toHaveCount(3);

    await page.getByRole("button", { name: /start review/i }).click();
    await expect(page.getByText(/^Under review$/)).toBeVisible();

    const reason = page.getByLabel(/rejection reason/i);
    const reject = page.getByRole("button", { name: /^Reject Agency$/i });
    await reason.fill("   ");
    await expect(reject).toBeDisabled();
    await reason.fill("Business permit details require correction.");
    await expect(reject).toBeEnabled();
    await reject.click();

    await expect(page.getByText(/^Rejected$/)).toBeVisible();
    await expect(
      page.getByText("Business permit details require correction."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /start review/i })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: /verify agency/i })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: /^Reject Agency$/i })).toHaveCount(
      0,
    );

    const verifierClient = await createUserClient(verifier);
    const { error: staleDecisionError } = await verifierClient.rpc(
      "decide_agency_verification",
      {
        target_submission_id: fixture.submissionId,
        target_decision: "verified",
        target_notes: null,
      },
    );
    expect(staleDecisionError).not.toBeNull();

    const ownerPage = await browser.newPage();
    await signInThroughUi(ownerPage, owner);
    await ownerPage.goto(`/agency/${fixture.agencyId}/verification`);
    await expect(ownerPage.getByText(/^Rejected$/)).toBeVisible();
    await expect(
      ownerPage.getByText("Business permit details require correction."),
    ).toBeVisible();
    await ownerPage.close();
  } finally {
    await cleanupFixture(fixture);
    await Promise.all([
      removeE2EUser(owner.id),
      removeE2EUser(verifier.id),
    ]);
  }
});

test("verifier explicitly confirms approval and agency becomes verified", async ({
  browser,
  page,
}) => {
  const owner = await provisionE2EUser("admin-approve-owner");
  const verifier = await provisionE2EUser("admin-approve-verifier");
  const fixture = await seedSubmittedAgency(owner.id, "Approval Scenario Tours");

  try {
    await grantPlatformRole(verifier.id, "agency_verifier");
    await signInThroughUi(page, verifier);
    await page.goto(`/admin/verifications/${fixture.submissionId}`);

    await page.getByRole("button", { name: /start review/i }).click();
    await expect(page.getByText(/^Under review$/)).toBeVisible();

    await page.getByRole("button", { name: /^Verify Agency$/i }).click();
    const confirm = page.getByRole("button", { name: /^Confirm Verification$/i });
    await expect(confirm).toBeVisible();
    await confirm.click();

    await expect(page.getByText(/^Verified$/)).toBeVisible();
    await expect(page.getByRole("button", { name: /verify agency/i })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: /^Reject Agency$/i })).toHaveCount(
      0,
    );

    const verifierClient = await createUserClient(verifier);
    const { error: staleDecisionError } = await verifierClient.rpc(
      "decide_agency_verification",
      {
        target_submission_id: fixture.submissionId,
        target_decision: "rejected",
        target_notes: "A stale second decision must not win.",
      },
    );
    expect(staleDecisionError).not.toBeNull();

    const ownerPage = await browser.newPage();
    await signInThroughUi(ownerPage, owner);
    await ownerPage.goto(`/agency/${fixture.agencyId}/verification`);
    await expect(ownerPage.getByText(/^Verified$/)).toBeVisible();
    await expect(ownerPage.getByText(/agency verified by giyahero/i)).toBeVisible();
    await ownerPage.close();
  } finally {
    await cleanupFixture(fixture);
    await Promise.all([
      removeE2EUser(owner.id),
      removeE2EUser(verifier.id),
    ]);
  }
});
