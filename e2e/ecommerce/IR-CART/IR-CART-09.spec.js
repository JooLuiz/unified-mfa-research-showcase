const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedCart } = require("../../support/seed-cart");

// IR-CART-09 - The shopper confirms the purchase. The order is saved, the saved cart is gone, and the store shows the confirmation.

const API_BASE_URL = "http://localhost:4000/api";
const KEYBOARD = "Mechanical Wireless Keyboard";

test.beforeEach(() => {
  restoreMockData();
});

async function expectEmptyCart(page) {
  await expect(page.locator(".cart-item-count")).toHaveText("0");
  await expect(
    page.getByRole("button", { name: "Total: $0.00" }),
  ).toBeVisible();
}

test("confirming checkout saves the order and clears the saved cart", async ({
  page,
  context,
}) => {
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "bruno.silva", password: "password123" },
  });
  const bruno = await loginResponse.json();
  await seedCart("bruno.silva", [{ productId: "p-03", quantity: 1 }]);
  await context.addInitScript(
    ([token, user]) => {
      localStorage.setItem("ecommerce-shell:auth-token", token);
      localStorage.setItem("ecommerce-shell:auth-user", JSON.stringify(user));
    },
    [bruno.token, bruno.user],
  );
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
  await expect(
    page.locator("article.checkout-item", { hasText: KEYBOARD }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Place Order" }).click();
  await expect(
    page.getByRole("heading", { name: "Order Placed!" }),
  ).toBeVisible();
  await expect(page.getByText("Thank you for your purchase.")).toBeVisible();
  await expectEmptyCart(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Bruno Silva" })).toBeVisible();
  await expectEmptyCart(page);
  await page.getByRole("button", { name: "Bruno Silva" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("1 order placed.")).toBeVisible();
  const orderRow = page.locator("button.my-orders-row");
  await expect(orderRow).toHaveCount(1);
  await expect(orderRow).toContainText("1 item");
  await expect(orderRow).toContainText("Placed");
  await expect(orderRow).toContainText("$120.50");
  await orderRow.click();
  await expect(
    page.getByRole("heading", { name: "Order Details" }),
  ).toBeVisible();
  const orderDetails = page.locator(".order-details-shell");
  await expect(
    orderDetails.getByRole("cell", { name: KEYBOARD }),
  ).toBeVisible();
  await expect(orderDetails.locator(".is-total")).toContainText("Total:");
  await expect(orderDetails.locator(".is-total")).toContainText("$120.50");
});
