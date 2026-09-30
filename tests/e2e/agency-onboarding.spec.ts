import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  getE2EAdminClient,
  provisionE2EUser,
  removeE2EUser,
  signInThroughUi,
} from "./helpers/verification-auth";

const pdf = (name: string) => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\nGiyaHero verification journey fixture\n"),
});

async function cleanupAgency(agencyId: string) {
  const admin = getE2EAdminClient();
  const { data: documents, error: documentError } = await admin
    .from("agency_verification_documents")
    .select("storage_path")
    .eq("agency_id", agencyId);
  if (documentError) throw documentError;

  const storagePaths = (documents ?? []).map(
    (document) => document.storage_path,
  );
  if (storagePaths.length) {
    const { error: storageError } = await admin.storage
      .from("agency-verification")
      .remove(storagePaths);
    if (storageError) throw storageError;
  }

  const { error } = await admin.from("agencies").delete().eq("id", agencyId);
  if (error) throw error;
}

test("agency can open the onboarding screen", async ({ page }) => {
  await page.goto("/agency/onboarding");

  await expect(
    page.getByRole("heading", { name: /register your travel agency/i }),
  ).toBeVisible();
  await expect(page.getByLabel(/^agency name$/i)).toBeVisible();
  await expect(page.getByLabel(/legal or business name/i)).toBeVisible();
  await expect(page.getByLabel(/public url slug/i)).toBeVisible();
  await expect(page.getByLabel(/contact email/i)).toBeVisible();
  await expect(page.getByLabel(/contact phone/i)).toBeVisible();
  await expect(page.getByLabel(/website/i)).toBeVisible();
  await expect(page.getByLabel(/about your agency/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /create agency workspace/i }),
  ).toBeVisible();
  await expect(page.getByText(/verification comes next/i)).toBeVisible();
});

test("agency onboarding continues through verification approval", async ({
  browser,
  page,
}) => {
  const owner = await provisionE2EUser("verification-journey-owner");
  const verifier = await provisionE2EUser("verification-journey-verifier");
  const suffix = randomUUID().slice(0, 8);
  const agencyName = `Journey Quezon Tours ${suffix}`;
  let agencyId: string | null = null;
  let verifierPage: Page | null = null;

  try {
    const admin = getE2EAdminClient();
    const { error: roleError } = await admin
      .from("platform_admin_memberships")
      .insert({ user_id: verifier.id, role: "agency_verifier" });
    if (roleError) throw roleError;

    await signInThroughUi(page, owner);
    await page.goto("/agency/onboarding");

    await page.getByLabel(/^agency name$/i).fill(agencyName);
    await page
      .getByLabel(/legal or business name/i)
      .fill(`${agencyName} Travel and Tours`);
    await page.getByLabel(/contact email/i).fill(owner.email);
    await page.getByLabel(/contact phone/i).fill("+63 917 555 0188");
    await page
      .getByLabel(/website/i)
      .fill("https://journey-quezon.example.test");
    await page
      .getByLabel(/about your agency/i)
      .fill("A full GiyaHero agency verification journey fixture.");

    await page
      .getByRole("button", { name: /create agency workspace/i })
      .click();
    await expect(page).toHaveURL(
      /\/agency\/[0-9a-f-]{36}\/verification$/i,
    );

    const agencyIdMatch = page
      .url()
      .match(/\/agency\/([0-9a-f-]{36})\/verification$/i);
    if (!agencyIdMatch) throw new Error("agency verification redirect missing");
    agencyId = agencyIdMatch[1];

    await expect(
      page.getByRole("heading", { name: /agency verification/i }),
    ).toBeVisible();
    const submit = page.getByRole("button", {
      name: /submit for verification/i,
    });
    await expect(submit).toBeDisabled();

    await page
      .getByLabel(/upload business registration/i)
      .setInputFiles(pdf("Journey DTI Registration.pdf"));
    await page
      .getByLabel(/upload current business permit/i)
      .setInputFiles(pdf("Journey Business Permit.pdf"));
    await page
      .getByLabel(/upload authorized representative id/i)
      .setInputFiles(pdf("Journey Representative ID.pdf"));
    await expect(submit).toBeEnabled();

    await submit.click();
    await expect(page.getByText(/^Submitted$/)).toBeVisible();

    const { data: submission, error: submissionError } = await admin
      .from("agency_verification_submissions")
      .select("id,status")
      .eq("agency_id", agencyId)
      .single();
    if (submissionError || !submission) {
      throw submissionError ?? new Error("verification submission missing");
    }
    expect(submission.status).toBe("submitted");

    verifierPage = await browser.newPage();
    await signInThroughUi(verifierPage, verifier);
    await verifierPage.goto(`/admin/verifications/${submission.id}`);

    await verifierPage
      .getByRole("button", { name: /start review/i })
      .click();
    await expect(verifierPage.getByText(/^Under review$/)).toBeVisible();

    await verifierPage
      .getByRole("button", { name: /^Verify Agency$/i })
      .click();
    await verifierPage
      .getByRole("button", { name: /^Confirm Verification$/i })
      .click();
    await expect(verifierPage.getByText(/^Verified$/)).toBeVisible();

    await page.reload();
    await expect(page.getByText(/^Verified$/)).toBeVisible();
    await expect(page.getByText(/agency verified by giyahero/i)).toBeVisible();
  } finally {
    if (verifierPage) await verifierPage.close();
    if (agencyId) await cleanupAgency(agencyId);
    await Promise.all([removeE2EUser(owner.id), removeE2EUser(verifier.id)]);
  }
});
