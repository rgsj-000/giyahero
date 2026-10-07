import { expect, test } from "@playwright/test";
import { seedBrowserSession, testUser } from "./helpers/test-session";
import { liveCard } from "./helpers/catalog-responses";
test("agency saves a package draft and submits it for first review", async ({
  page,
}) => {
  await seedBrowserSession(page);
  let input: Record<string, unknown> | null = null;
  let version = 1;
  let status = "draft";
  await page.route("https://staging.example.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user")) return route.fulfill({ json: testUser });
    if (path.includes("agency_members"))
      return route.fulfill({
        json: [
          {
            agency_id: liveCard.agencyId,
            role: "owner",
            agencies: { name: liveCard.agencyName },
          },
        ],
      });
    if (path.includes("destinations"))
      return route.fulfill({
        json: [{ id: "40000000-0000-4000-8000-000000000001", name: "Island" }],
      });
    if (path.includes("package_publication_events"))
      return route.fulfill({
        json:
          status === "changes_requested"
            ? [
                {
                  id: "review",
                  status: "changes_requested",
                  note: "Explain the meeting point clearly.",
                  created_at: "2026-10-07T00:00:00Z",
                },
              ]
            : [],
      });
    if (path.endsWith("save_package_draft")) {
      input = route.request().postDataJSON().package_input;
      return route.fulfill({ json: liveCard.id });
    }
    if (path.endsWith("get_package_draft"))
      return route.fulfill({
        json: { input, version, status, firstReviewedAt: null },
      });
    if (path.endsWith("submit_package_review")) {
      status = "pending_first_review";
      version++;
      return route.fulfill({ body: "", status: 204 });
    }
    if (path.includes("/packages"))
      return route.fulfill({
        json: input
          ? [
              {
                id: liveCard.id,
                title: input.title,
                version,
                publication_status: status,
              },
            ]
          : [],
      });
    return route.fulfill({ json: [] });
  });
  await page.goto("/#agency");
  await page
    .getByRole("button", { name: liveCard.agencyName, exact: true })
    .click();
  await page.getByRole("button", { name: "Create package" }).click();
  await page.getByLabel("Package title").fill("New Quezon Island Trip");
  await page.getByLabel("Package address").fill("new-quezon-island");
  await page
    .getByLabel("Overview")
    .fill(
      "A carefully planned island journey with comfortable transfers and an experienced local guide.",
    );
  await page.getByLabel("Island", { exact: true }).check();
  await page.getByRole("button", { name: "Add itinerary day" }).click();
  await page.getByLabel("Day 1 title").fill("Island visit");
  await page
    .getByLabel("Day 1 description")
    .fill("Visit the island with a local guide.");
  await page.getByLabel("Included (one per line)").fill("Local guide");
  await page
    .getByLabel("Additional expenses (one per line)")
    .fill("Personal expenses");
  await page.getByRole("button", { name: "Add price option" }).click();
  await page.getByLabel("Price option 1 label").fill("Standard");
  await page
    .getByLabel("Price option 1 amount", { exact: true })
    .fill("1250.50");
  await page.getByLabel("Available from").fill("2030-12-01");
  await page.getByLabel("Available until").fill("2030-12-31");
  await page
    .getByLabel("Cancellation terms", { exact: true })
    .fill("Contact the agency to cancel.");
  await page
    .getByLabel("Rescheduling terms", { exact: true })
    .fill("Contact the agency to reschedule.");
  await page
    .getByLabel("Missed departure terms", { exact: true })
    .fill("No refund for a missed departure.");
  await page
    .getByLabel("Agency cancellation terms", { exact: true })
    .fill("Agency will arrange a refund.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(
    page.getByRole("heading", { name: "Edit package" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(
    page.getByText("Awaiting first publication review"),
  ).toBeVisible();
  status = "changes_requested";
  version++;
  await page.reload();
  await expect(
    page.getByText("Explain the meeting point clearly."),
  ).toBeVisible();
  await page.evaluate(() => {
    window.location.hash =
      "agency/20000000-0000-4000-8000-000000000001/packages/new";
  });
  await expect(page.getByLabel("Package title")).toHaveValue("");
});
