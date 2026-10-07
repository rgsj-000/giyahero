import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  createTestIdentity,
  createAgencyFixture,
  addAgencyMember,
  grantPlatformRole,
  verificationAdminClient,
  deleteTestIdentity,
} from "./helpers/verification-fixtures";
import { validInput } from "../sql/helpers/package-input";
import { getPackageDetail } from "../../src/features/catalog/catalog-service";
import {
  submitBookingRequest,
  listMyRequests,
  decideRequest,
  cancelRequest,
  getRequestEvents,
} from "../../src/features/bookings/booking-service";
import { parseEnv } from "../../src/infrastructure/config/env";
import type { BookingInput } from "../../src/modules/bookings/types";
const env = parseEnv(process.env);
const sql = postgres(env.DATABASE_URL, { max: 4 });
type Identity = Awaited<ReturnType<typeof createTestIdentity>>;
let owner: Identity, manager: Identity, traveler: Identity, reviewer: Identity;
const identities: Identity[] = [];
let agencyId: string | undefined,
  packageId: string | undefined,
  destinationId: string | undefined,
  input: BookingInput;
beforeAll(async () => {
  for (const label of [
    "booking-owner",
    "booking-manager",
    "booking-traveler",
    "booking-reviewer",
  ])
    identities.push(await createTestIdentity(label));
  [owner, manager, traveler, reviewer] = identities;
  agencyId = await createAgencyFixture(owner.id, "booking-concurrency");
  await addAgencyMember(agencyId, manager.id, "booking_staff");
  await grantPlatformRole(reviewer.id, "content_admin");
  const { error } = await verificationAdminClient
    .from("agencies")
    .update({ status: "verified" })
    .eq("id", agencyId);
  if (error) throw error;
  destinationId = randomUUID();
  await sql`insert into public.destinations(id,province_id,slug,name) select ${destinationId},id,${"fixture-" + randomUUID()},'Concurrency test island' from public.provinces limit 1`;
  const draft = {
    ...validInput,
    slug: "fixture-" + randomUUID(),
    destinationIds: [destinationId],
  };
  const saved = await owner.client.rpc("save_package_draft", {
    target_agency_id: agencyId,
    target_package_id: null,
    expected_version: null,
    package_input: draft,
  });
  if (saved.error) throw saved.error;
  packageId = saved.data;
  const submitted = await owner.client.rpc("submit_package_review", {
    target_package_id: packageId,
    expected_version: 1,
  });
  if (submitted.error) throw submitted.error;
  const approved = await reviewer.client.rpc("review_package", {
    target_package_id: packageId,
    expected_version: 2,
    approve: true,
    review_note: "Synthetic test listing",
  });
  if (approved.error) throw approved.error;
  const detail = await getPackageDetail(traveler.client, packageId!);
  if (!detail) throw new Error("Published fixture not visible");
  input = {
    packageId: detail.id,
    expectedVersion: detail.version,
    rateId: detail.rates[0].id,
    departureId: detail.departures[0].id,
    startsOn: null,
    endsOn: null,
    adults: 2,
    children: 0,
    contactName: "Test Traveler",
    contactEmail: traveler.email,
    contactPhone: "+639123456789",
    notes: "Synthetic CI fixture",
    submissionKey: randomUUID(),
  };
}, 60000);
afterAll(async () => {
  // Cleanup only IDs created by this suite; privileged cleanup bypasses the append-only client grants.
  if (packageId) {
    await sql`delete from public.booking_events where request_id in(select id from public.booking_requests where package_id=${packageId})`;
    await sql`delete from public.booking_requests where package_id=${packageId}`;
    await sql`delete from public.package_publication_events where package_id=${packageId}`;
    await sql`delete from public.packages where id=${packageId}`;
  }
  if (agencyId) await sql`delete from public.agencies where id=${agencyId}`;
  if (destinationId)
    await sql`delete from public.destinations where id=${destinationId}`;
  for (const identity of identities) await deleteTestIdentity(identity.id);
  await sql.end();
}, 30000);
it("two independent HTTP clients cannot confirm requests beyond the last available seats", async () => {
  const same = await Promise.all([
    submitBookingRequest(traveler.client, input),
    submitBookingRequest(traveler.client, input),
  ]);
  expect(same[0].id).toBe(same[1].id);
  const second = await submitBookingRequest(traveler.client, {
    ...input,
    submissionKey: randomUUID(),
  });
  const results = await Promise.allSettled([
    decideRequest(owner.client, same[0].id, "accepted", ""),
    decideRequest(manager.client, second.id, "accepted", ""),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  const requests = await listMyRequests(traveler.client);
  const confirmed = requests.find((r) => r.status === "accepted")!;
  expect(confirmed.snapshot.totalAmountMinor).toBe(250100);
  await decideRequest(owner.client, confirmed.id, "accepted", "");
  expect(
    (await getRequestEvents(traveler.client, confirmed.id)).filter(
      (e) => e.status === "accepted",
    ),
  ).toHaveLength(1);
  expect(
    (await getPackageDetail(traveler.client, input.packageId))!.departures[0]
      .remainingCapacity,
  ).toBe(1);
  await cancelRequest(
    owner.client,
    confirmed.id,
    "Synthetic test cancellation",
  );
  expect(
    (await getPackageDetail(traveler.client, input.packageId))!.departures[0]
      .remainingCapacity,
  ).toBe(3);
}, 30000);
