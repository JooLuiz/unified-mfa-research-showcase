const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-10 - A failed product list, then a search with no matches, shows the error and then an empty grid.

test.beforeEach(() => {
  restoreMockData();
});

test("a failed product list shows the error, then an empty search shows the empty grid", async ({
  page,
}) => {
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await expect(page.locator("article.card-shell").first()).toBeVisible();

  await page.route("**/api/products**", (route) => route.abort());
  const searchInput = page.getByRole("textbox", { name: "Search" });
  await searchInput.fill("lamp");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("Unable to load products.")).toBeVisible();

  await page.unroute("**/api/products**");
  await searchInput.fill("zzzz-no-such-product");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("Unable to load products.")).toHaveCount(0);
  await expect(page.locator("article.card-shell")).toHaveCount(0);
  await expect(page.locator(".product-grid")).toHaveCount(1);
});
