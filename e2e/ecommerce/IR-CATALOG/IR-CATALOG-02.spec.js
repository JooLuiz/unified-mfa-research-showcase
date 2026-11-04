const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-02 - A module that receives only an id loads that banner, showcase, or product.

test.beforeEach(() => {
  restoreMockData();
});

test("the store home loads a banner, a showcase, and a product by id", async ({
  page,
}) => {
  const bannerById = page.waitForResponse(
    (response) => response.url().includes("/banners/b-01") && response.ok(),
  );
  const showcaseById = page.waitForResponse(
    (response) => response.url().includes("/showcases/s-01") && response.ok(),
  );
  const productById = page.waitForResponse(
    (response) => response.url().includes("/products/p-01") && response.ok(),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await Promise.all([bannerById, showcaseById, productById]);
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
