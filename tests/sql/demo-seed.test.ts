import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { asActor, createDatabase } from "./helpers/database";
import { packagePublicationInputSchema } from "../../src/modules/catalog/package";

let db: Awaited<ReturnType<typeof createDatabase>>;
const email = (name: string) => `${name}@demo.giyahero.test`;
const names = [
  "traveler",
  "owner",
  "manager",
  "booking-staff",
  "content-staff",
  "read-only",
  "super-admin",
  "agency-verifier",
  "moderator",
  "support",
  "finance",
  "content-admin",
  "island-owner",
  "heritage-owner",
  "pending-owner",
];
let seed: string;
beforeAll(async () => {
  db = await createDatabase();
  for (const name of names) {
    await db.query(
      "insert into auth.users(id,email) values(gen_random_uuid(),$1)",
      [email(name)],
    );
  }
  seed = await readFile("supabase/seed/010_demo_catalog.sql", "utf8");
  await db.exec(seed);
}, 30000);
afterAll(async () => {
  await db?.close();
});

it("makes twelve complete image-backed tours visible to guests", async () => {
  const result = await asActor(db, null, (tx) =>
    tx.query<{ catalog: { items: { id: string; imagePath: string }[] } }>(
      "select public.search_published_packages('{}') catalog",
    ),
  );
  expect(result.rows[0].catalog.items).toHaveLength(12);
  for (const item of result.rows[0].catalog.items) {
    expect(item.imagePath).toMatch(/\.webp$/);
    const readable = await asActor(db, null, (tx) =>
      tx.query<{ allowed: boolean }>(
        "select public.can_read_package_image($1) allowed",
        [item.imagePath],
      ),
    );
    expect(readable.rows[0].allowed).toBe(true);
    const detail = await asActor(db, null, (tx) =>
      tx.query<{ detail: { itinerary: unknown[]; rates: unknown[] } }>(
        "select public.get_public_package_detail($1) detail",
        [item.id],
      ),
    );
    expect(detail.rows[0].detail.itinerary.length).toBeGreaterThan(0);
    expect(detail.rows[0].detail.rates.length).toBeGreaterThan(0);
  }
});
it("supports real booking submission and retains every demo state", async () => {
  const result = await db.query<{ status: string }>(
    "select status from public.booking_requests order by status::text",
  );
  expect(result.rows.map((r) => r.status)).toEqual([
    "accepted",
    "cancelled",
    "declined",
    "pending",
  ]);
  expect(
    (await db.query("select * from public.booking_events")).rows.length,
  ).toBeGreaterThan(4);
});
it("creates editable package inputs with destination IDs accepted by the app", async () => {
  const drafts = await db.query<{ draft_payload: unknown }>(
    "select draft_payload from public.packages",
  );
  for (const row of drafts.rows) {
    expect(
      packagePublicationInputSchema.safeParse(row.draft_payload).success,
    ).toBe(true);
  }
});
it("keeps each permission separate and leaves review work for admins", async () => {
  expect(
    (
      await db.query(
        "select distinct role from public.platform_admin_memberships",
      )
    ).rows,
  ).toHaveLength(6);
  expect(
    (await db.query("select distinct role from public.agency_members")).rows,
  ).toHaveLength(5);
  expect(
    (
      await db.query(
        "select id from public.packages where publication_status='pending_first_review'",
      )
    ).rows,
  ).toHaveLength(2);
  expect(
    (
      await db.query(
        "select id from public.agency_verification_submissions where status='submitted'",
      )
    ).rows,
  ).toHaveLength(1);
  const staff = (
    await db.query<{ id: string }>("select id from auth.users where email=$1", [
      email("read-only"),
    ])
  ).rows[0].id;
  await expect(
    asActor(db, staff, (tx) =>
      tx.query(
        "select public.save_package_draft((select agency_id from public.agency_members where user_id=auth.uid()),null,null,'{}')",
      ),
    ),
  ).rejects.toThrow("Not authorized");
});
it("can run again without duplicating tours, memberships or bookings", async () => {
  const before = await db.query(
    "select (select count(*) from public.packages) packages,(select count(*) from public.booking_requests) bookings,(select count(*) from public.booking_events) events,(select count(*) from public.agency_members) members",
  );
  await db.exec(seed);
  expect(
    (
      await db.query(
        "select (select count(*) from public.packages) packages,(select count(*) from public.booking_requests) bookings,(select count(*) from public.booking_events) events,(select count(*) from public.agency_members) members",
      )
    ).rows,
  ).toEqual(before.rows);
});
it("recognizes existing demo tours after their editable slugs change", async () => {
  const original = (
    await db.query<{ id: string }>(
      "select id from public.packages where slug='demo-pagbilao-cove'",
    )
  ).rows[0].id;
  await db.query(
    "update public.packages set slug='renamed-pagbilao-trip' where id=$1",
    [original],
  );
  await db.exec(seed);
  expect((await db.query("select id from public.packages")).rows).toHaveLength(
    15,
  );
  expect(
    (
      await db.query<{ id: string }>(
        "select id from public.packages where slug='renamed-pagbilao-trip'",
      )
    ).rows[0].id,
  ).toBe(original);
});
