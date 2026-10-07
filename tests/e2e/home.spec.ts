import { expect, test } from "@playwright/test";
import { mockCatalog } from "./helpers/catalog-responses";
test("public home page loads without authentication", async ({ page }) => {
  await mockCatalog(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Find your next trip" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
});
test("guest sees a sign-in path for booking requests", async ({ page }) => {
  await mockCatalog(page);
  await page.goto("/#trips");
  await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in to continue" }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
});
