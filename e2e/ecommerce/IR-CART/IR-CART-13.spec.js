const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedCart } = require("../../support/seed-cart");
const { breakStoredOrders } = require("../../support/seed-empty-state");

// IR-CART-13 - A failed place-order request stays on checkout and shows the error.

const API_BASE_URL = "http://localhost:4000/api";

test.beforeEach(() => {
  restoreMockData();
});

async function openCheckoutWithOneKeyboard(page) {
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "bruno.silva", password: "password123" },
  });
  const loginPayload = await loginResponse.json();
  await seedCart("bruno.silva", [{ productId: "p-03", quantity: 1 }]);
  await page.addInitScript(
    ([token, user]) => {
      localStorage.setItem("ecommerce-shell:auth-token", token);
      localStorage.setItem("ecommerce-shell:auth-user", JSON.stringify(user));
    },
    [loginPayload.token, loginPayload.user],
  );
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
}

test("a failed place-order request stays on checkout and shows the error", async ({
  page,
}) => {
  await openCheckoutWithOneKeyboard(page);
  await expect(page.locator(".cart-item-count")).toHaveText("1");
  await breakStoredOrders();
  await page.getByRole("button", { name: "Place Order" }).click();
  const toast = page
    .locator(".notification-toast")
    .filter({ hasText: "Order not placed" });
  await expect(toast).toBeVisible();
  await expect(
    toast.getByText("Your cart is still available. Please try again."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.locator(".cart-item-count")).toHaveText("1");
  await expect(
    page.getByRole("heading", { name: "Order Placed!" }),
  ).toHaveCount(0);
});
