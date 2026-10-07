import { expect, test } from "@playwright/test";

test("public home page loads without authentication", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /real agencies.*real packages.*one trusted place/i,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Get Started" }).click();
  await expect(
    page.getByRole("heading", { name: /find your next trip/i }),
  ).toBeVisible();
});

test("traveler plans, compares, and saves a preview request", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByRole("button", { name: "Start Planning" }).click();
  await page.getByLabel("Destination", { exact: true }).selectOption("Mauban");
  await page.getByLabel(/Budget per person/).fill("3200");
  await page.getByRole("button", { name: /See Gabby.s picks/ }).click();
  await expect(
    page.getByRole("button", { name: /Cagbalete Island Escape/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Quezon Grand Loop/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Compare packages" }).click();
  await expect(
    page.getByRole("heading", { name: "Compare quotations" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toContainText("₱21,798");
  await page.getByRole("button", { name: "Send request" }).click();
  await page.getByRole("button", { name: "Save preview request" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "No request has been sent",
  );
  await page.getByRole("button", { name: "View My Trips" }).click();
  await expect(page.getByRole("heading", { name: "My Trips" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Unsave Cagbalete Island Escape/ }),
  ).toBeVisible();
});

test("traveler can recover from an empty budget result", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByRole("button", { name: "Start Planning" }).click();
  await page.getByLabel(/Budget per person/).fill("1");
  await page.getByRole("button", { name: /See Gabby.s picks/ }).click();
  await expect(
    page.getByRole("heading", { name: "No packages within this budget" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adjust trip details" }).click();
  await expect(
    page.getByRole("heading", { name: "Plan your Trip" }),
  ).toBeVisible();
});
