import { expect, test } from "@playwright/test";
import { mockBookings } from "./helpers/booking-responses";
import { liveDetail } from "./helpers/catalog-responses";
const inbox = "/#agency/" + liveDetail.agencyId + "/requests";
for (const role of ["owner", "manager", "booking_staff"])
  test(
    role + " approves a request and the traveler sees confirmation",
    async ({ page }) => {
      const api = await mockBookings(page);
      const row = api.add();
      await page.route("**/rest/v1/agency_members*", (r) =>
        r.fulfill({
          json: [
            {
              agency_id: liveDetail.agencyId,
              role,
              agencies: { name: liveDetail.agencyName },
            },
          ],
        }),
      );
      await page.goto(inbox);
      await page.getByRole("button", { name: /Real Island Trip/ }).click();
      await expect(page.getByText("jane@example.test")).toBeVisible();
      page.once("dialog", (d) => d.accept());
      await page
        .getByRole("button", { name: "Accept request", exact: true })
        .click();
      await expect(
        page.getByText("Confirmed", { exact: true }).first(),
      ).toBeVisible();
      await page.goto("/#request/" + row.id);
      await expect(
        page.getByText("Confirmed", { exact: true }).first(),
      ).toBeVisible();
    },
  );
for (const role of ["content_staff", "read_only"])
  test(role + " cannot view booking contacts", async ({ page }) => {
    await mockBookings(page);
    await page.route("**/rest/v1/agency_members*", (r) =>
      r.fulfill({
        json: [
          {
            agency_id: liveDetail.agencyId,
            role,
            agencies: { name: liveDetail.agencyName },
          },
        ],
      }),
    );
    await page.goto(inbox);
    await expect(
      page.getByText(
        "Your role cannot view booking requests or traveler contacts.",
      ),
    ).toBeVisible();
    await expect(page.getByText("jane@example.test")).toHaveCount(0);
  });
test("requires decline and confirmed cancellation explanations", async ({
  page,
}) => {
  const api = await mockBookings(page);
  api.add();
  await page.goto(inbox);
  await page.getByRole("button", { name: /Real Island Trip/ }).click();
  await expect(
    page.getByRole("button", { name: "Decline request", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Decision explanation").fill("No guide available");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Decline request", exact: true })
    .click();
  await expect(
    page.getByText("Declined", { exact: true }).first(),
  ).toBeVisible();
  const confirmed = api.add("accepted");
  await page.goto(inbox + "/" + confirmed.id);
  await expect(
    page.getByRole("button", { name: "Cancel confirmed request" }),
  ).toBeDisabled();
  await page
    .getByLabel("Decision explanation")
    .fill("Cancelled due to weather");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cancel confirmed request" }).click();
  await expect(
    page.getByText("Cancelled", { exact: true }).first(),
  ).toBeVisible();
});
test("stale staff decisions refresh without overwriting confirmation", async ({
  page,
}) => {
  const api = await mockBookings(page);
  const row = api.add();
  await page.goto(inbox + "/" + row.id);
  await expect(
    page.getByText("Pending agency approval", { exact: true }),
  ).toBeVisible();
  row.status = "accepted";
  await page.getByLabel("Decision explanation").fill("Unable to fulfill");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Decline request", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Request changed",
  );
  await expect(
    page.getByText("Confirmed", { exact: true }).first(),
  ).toBeVisible();
  expect(row.status).toBe("accepted");
});
