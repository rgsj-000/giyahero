import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildVerificationStoragePath } from "@/features/agencies/verification/storage-path";
import type { VerificationDocumentType } from "@/features/agencies/verification/types";
import {
  addAgencyMember,
  createAgencyFixture,
  createAnonymousTestClient,
  createTestIdentity,
  deleteTestIdentity,
  grantPlatformRole,
  verificationAdminClient,
} from "./helpers/verification-fixtures";

const BUCKET = "agency-verification";
const REQUIRED_TYPES = [
  "business_registration",
  "business_permit",
  "authorized_representative_id",
] as const satisfies readonly VerificationDocumentType[];

type Identity = Awaited<ReturnType<typeof createTestIdentity>>;

let owner: Identity;
let manager: Identity;
let bookingStaff: Identity;
let outsider: Identity;
let verifier: Identity;
let superAdmin: Identity;
let moderator: Identity;
let agencyIds: string[] = [];
let cleanupPaths: string[] = [];

async function createAgency(label: string) {
  const agencyId = await createAgencyFixture(owner.id, label);
  agencyIds.push(agencyId);
  await addAgencyMember(agencyId, manager.id, "manager");
  await addAgencyMember(agencyId, bookingStaff.id, "booking_staff");
  return agencyId;
}

async function createForeignAgency(label: string) {
  const agencyId = await createAgencyFixture(outsider.id, label);
  agencyIds.push(agencyId);
  return agencyId;
}

async function createDraftAs(identity: Identity, agencyId: string) {
  const { data, error } = await identity.client.rpc(
    "create_verification_draft",
    {
      target_agency_id: agencyId,
    },
  );
  expect(error).toBeNull();
  return data as string;
}

async function createDraft(agencyId: string) {
  return createDraftAs(owner, agencyId);
}

function makePath(
  agencyId: string,
  submissionId: string,
  documentType: VerificationDocumentType,
) {
  const uploadId = randomUUID();
  return {
    uploadId,
    path: buildVerificationStoragePath({
      agencyId,
      submissionId,
      documentType,
      uploadId,
      filename: `${documentType}.pdf`,
    }),
  };
}

async function uploadEvidence(
  client: Identity["client"],
  path: string,
  contentType = "application/pdf",
) {
  const result = await client.storage
    .from(BUCKET)
    .upload(path, new Uint8Array([37, 80, 68, 70]), {
      contentType,
      upsert: false,
    });

  if (!result.error) cleanupPaths.push(path);
  return result;
}

async function uploadAndRegisterRequired(
  agencyId: string,
  submissionId: string,
) {
  const paths: string[] = [];

  for (const documentType of REQUIRED_TYPES) {
    const { uploadId, path } = makePath(agencyId, submissionId, documentType);
    const upload = await uploadEvidence(owner.client, path);
    expect(upload.error).toBeNull();

    const { error } = await owner.client.rpc("register_verification_document", {
      target_submission_id: submissionId,
      target_document_id: uploadId,
      target_document_type: documentType,
      target_storage_path: path,
      target_original_name: `${documentType}.pdf`,
      target_mime_type: "application/pdf",
      target_size_bytes: 4,
    });
    expect(error).toBeNull();
    paths.push(path);
  }

  return paths;
}

beforeAll(async () => {
  [owner, manager, bookingStaff, outsider, verifier, superAdmin, moderator] =
    await Promise.all([
      createTestIdentity("storage-owner"),
      createTestIdentity("storage-manager"),
      createTestIdentity("storage-booking"),
      createTestIdentity("storage-outsider"),
      createTestIdentity("storage-verifier"),
      createTestIdentity("storage-super-admin"),
      createTestIdentity("storage-moderator"),
    ]);

  await grantPlatformRole(verifier.id, "agency_verifier");
  await grantPlatformRole(superAdmin.id, "super_admin");
  await grantPlatformRole(moderator.id, "moderator");
});

afterEach(async () => {
  if (cleanupPaths.length > 0) {
    await verificationAdminClient.storage.from(BUCKET).remove(cleanupPaths);
    cleanupPaths = [];
  }

  if (agencyIds.length > 0) {
    const { error } = await verificationAdminClient
      .from("agencies")
      .delete()
      .in("id", agencyIds);
    if (error) throw error;
    agencyIds = [];
  }
});

afterAll(async () => {
  for (const identity of [
    owner,
    manager,
    bookingStaff,
    outsider,
    verifier,
    superAdmin,
    moderator,
  ]) {
    if (identity) await deleteTestIdentity(identity.id);
  }
});

describe("agency verification private storage", () => {
  it("creates a private bucket with the Release 1 limits", async () => {
    const { data, error } =
      await verificationAdminClient.storage.getBucket(BUCKET);

    expect(error).toBeNull();
    expect(data?.public).toBe(false);
    expect(data?.file_size_limit).toBe(10 * 1024 * 1024);
    expect(data?.allowed_mime_types).toEqual(
      expect.arrayContaining([
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
      ]),
    );
  });

  it("allows owner and manager uploads only inside their own draft submission path", async () => {
    const agencyId = await createAgency("storage-access");
    const submissionId = await createDraft(agencyId);

    for (const identity of [owner, manager]) {
      const { path } = makePath(agencyId, submissionId, "business_permit");
      const upload = await uploadEvidence(identity.client, path);
      expect(upload.error).toBeNull();
    }

    const otherAgencyId = await createForeignAgency("storage-other");
    const otherSubmissionId = await createDraftAs(outsider, otherAgencyId);
    const anonymous = createAnonymousTestClient();

    for (const client of [bookingStaff.client, outsider.client, anonymous]) {
      const { path } = makePath(agencyId, submissionId, "dot_accreditation");
      const upload = await client.storage
        .from(BUCKET)
        .upload(path, new Uint8Array([1, 2, 3]), {
          contentType: "application/pdf",
          upsert: false,
        });
      expect(upload.error).not.toBeNull();
    }

    const foreignPath = makePath(
      otherAgencyId,
      otherSubmissionId,
      "business_registration",
    ).path;
    const foreignUpload = await manager.client.storage
      .from(BUCKET)
      .upload(foreignPath, new Uint8Array([1, 2, 3]), {
        contentType: "application/pdf",
      });
    expect(foreignUpload.error).not.toBeNull();
  });

  it("denies malformed and cross-agency paths without policy errors leaking access", async () => {
    const agencyId = await createAgency("storage-malformed");
    const submissionId = await createDraft(agencyId);
    const otherAgencyId = await createForeignAgency("storage-cross");
    const otherSubmissionId = await createDraftAs(outsider, otherAgencyId);

    const malformedPaths = [
      "agency/not-a-uuid/nope/business_permit/file.pdf",
      `agency/${agencyId}`,
      `agency/${agencyId}/${submissionId}`,
      `agency/${otherAgencyId}/${submissionId}/business_permit/${randomUUID()}-file.pdf`,
      `agency/${agencyId}/${otherSubmissionId}/business_permit/${randomUUID()}-file.pdf`,
    ];

    for (const path of malformedPaths) {
      const { error } = await owner.client.storage
        .from(BUCKET)
        .upload(path, new Uint8Array([1, 2, 3]), {
          contentType: "application/pdf",
        });
      expect(error).not.toBeNull();
    }
  });

  it("keeps owner read access after submission but freezes deletion", async () => {
    const agencyId = await createAgency("storage-freeze");
    const submissionId = await createDraft(agencyId);
    const paths = await uploadAndRegisterRequired(agencyId, submissionId);

    const { error: submitError } = await owner.client.rpc(
      "submit_agency_verification",
      { target_submission_id: submissionId },
    );
    expect(submitError).toBeNull();

    const { error: downloadError } = await owner.client.storage
      .from(BUCKET)
      .download(paths[0]);
    expect(downloadError).toBeNull();

    await owner.client.storage.from(BUCKET).remove([paths[0]]);

    const { error: downloadAfterDeleteAttemptError } = await owner.client.storage
      .from(BUCKET)
      .download(paths[0]);
    expect(downloadAfterDeleteAttemptError).toBeNull();
  });

  it("allows verifier roles to read submitted evidence but denies other platform roles", async () => {
    const agencyId = await createAgency("storage-review");
    const submissionId = await createDraft(agencyId);
    const paths = await uploadAndRegisterRequired(agencyId, submissionId);
    await owner.client.rpc("submit_agency_verification", {
      target_submission_id: submissionId,
    });

    for (const identity of [verifier, superAdmin]) {
      const { error } = await identity.client.storage
        .from(BUCKET)
        .download(paths[0]);
      expect(error).toBeNull();
    }

    for (const identity of [moderator, outsider, bookingStaff]) {
      const { error } = await identity.client.storage
        .from(BUCKET)
        .download(paths[0]);
      expect(error).not.toBeNull();
    }
  });
});
