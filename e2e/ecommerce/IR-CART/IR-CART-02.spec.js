const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CART-02 - On checkout, the shopper changes an item's quantity.

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

function keyboardLine(page) {
  return page.locator("article.checkout-item", { hasText: PRODUCT_NAME });
}

async function expectQuantity(page, quantity, linePrice, totalLabel) {
  const line = keyboardLine(page);
  await expect(line.locator("input.checkout-quantity-input")).toHaveValue(
    String(quantity),
  );
  await expect(line.getByText(linePrice)).toBeVisible();
  await expect(page.locator(".checkout-summary-shell")).toContainText(
    linePrice,
  );
  await expect(page.locator(".cart-item-count")).toHaveText(String(quantity));
  await expect(page.getByRole("button", { name: totalLabel })).toBeVisible();
}

test("the shopper raises and lowers a checkout line quantity", async ({
  page,
}) => {
  await openCheckoutWithOneKeyboard(page);
  const line = keyboardLine(page);
  await expectQuantity(page, 1, "$120.50", "Total: $120.50");
  await line.getByRole("button", { name: "+", exact: true }).click();
  await expectQuantity(page, 2, "$241.00", "Total: $241.00");
  await line.getByRole("button", { name: "-", exact: true }).click();
  await expectQuantity(page, 1, "$120.50", "Total: $120.50");
});
