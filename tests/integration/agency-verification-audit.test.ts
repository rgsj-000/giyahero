import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addAgencyMember,
  createAgencyFixture,
  createTestIdentity,
  deleteTestIdentity,
  getAdminClient,
} from "./helpers/verification-fixtures";

type TestIdentity = Awaited<ReturnType<typeof createTestIdentity>>;

const admin = getAdminClient();
let owner: TestIdentity;
let manager: TestIdentity;

beforeAll(async () => {
  owner = await createTestIdentity("verification audit owner");
  manager = await createTestIdentity("verification audit manager");
});

afterAll(async () => {
  await deleteTestIdentity(owner.id);
  await deleteTestIdentity(manager.id);
});

describe("agency verification audit trail", () => {
  it("records the user who formally submits the application", async () => {
    const agencyId = await createAgencyFixture(
      owner.id,
      "Submitter audit agency",
    );
    await addAgencyMember(agencyId, manager.id, "manager");

    const { data: submissionId, error: draftError } = await owner.client.rpc(
      "create_verification_draft",
      { target_agency_id: agencyId },
    );
    expect(draftError).toBeNull();
    expect(typeof submissionId).toBe("string");

    for (const documentType of [
      "business_registration",
      "business_permit",
      "authorized_representative_id",
    ]) {
      const documentId = randomUUID();
      const filename = `${documentType}.pdf`;
      const { error } = await owner.client.rpc(
        "register_verification_document",
        {
          target_submission_id: submissionId,
          target_document_id: documentId,
          target_document_type: documentType,
          target_storage_path: `agency/${agencyId}/${submissionId}/${documentId}/${filename}`,
          target_original_name: filename,
          target_mime_type: "application/pdf",
          target_size_bytes: 128,
        },
      );
      expect(error).toBeNull();
    }

    const { error: submitError } = await manager.client.rpc(
      "submit_agency_verification",
      { target_submission_id: submissionId },
    );
    expect(submitError).toBeNull();

    const { data: submission, error: readError } = await admin
      .from("agency_verification_submissions")
      .select("submitted_by,submitted_at,status")
      .eq("id", submissionId)
      .single();

    expect(readError).toBeNull();
    expect(submission?.status).toBe("submitted");
    expect(submission?.submitted_at).toBeTruthy();
    expect(submission?.submitted_by).toBe(manager.id);
  });
});
