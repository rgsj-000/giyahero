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

const rpcNames = [
  "create_verification_draft",
  "register_verification_document",
  "remove_verification_document",
  "submit_agency_verification",
  "start_agency_verification_review",
  "decide_agency_verification",
];

describe("agency verification workflow migration", () => {
  it("defines the verification RPC boundary", () => {
    for (const rpcName of rpcNames) {
      expect(migrationSql).toContain(
        `create or replace function public.${rpcName}`,
      );
      expect(migrationSql).toContain(
        `grant execute on function public.${rpcName}`,
      );
    }
  });

  it("adds a draft lifecycle and prevents parallel editable drafts", () => {
    expect(migrationSql).toContain("'draft'");
    expect(migrationSql).toContain("agency_verification_status");
    expect(migrationSql).toMatch(
      /unique index[^;]+agency_verification_submissions[^;]+where\s*\(?(status\s*=\s*'draft'|'draft'\s*=\s*status)\)?/,
    );
  });

  it("allows one document per category and only supported categories", () => {
    expect(migrationSql).toMatch(
      /unique index[^;]+agency_verification_documents[^;]+submission_id[^;]+document_type/,
    );
    for (const type of [
      "business_registration",
      "business_permit",
      "authorized_representative_id",
      "dot_accreditation",
    ]) {
      expect(migrationSql).toContain(`'${type}'`);
    }
  });

  it("keeps verification mutations behind authenticated RPCs", () => {
    expect(migrationSql).not.toMatch(
      /create policy[^;]+on public\.agency_verification_(?:submissions|documents)[^;]+for (?:insert|update|delete)/,
    );
    expect(migrationSql).not.toContain(
      "grant execute on function public.create_verification_draft to anon",
    );
    expect(migrationSql).toContain("to authenticated");
  });
});
