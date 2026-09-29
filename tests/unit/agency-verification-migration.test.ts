import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationDirectory = join(process.cwd(), "supabase", "migrations");
const migrationSql = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(join(migrationDirectory, name), "utf8"))
  .join("\n")
  .toLowerCase();

const verificationRpcNames = [
  "create_verification_draft",
  "register_verification_document",
  "remove_verification_document",
  "submit_agency_verification",
  "start_agency_verification_review",
  "decide_agency_verification",
];

describe("agency verification workflow migration", () => {
  it("defines the verification workflow RPC boundary", () => {
    for (const rpcName of verificationRpcNames) {
      expect(migrationSql).toContain(`function public.${rpcName}`);
      expect(migrationSql).toContain(
        `grant execute on function public.${rpcName}`,
      );
    }

    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("to authenticated");
  });

  it("adds draft verification state and enforces one editable draft", () => {
    expect(migrationSql).toContain("'draft'");
    expect(migrationSql).toContain("agency_verification_status");
    expect(migrationSql).toContain("where status = 'draft'");
    expect(migrationSql).toContain("unique");
  });

  it("restricts Release 1 document categories", () => {
    for (const documentType of [
      "business_registration",
      "business_permit",
      "authorized_representative_id",
      "dot_accreditation",
    ]) {
      expect(migrationSql).toContain(`'${documentType}'`);
    }

    expect(migrationSql).toContain("submission_id, document_type");
  });

  it("records the authenticated user at formal submission time", () => {
    expect(migrationSql).toContain("submitted_by = current_user_id");
  });

  it("does not add direct permissive writes to verification tables", () => {
    expect(migrationSql).not.toMatch(
      /on public\.agency_verification_submissions\s+for\s+(insert|update|delete)/,
    );
    expect(migrationSql).not.toMatch(
      /on public\.agency_verification_documents\s+for\s+(insert|update|delete)/,
    );
  });
});
