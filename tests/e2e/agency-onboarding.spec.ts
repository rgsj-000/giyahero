import { expect, test } from "@playwright/test";

test("agency can open the onboarding screen", async ({ page }) => {
  await page.goto("/agency/onboarding");

  await expect(
    page.getByRole("heading", { name: /register your travel agency/i }),
  ).toBeVisible();
  await expect(page.getByLabel(/^agency name$/i)).toBeVisible();
  await expect(page.getByLabel(/legal or business name/i)).toBeVisible();
  await expect(page.getByLabel(/public url slug/i)).toBeVisible();
  await expect(page.getByLabel(/contact email/i)).toBeVisible();
  await expect(page.getByLabel(/contact phone/i)).toBeVisible();
  await expect(page.getByLabel(/website/i)).toBeVisible();
  await expect(page.getByLabel(/about your agency/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /create agency workspace/i }),
  ).toBeVisible();
  await expect(page.getByText(/verification comes next/i)).toBeVisible();
});
