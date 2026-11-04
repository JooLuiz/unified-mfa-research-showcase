const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CART-01 - A card, showcase, or product page asks to put { productId, quantity } in the cart.

const PRODUCT_NAME = "Mechanical Wireless Keyboard";
const QUANTITY = 2;

test.beforeEach(() => {
  restoreMockData();
});

async function raiseQuantity(scope) {
  await expect(
    scope.getByRole("button", { name: "Add to Cart" }),
  ).toBeVisible();
  await scope.getByRole("button", { name: "+", exact: true }).click();
  await expect(scope.locator('input[type="number"]')).toHaveValue(
    String(QUANTITY),
  );
}

async function expectItemInCart(page) {
  await expect(page.getByRole("status")).toContainText(
    `${PRODUCT_NAME} was added to your cart.`,
  );
  await expect(page.locator(".cart-item-count")).toHaveText(String(QUANTITY));
  await expect(
    page.getByRole("button", { name: "Total: $241.00" }),
  ).toBeVisible();
}

test("a product card on the list asks to add the chosen quantity", async ({
  page,
}) => {
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  const card = page.locator("article.card-shell", { hasText: PRODUCT_NAME });
  await raiseQuantity(card);
  await card.getByRole("button", { name: "Add to Cart" }).click();
  await expectItemInCart(page);
});

test("a home showcase card asks to add the chosen quantity", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const card = page
    .locator("angular-product-showcase")
    .locator("article.card-shell", { hasText: PRODUCT_NAME });
  await raiseQuantity(card);
  await card.getByRole("button", { name: "Add to Cart" }).click();
  await expectItemInCart(page);
});

test("the product page asks to add the chosen quantity", async ({ page }) => {
  await page.goto("/product?productId=p-03", { waitUntil: "domcontentloaded" });
  const details = page.locator(".pdp-shell");
  await expect(
    details.getByRole("heading", { name: PRODUCT_NAME }),
  ).toBeVisible();
  await raiseQuantity(details);
  await details.getByRole("button", { name: "Add to Cart" }).click();
  await expectItemInCart(page);
});
