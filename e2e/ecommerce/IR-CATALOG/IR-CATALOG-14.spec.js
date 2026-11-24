const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-14 - Clicking a product card opens its details, and a card whose product fails to load says so.

const PRODUCT_NAME = "Mechanical Wireless Keyboard";

test.beforeEach(() => {
  restoreMockData();
});

test("clicking a product card image opens that product's details", async ({
  page,
}) => {
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  const card = page.locator("article.card-shell", { hasText: PRODUCT_NAME });
  await card.getByRole("img", { name: PRODUCT_NAME }).click();

  await expect(page).toHaveURL(/\/product\?productId=p-03$/);
  await expect(
    page.locator(".pdp-shell").getByRole("heading", { name: PRODUCT_NAME }),
  ).toBeVisible();
});

test("a showcase card whose product fails to load shows it is unavailable", async ({
  page,
}) => {
  await page.route("**/api/products/p-01", (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const showcase = page.locator("angular-product-showcase");
  await expect(
    showcase.locator("article.card-shell-error", {
      hasText: "Product unavailable.",
    }),
  ).toHaveCount(1);
  await expect(
    showcase.getByText("Ergonomic Office Chair", { exact: true }),
  ).toBeVisible();
});
