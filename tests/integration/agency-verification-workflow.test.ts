import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  addAgencyMember,
  createAgencyFixture,
  createAnonymousTestClient,
  createTestIdentity,
  deleteTestIdentity,
  grantPlatformRole,
  verificationAdminClient,
} from "./helpers/verification-fixtures";

const requiredDocumentTypes = [
  "business_registration",
  "business_permit",
  "authorized_representative_id",
] as const;

type Identity = Awaited<ReturnType<typeof createTestIdentity>>;

let owner: Identity;
let manager: Identity;
let bookingStaff: Identity;
let outsider: Identity;
let verifier: Identity;
let superAdmin: Identity;
let moderator: Identity;
let agencyIds: string[] = [];

async function createAgency(label: string) {
  const agencyId = await createAgencyFixture(owner.id, label);
  agencyIds.push(agencyId);
  await addAgencyMember(agencyId, manager.id, "manager");
  await addAgencyMember(agencyId, bookingStaff.id, "booking_staff");
  return agencyId;
}

async function createDraft(agencyId: string) {
  const { data, error } = await owner.client.rpc("create_verification_draft", {
    target_agency_id: agencyId,
  });
  expect(error).toBeNull();
  expect(typeof data).toBe("string");
  return data as string;
}

async function registerDocument(
  submissionId: string,
  agencyId: string,
  documentType: string,
) {
  const uploadId = randomUUID();
  const { error } = await owner.client.rpc("register_verification_document", {
    target_submission_id: submissionId,
    target_document_id: uploadId,
    target_document_type: documentType,
    target_storage_path: `agency/${agencyId}/${submissionId}/${documentType}/${uploadId}-evidence.pdf`,
    target_original_name: "evidence.pdf",
    target_mime_type: "application/pdf",
    target_size_bytes: 128,
  });
  expect(error).toBeNull();
  return uploadId;
}

async function makeCompleteDraft(agencyId: string) {
  const submissionId = await createDraft(agencyId);
  for (const documentType of requiredDocumentTypes) {
    await registerDocument(submissionId, agencyId, documentType);
  }
  return submissionId;
}

beforeAll(async () => {
  [owner, manager, bookingStaff, outsider, verifier, superAdmin, moderator] =
    await Promise.all([
      createTestIdentity("verification-owner"),
      createTestIdentity("verification-manager"),
      createTestIdentity("verification-booking"),
      createTestIdentity("verification-outsider"),
      createTestIdentity("verification-verifier"),
      createTestIdentity("verification-super-admin"),
      createTestIdentity("verification-moderator"),
    ]);

  await grantPlatformRole(verifier.id, "agency_verifier");
  await grantPlatformRole(superAdmin.id, "super_admin");
  await grantPlatformRole(moderator.id, "moderator");
});

afterEach(async () => {
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

describe("agency verification workflow", () => {
  it("lets owner and manager create or resume the same draft and resolves a draft race", async () => {
    const agencyId = await createAgency("draft-race");

    const [first, second] = await Promise.all([
      owner.client.rpc("create_verification_draft", {
        target_agency_id: agencyId,
      }),
      owner.client.rpc("create_verification_draft", {
        target_agency_id: agencyId,
      }),
    ]);

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(first.data).toBe(second.data);

    const managerResult = await manager.client.rpc(
      "create_verification_draft",
      { target_agency_id: agencyId },
    );
    expect(managerResult.error).toBeNull();
    expect(managerResult.data).toBe(first.data);

    const { data: drafts, error: draftError } = await verificationAdminClient
      .from("agency_verification_submissions")
      .select("id,status")
      .eq("agency_id", agencyId)
      .eq("status", "draft");
    expect(draftError).toBeNull();
    expect(drafts).toHaveLength(1);
  });

  it("denies draft mutation to booking staff, outsiders, and anonymous callers", async () => {
    const agencyId = await createAgency("role-denial");
    const anonymous = createAnonymousTestClient();

    for (const client of [bookingStaff.client, outsider.client, anonymous]) {
      const { error } = await client.rpc("create_verification_draft", {
        target_agency_id: agencyId,
      });
      expect(error).not.toBeNull();
    }
  });

  it("requires all required documents, submits atomically, and freezes document mutation", async () => {
    const agencyId = await createAgency("submission");
    const submissionId = await createDraft(agencyId);

    await registerDocument(submissionId, agencyId, "business_registration");
    const incomplete = await owner.client.rpc("submit_agency_verification", {
      target_submission_id: submissionId,
    });
    expect(incomplete.error).not.toBeNull();

    await registerDocument(submissionId, agencyId, "business_permit");
    await registerDocument(
      submissionId,
      agencyId,
      "authorized_representative_id",
    );

    const submitted = await owner.client.rpc("submit_agency_verification", {
      target_submission_id: submissionId,
    });
    expect(submitted.error).toBeNull();

    const { data: submission } = await verificationAdminClient
      .from("agency_verification_submissions")
      .select("status,submitted_at")
      .eq("id", submissionId)
      .single();
    const { data: agency } = await verificationAdminClient
      .from("agencies")
      .select("status")
      .eq("id", agencyId)
      .single();

    expect(submission?.status).toBe("submitted");
    expect(submission?.submitted_at).toBeTruthy();
    expect(agency?.status).toBe("submitted");

    const uploadId = randomUUID();
    const lateDocument = await owner.client.rpc(
      "register_verification_document",
      {
        target_submission_id: submissionId,
        target_document_id: uploadId,
        target_document_type: "dot_accreditation",
        target_storage_path: `agency/${agencyId}/${submissionId}/dot_accreditation/${uploadId}-dot.pdf`,
        target_original_name: "dot.pdf",
        target_mime_type: "application/pdf",
        target_size_bytes: 128,
      },
    );
    expect(lateDocument.error).not.toBeNull();
  });

  it("allows only verifier roles to start review and updates both states", async () => {
    const agencyId = await createAgency("review-start");
    const submissionId = await makeCompleteDraft(agencyId);
    const submitted = await owner.client.rpc("submit_agency_verification", {
      target_submission_id: submissionId,
    });
    expect(submitted.error).toBeNull();

    for (const client of [owner.client, moderator.client]) {
      const { error } = await client.rpc("start_agency_verification_review", {
        target_submission_id: submissionId,
      });
      expect(error).not.toBeNull();
    }

    const started = await verifier.client.rpc(
      "start_agency_verification_review",
      { target_submission_id: submissionId },
    );
    expect(started.error).toBeNull();

    const { data: submission } = await verificationAdminClient
      .from("agency_verification_submissions")
      .select("status")
      .eq("id", submissionId)
      .single();
    const { data: agency } = await verificationAdminClient
      .from("agencies")
      .select("status")
      .eq("id", agencyId)
      .single();
    expect(submission?.status).toBe("under_review");
    expect(agency?.status).toBe("under_review");
  });

  it("approves only an under-review submission and cannot overwrite a terminal decision", async () => {
    const agencyId = await createAgency("approval");
    const submissionId = await makeCompleteDraft(agencyId);

    const earlyDecision = await verifier.client.rpc(
      "decide_agency_verification",
      {
        target_submission_id: submissionId,
        target_decision: "verified",
        target_notes: null,
      },
    );
    expect(earlyDecision.error).not.toBeNull();

    await owner.client.rpc("submit_agency_verification", {
      target_submission_id: submissionId,
    });
    await verifier.client.rpc("start_agency_verification_review", {
      target_submission_id: submissionId,
    });

    const approved = await verifier.client.rpc("decide_agency_verification", {
      target_submission_id: submissionId,
      target_decision: "verified",
      target_notes: null,
    });
    expect(approved.error).toBeNull();

    const { data: submission } = await verificationAdminClient
      .from("agency_verification_submissions")
      .select("status,reviewed_by,reviewed_at")
      .eq("id", submissionId)
      .single();
    const { data: agency } = await verificationAdminClient
      .from("agencies")
      .select("status,verified_at")
      .eq("id", agencyId)
      .single();

    expect(submission?.status).toBe("verified");
    expect(submission?.reviewed_by).toBe(verifier.id);
    expect(submission?.reviewed_at).toBeTruthy();
    expect(agency?.status).toBe("verified");
    expect(agency?.verified_at).toBeTruthy();

    const secondDecision = await superAdmin.client.rpc(
      "decide_agency_verification",
      {
        target_submission_id: submissionId,
        target_decision: "rejected",
        target_notes: "too late",
      },
    );
    expect(secondDecision.error).not.toBeNull();

    const { data: unchanged } = await verificationAdminClient
      .from("agency_verification_submissions")
      .select("status,reviewed_by")
      .eq("id", submissionId)
      .single();
    expect(unchanged?.status).toBe("verified");
    expect(unchanged?.reviewed_by).toBe(verifier.id);
  });

  it("rejects whitespace notes, trims rejection notes, and blocks a fresh draft", async () => {
    const agencyId = await createAgency("rejection");
    const submissionId = await makeCompleteDraft(agencyId);
    await owner.client.rpc("submit_agency_verification", {
      target_submission_id: submissionId,
    });
    await superAdmin.client.rpc("start_agency_verification_review", {
      target_submission_id: submissionId,
    });

    const whitespace = await superAdmin.client.rpc(
      "decide_agency_verification",
      {
        target_submission_id: submissionId,
        target_decision: "rejected",
        target_notes: "   ",
      },
    );
    expect(whitespace.error).not.toBeNull();

    const rejected = await superAdmin.client.rpc("decide_agency_verification", {
      target_submission_id: submissionId,
      target_decision: "rejected",
      target_notes: "  Permit could not be validated.  ",
    });
    expect(rejected.error).toBeNull();

    const { data: submission } = await verificationAdminClient
      .from("agency_verification_submissions")
      .select("status,decision_notes,reviewed_by,reviewed_at")
      .eq("id", submissionId)
      .single();
    const { data: agency } = await verificationAdminClient
      .from("agencies")
      .select("status,verified_at")
      .eq("id", agencyId)
      .single();

    expect(submission?.status).toBe("rejected");
    expect(submission?.decision_notes).toBe("Permit could not be validated.");
    expect(submission?.reviewed_by).toBe(superAdmin.id);
    expect(submission?.reviewed_at).toBeTruthy();
    expect(agency?.status).toBe("rejected");
    expect(agency?.verified_at).toBeNull();

    const freshDraft = await owner.client.rpc("create_verification_draft", {
      target_agency_id: agencyId,
    });
    expect(freshDraft.error).not.toBeNull();
  });

  it("lets verifier roles read an unverified agency without making it public", async () => {
    const agencyId = await createAgency("verifier-read");

    for (const client of [verifier.client, superAdmin.client]) {
      const { data, error } = await client
        .from("agencies")
        .select("id")
        .eq("id", agencyId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBe(agencyId);
    }

    for (const client of [outsider.client, createAnonymousTestClient()]) {
      const { data, error } = await client
        .from("agencies")
        .select("id")
        .eq("id", agencyId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    }
  });
});
