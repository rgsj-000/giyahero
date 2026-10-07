import type { Page } from "@playwright/test";
import { liveDetail, mockCatalog } from "./catalog-responses";
import { testUser, seedBrowserSession } from "./test-session";
export async function mockBookings(page: Page, timeoutOnce = false) {
  await mockCatalog(page);
  await seedBrowserSession(page);
  const rows: Record<string, unknown>[] = [];
  const keys = new Map<string, string>();
  let attempts = 0;
  const snapshot = {
    title: liveDetail.title,
    agencyName: liveDetail.agencyName,
    currencyCode: "PHP",
    totalAmountMinor: 250100,
    rateLabel: "Standard",
    pricingModel: "per_person",
    startsOn: "2030-12-01",
    endsOn: "2030-12-02",
    startsAt: liveDetail.departures[0].startsAt,
    endsAt: liveDetail.departures[0].endsAt,
    adults: 2,
    children: 0,
    itinerary: liveDetail.itinerary,
    inclusions: liveDetail.inclusions,
    exclusions: liveDetail.exclusions,
    policies: liveDetail.policies,
    paymentTerms:
      "Agency-arranged payment. Confirmation does not mean payment has been received.",
  };
  const add = (status = "pending") => {
    const row = {
      id: crypto.randomUUID(),
      traveler_id: testUser.id,
      agency_id: liveDetail.agencyId,
      package_id: liveDetail.id,
      rate_id: liveDetail.rates[0].id,
      departure_id: liveDetail.departures[0].id,
      status,
      snapshot,
      contact_name: "Jane Doe",
      contact_email: "jane@example.test",
      contact_phone: "+639123456789",
      notes: "",
      created_at: "2026-10-07T00:00:00Z",
      decided_at: null,
      decision_reason: "",
    };
    rows.push(row);
    return row;
  };
  await page.route("https://staging.example.test/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith("/auth/v1/user"))
      return route.fulfill({ json: testUser });
    if (path.endsWith("/agency_members"))
      return route.fulfill({
        json: [
          {
            agency_id: liveDetail.agencyId,
            role: "owner",
            agencies: { name: liveDetail.agencyName },
          },
        ],
      });
    if (path.endsWith("/submit_booking_request")) {
      attempts++;
      const key = route.request().postDataJSON().request_input.submissionKey;
      let id = keys.get(key);
      if (!id) {
        id = add().id;
        keys.set(key, id);
      }
      if (timeoutOnce && attempts === 1) return route.abort("timedout");
      return route.fulfill({ json: id });
    }
    if (path.endsWith("/booking_requests")) {
      const id = url.searchParams.get("id")?.slice(3);
      return route.fulfill({ json: id ? rows.find((r) => r.id === id) : rows });
    }
    if (path.endsWith("/booking_events")) {
      const id = url.searchParams.get("request_id")?.slice(3);
      const row = rows.find((r) => r.id === id);
      return route.fulfill({
        json: row
          ? [
              {
                id: "event",
                request_id: id,
                status: row.status,
                reason: row.decision_reason,
                created_at: "2026-10-07T00:00:00Z",
              },
            ]
          : [],
      });
    }
    if (path.endsWith("/cancel_booking_request")) {
      const body = route.request().postDataJSON();
      const row = rows.find((r) => r.id === body.target_request_id);
      if (row) {
        row.status = "cancelled";
        row.decision_reason = body.reason;
      }
      return route.fulfill({ json: null });
    }
    if (path.endsWith("/decide_booking_request")) {
      const body = route.request().postDataJSON();
      const row = rows.find((r) => r.id === body.target_request_id);
      if (row?.status !== "pending")
        return route.fulfill({
          status: 409,
          json: { message: "Request changed; refresh before deciding" },
        });
      if (row) {
        row.status = body.target_status;
        row.decision_reason = body.reason;
      }
      return route.fulfill({ json: null });
    }
    return route.fallback();
  });
  return {
    rows,
    add,
    keys,
    get attempts() {
      return attempts;
    },
  };
}
