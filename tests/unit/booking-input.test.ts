import { expect, it } from "vitest";
import { bookingInputSchema } from "../../src/modules/bookings/request";
const input = {
  packageId: "30000000-0000-4000-8000-000000000001",
  expectedVersion: 1,
  rateId: "50000000-0000-4000-8000-000000000001",
  departureId: "60000000-0000-4000-8000-000000000001",
  startsOn: null,
  endsOn: null,
  adults: 1,
  children: 0,
  contactName: " Jane Doe ",
  contactEmail: " jane@example.test ",
  contactPhone: " +639123456789 ",
  notes: "",
  submissionKey: "80000000-0000-4000-8000-000000000001",
};
it("normalizes contacts and rejects forged identities or amounts", () => {
  expect(bookingInputSchema.parse(input).contactName).toBe("Jane Doe");
  expect(
    bookingInputSchema.safeParse({ ...input, totalAmountMinor: 1 }).success,
  ).toBe(false);
  expect(
    bookingInputSchema.safeParse({ ...input, travelerId: input.packageId })
      .success,
  ).toBe(false);
});
it("rejects invalid counts, dates, contacts and keys", () => {
  for (const change of [
    { adults: 0 },
    { children: -1 },
    { adults: 1.5 },
    { startsOn: "2030-02-30", departureId: null },
    { contactEmail: "x" },
    { notes: "x".repeat(2001) },
    { submissionKey: "x" },
  ])
    expect(bookingInputSchema.safeParse({ ...input, ...change }).success).toBe(
      false,
    );
});
