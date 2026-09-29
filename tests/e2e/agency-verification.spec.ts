import { expect, test } from "@playwright/test";
import {
  getE2EAdminClient,
  provisionE2EUser,
  removeE2EUser,
  signInThroughUi,
} from "./helpers/verification-auth";

async function createAgencyForUser(userId: string, label: string) {
  const admin = getE2EAdminClient();
  const slug = `${label}-${crypto.randomUUID().slice(0, 8)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const { data, error } = await admin
    .from("agencies")
    .insert({
      name: label,
      legal_name: `${label} Travel and Tours`,
      slug,
      contact_email: `${slug}@example.test`,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !data) throw error ?? new Error("failed to seed agency");

  const { error: memberError } = await admin.from("agency_members").insert({
    agency_id: data.id,
    user_id: userId,
    role: "owner",
  });
  if (memberError) throw memberError;

  return data.id as string;
}

async function deleteAgency(agencyId: string) {
  const { error } = await getE2EAdminClient()
    .from("agencies")
    .delete()
    .eq("id", agencyId);
  if (error) throw error;
}

const pdf = (name: string) => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\nGiyaHero verification fixture\n"),
});

test("owner prepares, edits, and submits agency verification", async ({
  page,
}) => {
  const owner = await provisionE2EUser("agency-verification-owner");
  const agencyId = await createAgencyForUser(
    owner.id,
    "North Star Quezon Tours",
  );

  try {
    await signInThroughUi(page, owner);
    await page.goto(`/agency/${agencyId}/verification`);

    await expect(
      page.getByRole("heading", { name: /agency verification/i }),
    ).toBeVisible();
    await expect(page.getByText("Business Registration")).toBeVisible();
    await expect(page.getByText("Current Business Permit")).toBeVisible();
    await expect(page.getByText("Authorized Representative ID")).toBeVisible();
    await expect(page.getByText("DOT Accreditation")).toBeVisible();
    await expect(page.getByText("Optional")).toBeVisible();

    const submit = page.getByRole("button", {
      name: /submit for verification/i,
    });
    await expect(submit).toBeDisabled();

    await page
      .getByLabel(/upload business registration/i)
      .setInputFiles(pdf("DTI Registration.pdf"));
    await page
      .getByLabel(/upload current business permit/i)
      .setInputFiles(pdf("../../Mayor's Permit 2026.PDF"));
    await page
      .getByLabel(/upload authorized representative id/i)
      .setInputFiles(pdf("Authorized Representative.pdf"));

    await expect(page.getByText("DTI Registration.pdf")).toBeVisible();
    await expect(page.getByText("Mayor's Permit 2026.PDF")).toBeVisible();
    await expect(page.getByText("Authorized Representative.pdf")).toBeVisible();
    await expect(submit).toBeEnabled();

    const admin = getE2EAdminClient();
    const { data: permitDocument, error: permitError } = await admin
      .from("agency_verification_documents")
      .select("storage_path")
      .eq("agency_id", agencyId)
      .eq("document_type", "business_permit")
      .single();
    expect(permitError).toBeNull();
    expect(permitDocument?.storage_path).toMatch(
      new RegExp(
        `^agency/${agencyId}/[0-9a-f-]+/business_permit/[0-9a-f-]+-Mayor-s-Permit-2026\\.pdf$`,
        "i",
      ),
    );

    const registrationCard = page.getByTestId(
      "verification-business_registration",
    );
    await registrationCard.getByRole("button", { name: /remove/i }).click();
    await expect(submit).toBeDisabled();

    await registrationCard
      .getByLabel(/upload business registration/i)
      .setInputFiles(pdf("DTI Registration Replacement.pdf"));
    await expect(submit).toBeEnabled();

    await submit.click();
    await expect(page.getByText(/^Submitted$/)).toBeVisible();
    await expect(submit).toBeHidden();
    await expect(page.getByRole("button", { name: /remove/i })).toHaveCount(0);
  } finally {
    await deleteAgency(agencyId);
    await removeE2EUser(owner.id);
  }
});

test("non-manager agency member cannot access verification evidence", async ({
  page,
}) => {
  const owner = await provisionE2EUser("agency-verification-owner-access");
  const staff = await provisionE2EUser("agency-verification-booking-staff");
  const agencyId = await createAgencyForUser(owner.id, "Access Boundary Tours");
  const admin = getE2EAdminClient();

  try {
    const { error } = await admin.from("agency_members").insert({
      agency_id: agencyId,
      user_id: staff.id,
      role: "booking_staff",
    });
    if (error) throw error;

    await signInThroughUi(page, staff);
    await page.goto(`/agency/${agencyId}/verification`);

    await expect(page).not.toHaveURL(`/agency/${agencyId}/verification`);
    await expect(page.getByText(/business registration/i)).toHaveCount(0);
  } finally {
    await deleteAgency(agencyId);
    await Promise.all([removeE2EUser(owner.id), removeE2EUser(staff.id)]);
  }
});
