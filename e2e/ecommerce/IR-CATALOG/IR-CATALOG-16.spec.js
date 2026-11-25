const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-16 - Product details keeps quantity at least 1, and leaving before it loads is quiet.

const PRODUCT_NAME = "Mechanical Wireless Keyboard";

test.beforeEach(() => {
  restoreMockData();
});

test("decrementing at quantity 1 stays at 1", async ({ page }) => {
  await page.goto("/product?productId=p-03", { waitUntil: "domcontentloaded" });
  const details = page.locator(".pdp-shell");
  await expect(details.getByRole("heading", { name: PRODUCT_NAME })).toBeVisible();
  const quantity = details.locator(".pdp-quantity-value-input");
  const decrease = details.getByRole("button", { name: "-", exact: true });
  const increase = details.getByRole("button", { name: "+", exact: true });

  await decrease.click();
  await decrease.click();
  await expect(quantity).toHaveValue("1");
  await increase.click();
  await expect(quantity).toHaveValue("2");
  await decrease.click();
  await expect(quantity).toHaveValue("1");
});

test("leaving before the product loads shows the list and no error", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  await page.route("**/api/products/p-03", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue().catch(() => {});
  });

  await page.goto("/product?productId=p-03", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Products" }).click();

  await expect(
    page.locator("article.card-shell", { hasText: PRODUCT_NAME }),
  ).toBeVisible();
  await expect(page.locator(".pdp-shell")).toHaveCount(0);

  await page.waitForTimeout(2000);
  expect(pageErrors).toEqual([]);
  await expect(page.locator(".pdp-shell")).toHaveCount(0);
});
