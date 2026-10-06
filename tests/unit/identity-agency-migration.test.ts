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

const plan02Tables = [
  "profiles",
  "platform_admin_memberships",
  "agencies",
  "agency_members",
  "agency_invitations",
  "agency_verification_submissions",
  "agency_verification_documents",
];

describe("Plan 02 database migration", () => {
  it("declares every identity and agency table", () => {
    for (const table of plan02Tables) {
      expect(migrationSql).toContain(`create table public.${table}`);
    }
  });

  it("enables row level security for every identity and agency table", () => {
    for (const table of plan02Tables) {
      expect(migrationSql).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
  });
});
