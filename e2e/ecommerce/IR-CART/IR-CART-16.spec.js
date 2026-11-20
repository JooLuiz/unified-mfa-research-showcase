const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedCart } = require("../../support/seed-cart");
const { signIn } = require("../../support/sign-in");

// IR-CART-16 - Checkout draws a saved line whose product is not in the catalog as an empty row.

const KEYBOARD = "Mechanical Wireless Keyboard";

test.beforeEach(() => {
  restoreMockData();
});

test("an unknown product shares checkout with a known line and has no name", async ({
  page,
}) => {
  await seedCart("bruno.silva", [
    { productId: "p-03", quantity: 1 },
    { productId: "missing-product", quantity: 1 },
  ]);
  await signIn(page, {
    username: "bruno.silva",
    tokenKey: "ecommerce-shell:auth-token",
    userKey: "ecommerce-shell:auth-user",
  });
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: "Checkout", exact: true }),
  ).toBeVisible();
  const keyboard = page.locator("article.checkout-item", { hasText: KEYBOARD });
  await expect(keyboard.getByText(KEYBOARD)).toBeVisible();
  await expect(keyboard.getByText("$120.50")).toBeVisible();
  await expect(page.locator("article.checkout-item")).toHaveCount(2);
  await expect(page.locator("article.checkout-item strong")).toHaveCount(1);
  await expect(page.getByText("There are no items in your cart")).toHaveCount(0);
  await expect(page.getByText("Your cart is empty.")).toHaveCount(0);
});
