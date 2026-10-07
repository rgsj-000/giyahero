import { afterAll, beforeAll, expect, it } from "vitest";
import {
  createDatabase,
  seedCatalog,
  asActor,
  owner,
  outsider,
  reviewer,
  agencyId,
  packageId,
} from "./helpers/database";
import { validInput } from "./helpers/package-input";
let db: Awaited<ReturnType<typeof createDatabase>>;
beforeAll(async () => {
  db = await createDatabase();
  await seedCatalog(db);
}, 30000);
afterAll(async () => {
  await db?.close();
});
const create = async (actor = owner, input = validInput) =>
  asActor(db, actor, (tx) =>
    tx.query<{ id: string }>(
      "select public.save_package_draft($1,null,null,$2::jsonb) id",
      [agencyId, JSON.stringify(input)],
    ),
  );
it("denies another agency's user and direct publication writes", async () => {
  await expect(create(outsider)).rejects.toThrow("Not authorized");
  await expect(
    asActor(db, owner, (tx) =>
      tx.query(
        "update public.packages set publication_status='published' where id=$1",
        [packageId],
      ),
    ),
  ).rejects.toThrow();
});
it("requires independent first review before publication", async () => {
  const created = await create();
  const id = created.rows[0].id;
  await expect(
    asActor(db, owner, (tx) =>
      tx.query("select public.set_package_publication($1,1,'published')", [id]),
    ),
  ).rejects.toThrow("First publication");
  await asActor(db, owner, (tx) =>
    tx.query("select public.submit_package_review($1,1)", [id]),
  );
  await expect(
    asActor(db, owner, (tx) =>
      tx.query("select public.review_package($1,2,true,'')", [id]),
    ),
  ).rejects.toThrow("Not authorized");
  await asActor(db, reviewer, (tx) =>
    tx.query("select public.review_package($1,2,true,'Ready')", [id]),
  );
  const published = await asActor(db, null, (tx) =>
    tx.query<{ result: { title: string } }>(
      "select public.get_public_package_detail($1) result",
      [id],
    ),
  );
  expect(published.rows[0].result.title).toBe("Published Island Trip");
  await expect(
    asActor(db, owner, (tx) =>
      tx.query("select public.set_package_publication($1,1,'unpublished')", [
        id,
      ]),
    ),
  ).rejects.toThrow("changed");
  await asActor(db, owner, (tx) =>
    tx.query("select public.set_package_publication($1,3,'unpublished')", [id]),
  );
});
it("permits incomplete drafts but rejects incomplete review submissions", async () => {
  const created = await create(owner, {
    ...validInput,
    slug: "incomplete-draft",
    overview: "",
    itinerary: [],
    prices: [],
  });
  await expect(
    asActor(db, owner, (tx) =>
      tx.query("select public.submit_package_review($1,1)", [
        created.rows[0].id,
      ]),
    ),
  ).rejects.toThrow("complete");
});
it.each(["manager", "content_staff"] as const)(
  "allows %s to save drafts",
  async (role) => {
    await db.query(
      "insert into public.agency_members(agency_id,user_id,role) values($1,$2,$3)",
      [agencyId, outsider, role],
    );
    try {
      const created = await create(outsider, {
        ...validInput,
        slug: role.replace("_", "-") + "-package",
      });
      expect(created.rows[0].id).toMatch(/^[a-f0-9-]{36}$/);
    } finally {
      await db.query(
        "delete from public.agency_members where agency_id=$1 and user_id=$2",
        [agencyId, outsider],
      );
    }
  },
);
it("denies booking staff catalog changes", async () => {
  await db.query(
    "insert into public.agency_members(agency_id,user_id,role) values($1,$2,'booking_staff')",
    [agencyId, outsider],
  );
  await expect(create(outsider)).rejects.toThrow("Not authorized");
  await db.query(
    "delete from public.agency_members where agency_id=$1 and user_id=$2",
    [agencyId, outsider],
  );
});
it("blocks publication for a suspended agency", async () => {
  await db.query("update public.agencies set status='suspended' where id=$1", [
    agencyId,
  ]);
  await expect(
    asActor(db, owner, (tx) =>
      tx.query("select public.set_package_publication($1,1,'published')", [
        packageId,
      ]),
    ),
  ).rejects.toThrow("verified");
});
