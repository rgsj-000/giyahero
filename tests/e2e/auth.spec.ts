import { expect, test } from "@playwright/test";

test("traveler can open the sign in screen", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: /welcome back/i }),
  ).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /create an account/i }),
  ).toBeVisible();
});

test("traveler can open the registration screen", async ({ page }) => {
  await page.goto("/register");

  await expect(
    page.getByRole("heading", { name: /create your giyahero account/i }),
  ).toBeVisible();
  await expect(page.getByLabel(/full name/i)).toBeVisible();
  await expect(page.getByLabel(/^email$/i)).toBeVisible();
  await expect(page.getByLabel(/^password$/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^create account$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toBeVisible();
});
