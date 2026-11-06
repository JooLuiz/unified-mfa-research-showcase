const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CART-03 - On checkout, the shopper removes an item.

const API_BASE_URL = "http://localhost:4000/api";
const PRODUCT_NAME = "Mechanical Wireless Keyboard";

test.beforeEach(() => {
  restoreMockData();
});

async function openCheckoutWithOneKeyboard(page) {
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "bruno.silva", password: "password123" },
  });
  const loginPayload = await loginResponse.json();
  const saveResponse = await page.request.put(`${API_BASE_URL}/cart`, {
    headers: { Authorization: `Bearer ${loginPayload.token}` },
    data: {
      items: [{ productId: "p-03", quantity: 1 }],
      appliedCoupon: null,
    },
  });

  expect(saveResponse.ok()).toBeTruthy();

  await page.addInitScript(
    ([token, user]) => {
      localStorage.setItem("ecommerce-shell:auth-token", token);
      localStorage.setItem("ecommerce-shell:auth-user", JSON.stringify(user));
    },
    [loginPayload.token, loginPayload.user],
  );
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
}

test("the shopper removes the only checkout line", async ({ page }) => {
  await openCheckoutWithOneKeyboard(page);
  const line = page.locator("article.checkout-item", { hasText: PRODUCT_NAME });
  await expect(line).toBeVisible();
  await line.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("status")).toContainText(
    `${PRODUCT_NAME} was removed from your cart.`,
  );
  await expect(page.locator("article.checkout-item")).toHaveCount(0);
  const emptyCartFrame = page.frameLocator('iframe[title="Checkout Empty"]');
  await expect(
    emptyCartFrame.getByRole("heading", {
      name: "There are no items in your cart",
    }),
  ).toBeVisible();
  await expect(page.locator(".cart-item-count")).toHaveText("0");
  await expect(
    page.getByRole("button", { name: "Total: $0.00" }),
  ).toBeVisible();
});
