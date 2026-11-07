const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-01 - On open, the store loads products, showcases, and banners.

test.beforeEach(() => {
  restoreMockData();
});

test("the store home shows a banner, a showcase, and its products", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Upgrade Your Focus" }),
  ).toBeVisible();
  const showcase = page.locator("angular-product-showcase");
  await expect(
    showcase.getByRole("heading", { name: "Work from Home Essentials" }),
  ).toBeVisible();
  await expect(
    showcase.getByText("Minimalist Desk Lamp", { exact: true }),
  ).toBeVisible();
});
