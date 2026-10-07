import { expect, test } from "@playwright/test";
import { mockBookings } from "./helpers/booking-responses";
import { seedBrowserSession } from "./helpers/test-session";
import { liveDetail } from "./helpers/catalog-responses";
test("mobile bundle submits, approves and restores a persisted trip after restart", async ({
  page,
}) => {
  const api = await mockBookings(page);
  const session = await seedBrowserSession(page);
  await page.addInitScript((s) => {
    if (!localStorage.getItem("test-seeded")) {
      localStorage.setItem("giyahero-native-auth", JSON.stringify(s));
      localStorage.setItem("test-seeded", "true");
    }
  }, session);
  await page.goto("/");
  await expect(
    page.getByText("Real Island Trip", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Real Island Trip/ }).click();
  await page
    .getByRole("button", { name: "Request booking", exact: true })
    .click();
  await page.getByLabel("Price option").selectOption(liveDetail.rates[0].id);
  await page.getByLabel("Departure").selectOption(liveDetail.departures[0].id);
  await page.getByLabel("Adults").fill("2");
  await page.getByLabel("Contact name").fill("Jane Doe");
  await page.getByLabel("Contact email").fill("jane@example.test");
  await page.getByLabel("Contact phone").fill("+639123456789");
  await page.getByRole("button", { name: "Send booking request" }).click();
  await expect(
    page.getByText("Pending agency approval", { exact: true }),
  ).toBeVisible();
  await page.goto("/#agency/" + liveDetail.agencyId + "/requests");
  await page.getByRole("button", { name: /Real Island Trip/ }).click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Accept request", exact: true })
    .click();
  await expect(
    page.getByText("Confirmed", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "My Trips", exact: true }).click();
  await page.getByRole("button", { name: /Real Island Trip/ }).click();
  await page.reload();
  await expect(
    page.getByText("Confirmed", { exact: true }).first(),
  ).toBeVisible();
  expect(api.rows).toHaveLength(1);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("giyahero-native-auth")),
  ).toBeNull();
});
test("mobile sign-in returns to the requested booking screen", async ({
  page,
}) => {
  await mockBookings(page);
  const session = await seedBrowserSession(page);
  await page.route("**/auth/v1/token*", (r) => r.fulfill({ json: session }));
  await page.goto("/#package/" + liveDetail.id);
  await page
    .getByRole("button", { name: "Request booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sign in to GiyaHero" }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Price option")).toBeVisible();
});
