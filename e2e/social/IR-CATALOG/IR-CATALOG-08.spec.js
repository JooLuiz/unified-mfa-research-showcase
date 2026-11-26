const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-08 - The feed showcase comes back once after leaving the feed, and See More opens the product.

const PRODUCT_NAME = "Minimalist Desk Lamp";

test.beforeEach(() => {
  restoreMockData();
});

test("returning to the feed shows one expanded showcase after it was hidden", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const showcase = page.locator("angular-product-showcase");
  await expect(showcase.getByText(PRODUCT_NAME, { exact: true })).toBeVisible();

  await showcase.getByRole("button", { name: "Hide" }).click();
  await expect(showcase.getByText(PRODUCT_NAME, { exact: true })).toBeHidden();

  await page.getByRole("button", { name: "Posts", exact: true }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.locator("angular-product-showcase")).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/localhost:4500\/?$/);
  await expect(page.locator("angular-product-showcase")).toHaveCount(1);
  await expect(showcase.getByText(PRODUCT_NAME, { exact: true })).toBeVisible();
  await expect(showcase.getByRole("button", { name: "Hide" })).toBeVisible();
});

test("a showcase card's See More button opens that product in the store", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const card = page.locator("angular-product-showcase article.card-shell", { hasText: PRODUCT_NAME });

  await card.getByRole("button", { name: "See More" }).click();

  await expect(page).toHaveURL("http://localhost:4200/product?productId=p-01");
  await expect(page.getByRole("heading", { name: PRODUCT_NAME })).toBeVisible();
});
