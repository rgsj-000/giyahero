import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addAgencyMember,
  createAgencyFixture,
  createAnonymousClient,
  createTestIdentity,
  deleteTestIdentity,
  getAdminClient,
  grantPlatformRole,
} from "./helpers/verification-fixtures";

type TestIdentity = Awaited<ReturnType<typeof createTestIdentity>>;

const bucketName = "agency-verification";
const admin = getAdminClient();
const uploadedPaths = new Set<string>();

let owner: TestIdentity;
let manager: TestIdentity;
let bookingStaff: TestIdentity;
let unrelated: TestIdentity;
let verifier: TestIdentity;
let superAdmin: TestIdentity;
let moderator: TestIdentity;

let agencyId: string;
let submissionId: string;

function buildPath(
  targetAgencyId: string,
  targetSubmissionId: string,
  filename = "document.pdf",
) {
  return `agency/${targetAgencyId}/${targetSubmissionId}/${randomUUID()}/${filename}`;
}

async function uploadPdf(
  client: TestIdentity["client"],
  path: string,
) {
  const result = await client.storage.from(bucketName).upload(
    path,
    new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    { contentType: "application/pdf", upsert: false },
  );
  if (!result.error) uploadedPaths.add(path);
  return result;
}

beforeAll(async () => {
  owner = await createTestIdentity("storage owner");
  manager = await createTestIdentity("storage manager");
  bookingStaff = await createTestIdentity("storage booking staff");
  unrelated = await createTestIdentity("storage unrelated");
  verifier = await createTestIdentity("storage verifier");
  superAdmin = await createTestIdentity("storage super admin");
  moderator = await createTestIdentity("storage moderator");

  agencyId = await createAgencyFixture(owner.id, "Storage policy agency");
  await addAgencyMember(agencyId, manager.id, "manager");
  await addAgencyMember(agencyId, bookingStaff.id, "booking_staff");
  await grantPlatformRole(verifier.id, "agency_verifier");
  await grantPlatformRole(superAdmin.id, "super_admin");
  await grantPlatformRole(moderator.id, "moderator");

  const { data, error } = await owner.client.rpc("create_verification_draft", {
    target_agency_id: agencyId,
  });
  if (error || typeof data !== "string") {
    throw error ?? new Error("Unable to create storage test draft");
  }
  submissionId = data;
});

afterAll(async () => {
  if (uploadedPaths.size > 0) {
    await admin.storage.from(bucketName).remove([...uploadedPaths]);
  }

  await deleteTestIdentity(owner.id);
  await deleteTestIdentity(manager.id);
  await deleteTestIdentity(bookingStaff.id);
  await deleteTestIdentity(unrelated.id);
  await deleteTestIdentity(verifier.id);
  await deleteTestIdentity(superAdmin.id);
  await deleteTestIdentity(moderator.id);
});

describe("agency verification storage", () => {
  it("creates one private 10 MiB evidence bucket with the supported MIME types", async () => {
    const { data: buckets, error } = await admin.storage.listBuckets();
    expect(error).toBeNull();

    const bucket = buckets?.find(({ id }) => id === bucketName);
    expect(bucket).toMatchObject({
      id: bucketName,
      name: bucketName,
      public: false,
      file_size_limit: 10 * 1024 * 1024,
    });
    expect(bucket?.allowed_mime_types).toEqual(
      expect.arrayContaining([
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
      ]),
    );
  });

  it("allows only owners and managers to upload into their own draft path", async () => {
    const ownerPath = buildPath(agencyId, submissionId, "owner.pdf");
    const managerPath = buildPath(agencyId, submissionId, "manager.pdf");

    expect((await uploadPdf(owner.client, ownerPath)).error).toBeNull();
    expect((await uploadPdf(manager.client, managerPath)).error).toBeNull();

    for (const client of [bookingStaff.client, unrelated.client]) {
      const denied = await uploadPdf(
        client,
        buildPath(agencyId, submissionId, "denied.pdf"),
      );
      expect(denied.error).not.toBeNull();
    }

    const anonymous = createAnonymousClient();
    const anonymousResult = await anonymous.storage
      .from(bucketName)
      .upload(
        buildPath(agencyId, submissionId, "anonymous.pdf"),
        new Uint8Array([1]),
        { contentType: "application/pdf" },
      );
    expect(anonymousResult.error).not.toBeNull();
  });

  it("denies malformed and cross-agency paths without unsafe UUID cast errors", async () => {
    const otherAgencyId = await createAgencyFixture(
      unrelated.id,
      "Other storage agency",
    );
    const { data: otherSubmissionId, error: draftError } =
      await unrelated.client.rpc("create_verification_draft", {
        target_agency_id: otherAgencyId,
      });
    expect(draftError).toBeNull();
    expect(typeof otherSubmissionId).toBe("string");

    const crossAgency = await uploadPdf(
      owner.client,
      buildPath(otherAgencyId, otherSubmissionId as string, "cross.pdf"),
    );
    expect(crossAgency.error).not.toBeNull();

    const malformed = await uploadPdf(
      owner.client,
      "agency/not-a-uuid/not-a-submission/not-an-upload/document.pdf",
    );
    expect(malformed.error).not.toBeNull();
    expect(malformed.error?.message.toLowerCase()).not.toContain(
      "invalid input syntax for type uuid",
    );
  });

  it("keeps submitted evidence readable but immutable to the agency and readable to verifiers", async () => {
    const reviewAgencyId = await createAgencyFixture(owner.id, "Review storage agency");
    const { data: reviewSubmissionId, error: draftError } =
      await owner.client.rpc("create_verification_draft", {
        target_agency_id: reviewAgencyId,
      });
    expect(draftError).toBeNull();
    expect(typeof reviewSubmissionId).toBe("string");

    let firstPath = "";
    for (const documentType of [
      "business_registration",
      "business_permit",
      "authorized_representative_id",
    ]) {
      const documentId = randomUUID();
      const path = `agency/${reviewAgencyId}/${reviewSubmissionId}/${documentId}/${documentType}.pdf`;
      if (!firstPath) firstPath = path;

      expect((await uploadPdf(owner.client, path)).error).toBeNull();
      const { error: registerError } = await owner.client.rpc(
        "register_verification_document",
        {
          target_submission_id: reviewSubmissionId,
          target_document_id: documentId,
          target_document_type: documentType,
          target_storage_path: path,
          target_original_name: `${documentType}.pdf`,
          target_mime_type: "application/pdf",
          target_size_bytes: 4,
        },
      );
      expect(registerError).toBeNull();
    }

    const { error: submitError } = await owner.client.rpc(
      "submit_agency_verification",
      { target_submission_id: reviewSubmissionId },
    );
    expect(submitError).toBeNull();

    expect(
      (await owner.client.storage.from(bucketName).download(firstPath)).error,
    ).toBeNull();
    expect(
      (await verifier.client.storage.from(bucketName).download(firstPath)).error,
    ).toBeNull();
    expect(
      (await superAdmin.client.storage.from(bucketName).download(firstPath)).error,
    ).toBeNull();

    expect(
      (await moderator.client.storage.from(bucketName).download(firstPath)).error,
    ).not.toBeNull();
    expect(
      (await unrelated.client.storage.from(bucketName).download(firstPath)).error,
    ).not.toBeNull();

    const deleteAttempt = await owner.client.storage
      .from(bucketName)
      .remove([firstPath]);
    expect(deleteAttempt.error).not.toBeNull();
  });
});
