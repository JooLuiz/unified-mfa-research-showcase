const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { setProductStock } = require("../../support/seed-empty-state");

// IR-CART-14 - A product with no stock shows Out of stock and cannot be added.

const MOUSE = "Precision Optical Mouse";

test.beforeEach(() => {
  restoreMockData();
});

function mouseCard(page) {
  return page.locator("article.card-shell", { hasText: MOUSE });
}

async function expectOutOfStock(scope) {
  await expect(scope.getByText("Out of stock")).toBeVisible();
  await expect(scope.getByRole("button", { name: "Add to Cart" })).toHaveCount(0);
}

test("a product with no stock shows Out of stock and cannot be added", async ({
  page,
}) => {
  await setProductStock("p-04", 0);
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Search").fill("mouse");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expectOutOfStock(mouseCard(page));

  await page.goto("/product?productId=p-04", { waitUntil: "domcontentloaded" });
  const details = page.locator(".pdp-shell");
  await expect(details.getByRole("heading", { name: MOUSE })).toBeVisible();
  await expectOutOfStock(details);
});
