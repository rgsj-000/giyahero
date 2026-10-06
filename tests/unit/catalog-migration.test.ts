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

describe("catalog foundation migration", () => {
  it("creates structured geography and seeds Quezon Province", () => {
    for (const table of [
      "countries",
      "geographic_regions",
      "provinces",
      "municipalities",
      "destinations",
      "agency_service_areas",
    ]) {
      expect(migrationSql).toContain(`create table public.${table}`);
      expect(migrationSql).toContain(
        `alter table public.${table} enable row level security`,
      );
    }

    expect(migrationSql).toContain("'ph-que', 'quezon'");
    expect(migrationSql).toContain("'ph-4a', 'calabarzon'");
  });

  it("stores structured package content and money in integer minor units", () => {
    for (const table of [
      "packages",
      "package_destinations",
      "package_itinerary_days",
      "package_features",
      "package_media",
      "package_prices",
      "package_policies",
      "package_departures",
      "package_tags",
    ]) {
      expect(migrationSql).toContain(`create table public.${table}`);
    }

    expect(migrationSql).toMatch(
      /amount_minor bigint not null\s+check \(amount_minor between 1 and 9007199254740991\)/,
    );
    expect(migrationSql).toContain(
      "unique index package_prices_label_unique_idx",
    );
    expect(migrationSql).toContain("package_pricing_model");
    expect(migrationSql).toContain("package_schedule_model");
    expect(migrationSql).toContain("open_date_start date");
    expect(migrationSql).toContain("open_date_end date");
  });

  it("makes public reads depend on both publication and agency verification", () => {
    expect(migrationSql).toContain("package.publication_status = 'published'");
    expect(migrationSql).toContain("agency.status = 'verified'");
    expect(migrationSql).toContain("public.can_read_package(id)");
    expect(migrationSql).not.toMatch(
      /create policy[^;]+on public\.packages[^;]+for (?:insert|update|delete)/,
    );
  });
});
