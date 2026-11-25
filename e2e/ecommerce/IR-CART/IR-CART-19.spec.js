const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedCart } = require("../../support/seed-cart");

// IR-CART-19 - Removing one of two checkout lines keeps the other working, then the cart empties.

const API_BASE_URL = "http://localhost:4000/api";

test.beforeEach(() => {
  restoreMockData();
});

async function openCheckoutWithKeyboardAndMouse(page) {
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "bruno.silva", password: "password123" },
  });
  const loginPayload = await loginResponse.json();
  await seedCart("bruno.silva", [
    { productId: "p-03", quantity: 1 },
    { productId: "p-04", quantity: 1 },
  ]);

  await page.addInitScript(
    ([token, user]) => {
      localStorage.setItem("ecommerce-shell:auth-token", token);
      localStorage.setItem("ecommerce-shell:auth-user", JSON.stringify(user));
    },
    [loginPayload.token, loginPayload.user],
  );
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
}

test("removing one line keeps the other line working, and removing it empties the cart", async ({
  page,
}) => {
  await openCheckoutWithKeyboardAndMouse(page);
  const keyboardLine = page.locator("article.checkout-item", {
    hasText: "Mechanical Wireless Keyboard",
  });
  const mouseLine = page.locator("article.checkout-item", {
    hasText: "Precision Optical Mouse",
  });
  await expect(keyboardLine).toBeVisible();
  await expect(mouseLine).toBeVisible();

  await keyboardLine.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Mechanical Wireless Keyboard was removed from your cart.",
  );
  await expect(page.locator("article.checkout-item")).toHaveCount(1);
  await expect(mouseLine).toBeVisible();
  await expect(page.locator(".cart-item-count")).toHaveText("1");
  await expect(page.getByRole("button", { name: "Total: $55.00" })).toBeVisible();

  await mouseLine.getByRole("button", { name: "+", exact: true }).click();
  await expect(page.locator(".cart-item-count")).toHaveText("2");
  await expect(page.getByRole("button", { name: "Total: $110.00" })).toBeVisible();

  await mouseLine.getByRole("button", { name: "Remove" }).click();
  const emptyCartFrame = page.frameLocator('iframe[title="Checkout Empty"]');
  await expect(
    emptyCartFrame.getByRole("heading", { name: "There are no items in your cart" }),
  ).toBeVisible();
  await expect(page.locator(".cart-item-count")).toHaveText("0");
});
