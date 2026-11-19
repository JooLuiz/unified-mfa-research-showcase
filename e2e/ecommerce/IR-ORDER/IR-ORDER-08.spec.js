const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ORDER-08 - Order details with no id shows the missing-order state.

test.beforeEach(() => {
  restoreMockData();
});

test("order details with no id shows the missing-order state", async ({ page }) => {
  await page.goto("/order-details/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("a guest opening an order is sent to login", async ({ page }) => {
  await page.goto("/order-details/order-mp20d2w4-s59o9n", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Log in to MFE Lab" })).toBeVisible();
});
