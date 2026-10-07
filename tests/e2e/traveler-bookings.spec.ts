import { expect, test } from "@playwright/test";
import { mockBookings } from "./helpers/booking-responses";
async function fill(page: import("@playwright/test").Page) {
  await page.goto("/#package/30000000-0000-4000-8000-000000000001");
  await page
    .getByRole("button", { name: "Request booking", exact: true })
    .click();
  await page
    .getByLabel("Price option")
    .selectOption("50000000-0000-4000-8000-000000000001");
  await page
    .getByLabel("Departure")
    .selectOption("60000000-0000-4000-8000-000000000001");
  await page.getByLabel("Adults").fill("2");
  await page.getByLabel("Contact name").fill("Jane Doe");
  await page.getByLabel("Contact email").fill("jane@example.test");
  await page.getByLabel("Contact phone").fill("+639123456789");
}
test("persists a pending request and cancellation in My Trips", async ({
  page,
}) => {
  const api = await mockBookings(page);
  await fill(page);
  await expect(page.getByText("Quoted total")).toBeVisible();
  await page.getByRole("button", { name: "Send booking request" }).click();
  await expect(
    page.getByRole("heading", { name: "Booking request" }),
  ).toBeVisible();
  await expect(
    page.getByText("Pending agency approval", { exact: true }),
  ).toBeVisible();
  expect(api.rows).toHaveLength(1);
  await page.reload();
  await expect(
    page.getByText("Pending agency approval", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cancel pending request" }).click();
  await expect(
    page.getByText("Cancelled", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "My Trips", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Real Island Trip/ }),
  ).toBeVisible();
});
test("a lost response retries the same submission key without duplicating the request", async ({
  page,
}) => {
  const api = await mockBookings(page, true);
  await fill(page);
  await page.getByRole("button", { name: "Send booking request" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Retry",
  );
  await page.getByRole("button", { name: "Retry request" }).click();
  await expect(
    page.getByText("Pending agency approval", { exact: true }),
  ).toBeVisible();
  expect(api.keys.size).toBe(1);
  expect(api.attempts).toBe(2);
});
test("confirmed and declined requests retain their original quotation and terms", async ({
  page,
}) => {
  const api = await mockBookings(page);
  const row = api.add("accepted");
  await page.goto("/#request/" + row.id);
  await expect(
    page.getByText("Confirmed", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Agency-arranged payment. Confirmation does not mean payment has been received.",
    ),
  ).toBeVisible();
  row.status = "declined";
  row.decision_reason = "The departure is full";
  await page.reload();
  await expect(
    page.getByText("Declined", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("The departure is full").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Real Island Trip" }),
  ).toBeVisible();
});
