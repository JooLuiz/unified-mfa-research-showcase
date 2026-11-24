const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-15 - A home showcase that fails to load shows its error and no cards.

test.beforeEach(() => {
  restoreMockData();
});

test("a failed showcase request shows the showcase error and no cards", async ({
  page,
}) => {
  await page.route("**/api/showcases/**", (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const showcase = page.locator("angular-product-showcase");
  await expect(showcase.getByText("Unable to load showcase.")).toBeVisible();
  await expect(showcase.locator("article.card-shell")).toHaveCount(0);
});
