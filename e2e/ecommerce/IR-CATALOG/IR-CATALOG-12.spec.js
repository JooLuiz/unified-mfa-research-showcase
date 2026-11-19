const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-12 - The home banner shows an empty state when the banner cannot be loaded.

test.beforeEach(() => {
  restoreMockData();
});

test("a failed banner request shows that no banner is available", async ({ page }) => {
  await page.route("**/api/banners/**", (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("No banner available.")).toBeVisible();
});
