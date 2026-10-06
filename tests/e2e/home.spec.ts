import { expect, test } from "@playwright/test";

test("public home page loads without authentication", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /GiyaHero/i })).toBeVisible();
});
