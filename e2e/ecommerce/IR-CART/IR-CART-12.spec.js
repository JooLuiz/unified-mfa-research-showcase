const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CART-12 - A guest who opens checkout is sent to login.

test.beforeEach(() => {
  restoreMockData();
});

test("a guest who opens checkout is sent to login", async ({ page }) => {
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Log in to MFE Lab" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Order Placed!" }),
  ).toHaveCount(0);
});
