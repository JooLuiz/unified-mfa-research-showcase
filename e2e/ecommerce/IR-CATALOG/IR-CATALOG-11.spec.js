const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-11 - An unknown product id shows the not-found state.

test.beforeEach(() => {
  restoreMockData();
});

test("an unknown product id shows product not found", async ({ page }) => {
  await page.goto("/product?productId=does-not-exist", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByText("Product not found.")).toBeVisible();
});
