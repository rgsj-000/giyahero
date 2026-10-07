import { expect, test } from "@playwright/test";
import { mockCatalog } from "./helpers/catalog-responses";
test("browses a live published package and its actual terms", async ({
  page,
}) => {
  await mockCatalog(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Find your next trip" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View Real Island Trip" }).click();
  await expect(
    page.getByRole("heading", { name: "Real Island Trip", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Contact the agency to cancel.")).toBeVisible();
  await expect(page.getByText(/94% match/)).toHaveCount(0);
});
test("filters live inventory with the entered budget", async ({ page }) => {
  await mockCatalog(page);
  await page.goto("/");
  await page.getByLabel("Maximum total budget (PHP)").fill("1");
  await page.getByRole("button", { name: "Find packages" }).click();
  await expect(page.getByText("No packages match your trip.")).toBeVisible();
});
test("shows an honest empty catalog", async ({ page }) => {
  await mockCatalog(page, "empty");
  await page.goto("/");
  await expect(page.getByText("No packages match your trip.")).toBeVisible();
  await expect(page.getByText("Quezon Grand Loop")).toHaveCount(0);
});
test("offers retry after a catalog failure", async ({ page }) => {
  await mockCatalog(page, "error");
  await page.goto("/");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Catalog temporarily unavailable",
  );
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});
