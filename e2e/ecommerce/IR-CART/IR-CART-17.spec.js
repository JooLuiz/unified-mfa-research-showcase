const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CART-17 - A typed card quantity is held between one and the available stock, and that quantity goes to the cart.

const PRODUCT_NAME = "Bamboo Desk Organizer";
const AVAILABLE_STOCK = 3;

test.beforeEach(() => {
  restoreMockData();
});

async function openProductCard(page) {
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  const card = page.locator("article.card-shell", { hasText: PRODUCT_NAME });
  await expect(card.getByText(`${AVAILABLE_STOCK} available`)).toBeVisible();
  return card;
}

async function typeQuantity(card, typedValue) {
  const quantityInput = card.locator('input[type="number"]');
  await quantityInput.fill(typedValue);
  await quantityInput.press("Tab");
  return quantityInput;
}

test("a quantity above the stock becomes the stock, and that many go to the cart", async ({
  page,
}) => {
  const card = await openProductCard(page);
  const quantityInput = await typeQuantity(card, "9");
  await expect(quantityInput).toHaveValue(String(AVAILABLE_STOCK));

  await card.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByRole("status")).toContainText(
    `${PRODUCT_NAME} was added to your cart.`,
  );
  await expect(page.locator(".cart-item-count")).toHaveText(
    String(AVAILABLE_STOCK),
  );
  await expect(
    page.getByRole("button", { name: "Total: $75.00" }),
  ).toBeVisible();
});

test("a quantity below one becomes one", async ({ page }) => {
  const card = await openProductCard(page);
  const quantityInput = await typeQuantity(card, "0");
  await expect(quantityInput).toHaveValue("1");
});
