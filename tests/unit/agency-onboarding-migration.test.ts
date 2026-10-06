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

describe("agency onboarding migration", () => {
  it("defines an authenticated transactional agency creation function", () => {
    expect(migrationSql).toContain(
      "create or replace function public.create_agency_with_owner",
    );
    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("auth.uid()");
    expect(migrationSql).toContain("insert into public.agencies");
    expect(migrationSql).toContain("insert into public.agency_members");
    expect(migrationSql).toContain(
      "grant execute on function public.create_agency_with_owner",
    );
  });

  it("does not expose agency creation to anonymous users", () => {
    expect(migrationSql).toContain(
      "revoke all on function public.create_agency_with_owner",
    );
    expect(migrationSql).toContain("to authenticated");
  });
});
