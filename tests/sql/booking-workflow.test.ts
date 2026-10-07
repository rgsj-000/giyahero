import { afterEach, beforeEach, expect, it } from "vitest";
import {
  createDatabase,
  seedCatalog,
  asActor,
  owner,
  traveler,
  outsider,
  reviewer,
  packageId,
  agencyId,
} from "./helpers/database";
let db: Awaited<ReturnType<typeof createDatabase>>;
const rateId = "50000000-0000-4000-8000-000000000001",
  departureId = "60000000-0000-4000-8000-000000000001";
function input(change: Record<string, unknown> = {}) {
  return {
    packageId,
    rateId,
    departureId,
    startsOn: null,
    endsOn: null,
    adults: 2,
    children: 0,
    contactName: "Jane Doe",
    contactEmail: "jane@example.test",
    contactPhone: "+639123456789",
    notes: "",
    submissionKey: crypto.randomUUID(),
    ...change,
  };
}
async function submit(data = input(), actor = traveler) {
  const result = await asActor(db, actor, (tx) =>
    tx.query<{ id: string }>("select public.submit_booking_request($1) id", [
      data,
    ]),
  );
  return result.rows[0].id;
}
const decision = (id: string, status: string, reason = "", actor = owner) =>
  asActor(db, actor, (tx) =>
    tx.query("select public.decide_booking_request($1,$2,$3)", [
      id,
      status,
      reason,
    ]),
  );
beforeEach(async () => {
  db = await createDatabase();
  await seedCatalog(db);
}, 30000);
afterEach(async () => {
  await db?.close();
});
it("derives identity, dates, safe price and immutable terms on the server", async () => {
  const id = await submit();
  const row = (
    await asActor(db, traveler, (tx) =>
      tx.query<{
        snapshot: { totalAmountMinor: number; title: string };
        traveler_id: string;
      }>("select * from public.booking_requests where id=$1", [id]),
    )
  ).rows[0];
  expect(row.traveler_id).toBe(traveler);
  expect(row.snapshot.totalAmountMinor).toBe(250100);
  await db.query(
    "update public.packages set title='A changed listing' where id=$1",
    [packageId],
  );
  await db.query(
    "update public.package_prices set amount_minor=999 where id=$1",
    [rateId],
  );
  const historical = (
    await asActor(db, traveler, (tx) =>
      tx.query<{ snapshot: typeof row.snapshot }>(
        "select snapshot from public.booking_requests where id=$1",
        [id],
      ),
    )
  ).rows[0];
  expect(historical.snapshot).toEqual(row.snapshot);
  await expect(submit(input({ travelerId: outsider }))).rejects.toThrow();
  await expect(submit(input({ totalAmountMinor: 1 }))).rejects.toThrow();
  await expect(
    asActor(db, outsider, (tx) =>
      tx.query("select * from public.booking_requests"),
    ),
  ).resolves.toMatchObject({ rows: [] });
  await db.query(
    "insert into public.agency_members(agency_id,user_id,role) values($1,$2,'content_staff')",
    [agencyId, reviewer],
  );
  expect(
    (
      await asActor(db, reviewer, (tx) =>
        tx.query("select * from public.booking_requests"),
      )
    ).rows,
  ).toEqual([]);
  await expect(decision(id, "accepted", "", reviewer)).rejects.toThrow(
    "Not authorized",
  );
});
it("is idempotent, rejects reused keys with different content, and never reserves pending seats", async () => {
  const data = input();
  const first = await submit(data);
  expect(await submit(data)).toBe(first);
  await expect(submit({ ...data, adults: 1 })).rejects.toThrow(
    "Submission key",
  );
  expect(
    (
      await asActor(db, null, (tx) =>
        tx.query<{ remaining_capacity: number }>(
          "select * from public.get_departure_availability($1)",
          [packageId],
        ),
      )
    ).rows[0].remaining_capacity,
  ).toBe(3);
  await expect(decision(first, "declined")).rejects.toThrow("reason");
  await decision(first, "accepted");
  await decision(first, "accepted");
  const publicDetail = (
    await asActor(db, null, (tx) =>
      tx.query<{ result: { departures: { remainingCapacity: number }[] } }>(
        "select public.get_public_package_detail($1) result",
        [packageId],
      ),
    )
  ).rows[0].result;
  expect(publicDetail.departures[0].remainingCapacity).toBe(1);
  expect(
    (
      await db.query(
        "select * from public.booking_events where request_id=$1 and status='accepted'",
        [first],
      )
    ).rows,
  ).toHaveLength(1);
  await expect(decision(first, "declined", "No capacity")).rejects.toThrow(
    "changed",
  );
  await asActor(db, owner, (tx) =>
    tx.query("select public.cancel_booking_request($1,$2)", [
      first,
      "Agency weather cancellation",
    ]),
  );
  expect(
    (
      await asActor(db, null, (tx) =>
        tx.query<{ remaining_capacity: number }>(
          "select * from public.get_departure_availability($1)",
          [packageId],
        ),
      )
    ).rows[0].remaining_capacity,
  ).toBe(3);
});
it("serializes last seats, suspends acceptance and permits cancellation/decline", async () => {
  const a = await submit(),
    b = await submit(input({}), outsider);
  await decision(a, "accepted");
  await expect(decision(b, "accepted")).rejects.toThrow("capacity");
  await expect(
    db.query("update public.package_departures set capacity=1 where id=$1", [
      departureId,
    ]),
  ).rejects.toThrow("Confirmed");
  await expect(
    db.query(
      "update public.package_departures set starts_at=starts_at+interval '1 hour' where id=$1",
      [departureId],
    ),
  ).rejects.toThrow("Confirmed");
  await expect(
    db.query("delete from public.package_departures where id=$1", [
      departureId,
    ]),
  ).rejects.toThrow("Confirmed");
  await db.query("update public.agencies set status='suspended' where id=$1", [
    agencyId,
  ]);
  await expect(decision(b, "accepted")).rejects.toThrow("available");
  await decision(b, "declined", "Agency suspended");
  await asActor(db, owner, (tx) =>
    tx.query("select public.cancel_booking_request($1,$2)", [
      a,
      "Agency suspended",
    ]),
  );
});
it("rejects cross-package selections, bad counts, elapsed cutoffs and total overflow", async () => {
  for (const change of [
    { rateId: outsider },
    { departureId: outsider },
    { adults: 0 },
    { children: -1 },
    { adults: 9 },
    { adults: 1.1 },
    { startsOn: "2030-02-30" },
  ])
    await expect(submit(input(change))).rejects.toThrow();
  await db.query(
    "update public.package_prices set amount_minor=9007199254740991 where id=$1",
    [rateId],
  );
  await expect(submit()).rejects.toThrow("supported");
  await db.query(
    "update public.package_departures set booking_cutoff_at=now()-interval '1 day' where id=$1",
    [departureId],
  );
  await expect(submit()).rejects.toThrow("cutoff");
});
it("enforces open-date inclusive duration and retains removed rates for history", async () => {
  await db.query(
    "update public.packages set schedule_model='open_dates',open_date_start='2030-01-01',open_date_end='2030-12-31' where id=$1",
    [packageId],
  );
  await expect(
    submit(
      input({
        departureId: null,
        startsOn: "2030-01-05",
        endsOn: "2030-01-05",
      }),
    ),
  ).rejects.toThrow("dates");
  const id = await submit(
    input({ departureId: null, startsOn: "2030-01-05", endsOn: "2030-01-06" }),
  );
  await db.query("delete from public.package_prices where id=$1", [rateId]);
  expect(
    (
      await db.query<{ is_active: boolean }>(
        "select is_active from public.package_prices where id=$1",
        [rateId],
      )
    ).rows[0].is_active,
  ).toBe(false);
  expect(
    (
      await asActor(db, traveler, (tx) =>
        tx.query("select * from public.booking_requests where id=$1", [id]),
      )
    ).rows,
  ).toHaveLength(1);
  await expect(
    db.query("delete from public.packages where id=$1", [packageId]),
  ).rejects.toThrow();
});
