const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ADMIN-08 - The dashboard shows an error when the summary cannot be loaded.

test.beforeEach(() => {
  restoreMockData();
});

test("a failed summary leaves the dashboard error on the page", async ({ page }) => {
  await page.route("**/api/admin/orders", (route) => route.abort());
  await page.route("**/api/admin/posts", (route) => route.abort());
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Unable to load dashboard data.")).toBeVisible();
});
