const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { setProductStock } = require("../../support/seed-empty-state");

// IR-CART-15 - Adding is unavailable when the product has no stock, and the cart count stays 0.

test.beforeEach(() => {
  restoreMockData();
});

test("an unavailable product leaves the cart count unchanged", async ({ page }) => {
  await setProductStock("p-04", 0);
  await page.goto("/product?productId=p-04", { waitUntil: "domcontentloaded" });
  const details = page.locator(".pdp-shell");
  await expect(details.getByText("Out of stock")).toBeVisible();
  await expect(details.getByRole("button", { name: "Add to Cart" })).toHaveCount(0);
  await expect(page.locator(".cart-item-count")).toHaveText("0");
});
