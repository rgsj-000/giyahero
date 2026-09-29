import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addAgencyMember,
  createAgencyFixture,
  createAnonymousClient,
  createTestIdentity,
  deleteTestIdentity,
  getAdminClient,
  grantPlatformRole,
} from "./helpers/verification-fixtures";

const requiredDocumentTypes = [
  "business_registration",
  "business_permit",
  "authorized_representative_id",
] as const;

type TestIdentity = Awaited<ReturnType<typeof createTestIdentity>>;

const identities: TestIdentity[] = [];
const admin = getAdminClient();

let owner: TestIdentity;
let manager: TestIdentity;
let bookingStaff: TestIdentity;
let unrelated: TestIdentity;
let verifier: TestIdentity;
let superAdmin: TestIdentity;
let moderator: TestIdentity;

async function createDraft(agencyId: string, client = owner.client) {
  const { data, error } = await client.rpc("create_verification_draft", {
    target_agency_id: agencyId,
  });

  expect(error).toBeNull();
  expect(typeof data).toBe("string");
  return data as string;
}

async function registerDocument(input: {
  client?: SupabaseClient;
  agencyId: string;
  submissionId: string;
  documentType: string;
}) {
  const client = input.client ?? owner.client;
  const documentId = randomUUID();
  const filename = `${input.documentType}.pdf`;
  const storagePath = `agency/${input.agencyId}/${input.submissionId}/${documentId}/${filename}`;

  const { data, error } = await client.rpc("register_verification_document", {
    target_submission_id: input.submissionId,
    target_document_id: documentId,
    target_document_type: input.documentType,
    target_storage_path: storagePath,
    target_original_name: filename,
    target_mime_type: "application/pdf",
    target_size_bytes: 128,
  });

  return { data, error, documentId, storagePath };
}

async function addRequiredDocuments(
  agencyId: string,
  submissionId: string,
  client = owner.client,
) {
  const documentIds: string[] = [];

  for (const documentType of requiredDocumentTypes) {
    const result = await registerDocument({
      client,
      agencyId,
      submissionId,
      documentType,
    });
    expect(result.error).toBeNull();
    expect(result.data).toBe(result.documentId);
    documentIds.push(result.documentId);
  }

  return documentIds;
}

async function createSubmittedApplication(label: string) {
  const agencyId = await createAgencyFixture(owner.id, label);
  const submissionId = await createDraft(agencyId);
  const documentIds = await addRequiredDocuments(agencyId, submissionId);
  const { error } = await owner.client.rpc("submit_agency_verification", {
    target_submission_id: submissionId,
  });
  expect(error).toBeNull();
  return { agencyId, submissionId, documentIds };
}

beforeAll(async () => {
  owner = await createTestIdentity("verification owner");
  manager = await createTestIdentity("verification manager");
  bookingStaff = await createTestIdentity("verification booking staff");
  unrelated = await createTestIdentity("verification unrelated");
  verifier = await createTestIdentity("verification verifier");
  superAdmin = await createTestIdentity("verification super admin");
  moderator = await createTestIdentity("verification moderator");

  identities.push(
    owner,
    manager,
    bookingStaff,
    unrelated,
    verifier,
    superAdmin,
    moderator,
  );

  await grantPlatformRole(verifier.id, "agency_verifier");
  await grantPlatformRole(superAdmin.id, "super_admin");
  await grantPlatformRole(moderator.id, "moderator");
});

afterAll(async () => {
  for (const identity of identities.reverse()) {
    await deleteTestIdentity(identity.id);
  }
});

describe("agency verification workflow", () => {
  it("lets owners and managers create or resume one editable draft", async () => {
    const agencyId = await createAgencyFixture(owner.id, "Owner manager draft");
    await addAgencyMember(agencyId, manager.id, "manager");

    const ownerDraft = await createDraft(agencyId, owner.client);
    const managerDraft = await createDraft(agencyId, manager.client);

    expect(managerDraft).toBe(ownerDraft);

    const { data: drafts, error } = await admin
      .from("agency_verification_submissions")
      .select("id,status")
      .eq("agency_id", agencyId)
      .eq("status", "draft");

    expect(error).toBeNull();
    expect(drafts).toHaveLength(1);
  });

  it("denies draft creation and mutation to unauthorized users", async () => {
    const agencyId = await createAgencyFixture(owner.id, "Unauthorized draft");
    await addAgencyMember(agencyId, bookingStaff.id, "booking_staff");
    const submissionId = await createDraft(agencyId);
    const anonymous = createAnonymousClient();

    for (const client of [bookingStaff.client, unrelated.client, anonymous]) {
      const createResult = await client.rpc("create_verification_draft", {
        target_agency_id: agencyId,
      });
      expect(createResult.error).not.toBeNull();

      const mutateResult = await registerDocument({
        client,
        agencyId,
        submissionId,
        documentType: "business_registration",
      });
      expect(mutateResult.error).not.toBeNull();
    }
  });

  it("collapses concurrent draft creation to one submission", async () => {
    const agencyId = await createAgencyFixture(owner.id, "Concurrent draft");

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

    const { count, error } = await admin
      .from("agency_verification_submissions")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("status", "draft");

    expect(error).toBeNull();
    expect(count).toBe(1);
  });

  it("blocks incomplete submission then atomically submits a complete application", async () => {
    const agencyId = await createAgencyFixture(owner.id, "Complete submission");
    const submissionId = await createDraft(agencyId);

    const incomplete = await registerDocument({
      agencyId,
      submissionId,
      documentType: "business_registration",
    });
    expect(incomplete.error).toBeNull();

    const blocked = await owner.client.rpc("submit_agency_verification", {
      target_submission_id: submissionId,
    });
    expect(blocked.error).not.toBeNull();

    for (const documentType of [
      "business_permit",
      "authorized_representative_id",
    ]) {
      const result = await registerDocument({
        agencyId,
        submissionId,
        documentType,
      });
      expect(result.error).toBeNull();
    }

    const submitted = await owner.client.rpc("submit_agency_verification", {
      target_submission_id: submissionId,
    });
    expect(submitted.error).toBeNull();

    const [{ data: submission }, { data: agency }] = await Promise.all([
      admin
        .from("agency_verification_submissions")
        .select("status,submitted_at")
        .eq("id", submissionId)
        .single(),
      admin.from("agencies").select("status").eq("id", agencyId).single(),
    ]);

    expect(submission?.status).toBe("submitted");
    expect(submission?.submitted_at).toBeTruthy();
    expect(agency?.status).toBe("submitted");
  });

  it("freezes agency document mutations after submission", async () => {
    const { agencyId, submissionId, documentIds } =
      await createSubmittedApplication("Frozen submission");

    const addOptional = await registerDocument({
      agencyId,
      submissionId,
      documentType: "dot_accreditation",
    });
    expect(addOptional.error).not.toBeNull();

    const remove = await owner.client.rpc("remove_verification_document", {
      target_document_id: documentIds[0],
    });
    expect(remove.error).not.toBeNull();
  });

  it("restricts review start to agency verifiers and super admins", async () => {
    const first = await createSubmittedApplication("Verifier review");
    const second = await createSubmittedApplication("Super admin review");

    for (const client of [owner.client, moderator.client]) {
      const denied = await client.rpc("start_agency_verification_review", {
        target_submission_id: first.submissionId,
      });
      expect(denied.error).not.toBeNull();
    }

    const verifierStart = await verifier.client.rpc(
      "start_agency_verification_review",
      { target_submission_id: first.submissionId },
    );
    expect(verifierStart.error).toBeNull();

    const superAdminStart = await superAdmin.client.rpc(
      "start_agency_verification_review",
      { target_submission_id: second.submissionId },
    );
    expect(superAdminStart.error).toBeNull();

    const [{ data: firstSubmission }, { data: firstAgency }] = await Promise.all([
      admin
        .from("agency_verification_submissions")
        .select("status")
        .eq("id", first.submissionId)
        .single(),
      admin.from("agencies").select("status").eq("id", first.agencyId).single(),
    ]);

    expect(firstSubmission?.status).toBe("under_review");
    expect(firstAgency?.status).toBe("under_review");
  });

  it("allows decisions only while under review and rejects blank rejection notes", async () => {
    const submitted = await createSubmittedApplication("Decision guards");

    const tooEarly = await verifier.client.rpc("decide_agency_verification", {
      target_submission_id: submitted.submissionId,
      target_decision: "verified",
      target_notes: null,
    });
    expect(tooEarly.error).not.toBeNull();

    const started = await verifier.client.rpc(
      "start_agency_verification_review",
      { target_submission_id: submitted.submissionId },
    );
    expect(started.error).toBeNull();

    const blankRejection = await verifier.client.rpc(
      "decide_agency_verification",
      {
        target_submission_id: submitted.submissionId,
        target_decision: "rejected",
        target_notes: "   ",
      },
    );
    expect(blankRejection.error).not.toBeNull();

    const { data: submission } = await admin
      .from("agency_verification_submissions")
      .select("status")
      .eq("id", submitted.submissionId)
      .single();
    expect(submission?.status).toBe("under_review");
  });

  it("approves atomically and refuses a second decision", async () => {
    const submitted = await createSubmittedApplication("Approved agency");
    await verifier.client.rpc("start_agency_verification_review", {
      target_submission_id: submitted.submissionId,
    });

    const approved = await verifier.client.rpc("decide_agency_verification", {
      target_submission_id: submitted.submissionId,
      target_decision: "verified",
      target_notes: null,
    });
    expect(approved.error).toBeNull();

    const [{ data: submission }, { data: agency }] = await Promise.all([
      admin
        .from("agency_verification_submissions")
        .select("status,reviewed_by,reviewed_at")
        .eq("id", submitted.submissionId)
        .single(),
      admin
        .from("agencies")
        .select("status,verified_at")
        .eq("id", submitted.agencyId)
        .single(),
    ]);

    expect(submission?.status).toBe("verified");
    expect(submission?.reviewed_by).toBe(verifier.id);
    expect(submission?.reviewed_at).toBeTruthy();
    expect(agency?.status).toBe("verified");
    expect(agency?.verified_at).toBeTruthy();

    const secondDecision = await verifier.client.rpc(
      "decide_agency_verification",
      {
        target_submission_id: submitted.submissionId,
        target_decision: "rejected",
        target_notes: "Changed mind",
      },
    );
    expect(secondDecision.error).not.toBeNull();

    const { data: unchanged } = await admin
      .from("agency_verification_submissions")
      .select("status")
      .eq("id", submitted.submissionId)
      .single();
    expect(unchanged?.status).toBe("verified");
  });

  it("rejects atomically, trims notes, and prevents a fresh draft", async () => {
    const submitted = await createSubmittedApplication("Rejected agency");
    await verifier.client.rpc("start_agency_verification_review", {
      target_submission_id: submitted.submissionId,
    });

    const rejected = await verifier.client.rpc("decide_agency_verification", {
      target_submission_id: submitted.submissionId,
      target_decision: "rejected",
      target_notes: "  Missing permit seal  ",
    });
    expect(rejected.error).toBeNull();

    const [{ data: submission }, { data: agency }] = await Promise.all([
      admin
        .from("agency_verification_submissions")
        .select("status,decision_notes,reviewed_by,reviewed_at")
        .eq("id", submitted.submissionId)
        .single(),
      admin
        .from("agencies")
        .select("status,verified_at")
        .eq("id", submitted.agencyId)
        .single(),
    ]);

    expect(submission?.status).toBe("rejected");
    expect(submission?.decision_notes).toBe("Missing permit seal");
    expect(submission?.reviewed_by).toBe(verifier.id);
    expect(submission?.reviewed_at).toBeTruthy();
    expect(agency?.status).toBe("rejected");
    expect(agency?.verified_at).toBeNull();

    const freshDraft = await owner.client.rpc("create_verification_draft", {
      target_agency_id: submitted.agencyId,
    });
    expect(freshDraft.error).not.toBeNull();
  });

  it("lets verifier roles read an unverified agency without making it public", async () => {
    const agencyId = await createAgencyFixture(owner.id, "Private review agency");
    await createDraft(agencyId);
    const anonymous = createAnonymousClient();

    const verifierRead = await verifier.client
      .from("agencies")
      .select("id")
      .eq("id", agencyId);
    expect(verifierRead.error).toBeNull();
    expect(verifierRead.data).toHaveLength(1);

    const unrelatedRead = await unrelated.client
      .from("agencies")
      .select("id")
      .eq("id", agencyId);
    expect(unrelatedRead.error).toBeNull();
    expect(unrelatedRead.data).toHaveLength(0);

    const anonymousRead = await anonymous
      .from("agencies")
      .select("id")
      .eq("id", agencyId);
    expect(anonymousRead.error).toBeNull();
    expect(anonymousRead.data).toHaveLength(0);
  });
});
