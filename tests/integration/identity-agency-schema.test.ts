import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { parseEnv } from "@/infrastructure/config/env";

const env = parseEnv(process.env);
const sql = postgres(env.DATABASE_URL, { max: 1 });

const requiredTables = [
  "agencies",
  "agency_invitations",
  "agency_members",
  "agency_verification_documents",
  "agency_verification_submissions",
  "platform_admin_memberships",
  "profiles",
];

afterAll(async () => {
  await sql.end();
});

describe("identity and agency schema", () => {
  it("creates all required identity and agency tables", async () => {
    const rows = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'agencies',
          'agency_invitations',
          'agency_members',
          'agency_verification_documents',
          'agency_verification_submissions',
          'platform_admin_memberships',
          'profiles'
        )
      order by table_name
    `;

    expect(rows.map((row) => row.table_name)).toEqual(requiredTables);
  });

  it("enables row level security on every Plan 02 table", async () => {
    const rows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      select c.relname, c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'agencies',
          'agency_invitations',
          'agency_members',
          'agency_verification_documents',
          'agency_verification_submissions',
          'platform_admin_memberships',
          'profiles'
        )
      order by c.relname
    `;

    expect(rows).toHaveLength(requiredTables.length);
    expect(rows.every((row) => row.relrowsecurity)).toBe(true);
  });
});
