import { afterAll, beforeAll, expect, it } from "vitest";
import {
  createDatabase,
  seedCatalog,
  asActor,
  agencyId,
  packageId,
  destinationId,
} from "./helpers/database";
let db: Awaited<ReturnType<typeof createDatabase>>;
beforeAll(async () => {
  db = await createDatabase();
  await seedCatalog(db);
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("searches only verified published inventory before pagination", async () => {
  const result = await asActor(db, null, (tx) =>
    tx.query<{ result: { items: { title: string }[] } }>(
      "select public.search_published_packages($1::jsonb) result",
      [
        JSON.stringify({
          destinationId,
          travelers: 3,
          maxBudgetMinor: 375150,
          limit: 20,
        }),
      ],
    ),
  );
  expect(result.rows[0].result.items.map((p) => p.title)).toEqual([
    "Real Island Trip",
  ]);
  const low = await asActor(db, null, (tx) =>
    tx.query<{ result: { items: unknown[] } }>(
      "select public.search_published_packages($1::jsonb) result",
      [JSON.stringify({ maxBudgetMinor: 375149, travelers: 3 })],
    ),
  );
  expect(low.rows[0].result.items).toEqual([]);
  await db.query("update public.agencies set status='suspended' where id=$1", [
    agencyId,
  ]);
  const hidden = await asActor(db, null, (tx) =>
    tx.query<{ result: { items: unknown[] } }>(
      "select public.search_published_packages('{}') result",
    ),
  );
  expect(hidden.rows[0].result.items).toEqual([]);
  await db.query("update public.agencies set status='verified' where id=$1", [
    agencyId,
  ]);
});
it("returns live package detail and never exposes a draft to guests", async () => {
  const found = await asActor(db, null, (tx) =>
    tx.query<{ result: { title: string; rates: { amountMinor: number }[] } }>(
      "select public.get_public_package_detail($1) result",
      [packageId],
    ),
  );
  expect(found.rows[0].result.title).toBe("Real Island Trip");
  expect(found.rows[0].result.rates[0].amountMinor).toBe(125050);
  await db.query(
    "update public.packages set publication_status='draft' where id=$1",
    [packageId],
  );
  const hidden = await asActor(db, null, (tx) =>
    tx.query<{ result: unknown }>("select public.get_public_package_detail($1) result", [packageId]),
  );
  expect(hidden.rows[0].result).toBeNull();
});
