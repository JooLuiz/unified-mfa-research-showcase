const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CART-05 - Cart items reach the checkout module so it can draw the list.

const API_BASE_URL = "http://localhost:4000/api";

test.beforeEach(() => {
  restoreMockData();
});

async function openStoreWithSeededCart(page) {
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "bruno.silva", password: "password123" },
  });
  const loginPayload = await loginResponse.json();
  const saveResponse = await page.request.put(`${API_BASE_URL}/cart`, {
    headers: { Authorization: `Bearer ${loginPayload.token}` },
    data: {
      items: [
        { productId: "p-03", quantity: 2 },
        { productId: "p-04", quantity: 1 },
      ],
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
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

test("opening the cart draws each saved line in checkout", async ({ page }) => {
  await openStoreWithSeededCart(page);
  await expect(page.locator(".cart-item-count")).toHaveText("3");
  await expect(
    page.getByRole("button", { name: "Total: $296.00" }),
  ).toBeVisible();
  await page.locator(".cart-action").click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  await expect(page.locator('iframe[title="Checkout Empty"]')).toHaveCount(0);
  const keyboard = page.locator("article.checkout-item", {
    hasText: "Mechanical Wireless Keyboard",
  });
  await expect(
    keyboard.getByRole("img", { name: "Mechanical Wireless Keyboard" }),
  ).toBeVisible();
  await expect(keyboard.locator("input.checkout-quantity-input")).toHaveValue(
    "2",
  );
  await expect(keyboard.getByText("$241.00")).toBeVisible();
  const mouse = page.locator("article.checkout-item", {
    hasText: "Precision Optical Mouse",
  });
  await expect(
    mouse.getByRole("img", { name: "Precision Optical Mouse" }),
  ).toBeVisible();
  await expect(mouse.locator("input.checkout-quantity-input")).toHaveValue("1");
  await expect(mouse.getByText("$55.00")).toBeVisible();
});
