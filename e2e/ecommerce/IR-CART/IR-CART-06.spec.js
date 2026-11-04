const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CART-06 - On entry, the store loads that user's already saved cart.

const API_BASE_URL = "http://localhost:4000/api";
test.beforeEach(() => {
  restoreMockData();
});
async function login(page, username) {
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username, password: "password123" },
  });
  return loginResponse.json();
}

async function saveCart(page, token, items) {
  const saveResponse = await page.request.put(`${API_BASE_URL}/cart`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { items, appliedCoupon: null },
  });
  expect(saveResponse.ok()).toBeTruthy();
}

async function seedBothCarts(page) {
  const bruno = await login(page, "bruno.silva");
  const alice = await login(page, "alice.parker");
  await saveCart(page, bruno.token, [{ productId: "p-03", quantity: 2 }]);
  await saveCart(page, alice.token, [{ productId: "p-04", quantity: 1 }]);
  return bruno;
}

test("a returning shopper sees his own saved cart", async ({ page }) => {
  const bruno = await seedBothCarts(page);
  await page.addInitScript(
    ([token, user]) => {
      localStorage.setItem("ecommerce-shell:auth-token", token);
      localStorage.setItem("ecommerce-shell:auth-user", JSON.stringify(user));
    },
    [bruno.token, bruno.user],
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Bruno Silva" })).toBeVisible();
  await expect(page.locator(".cart-item-count")).toHaveText("2");
  await expect(
    page.getByRole("button", { name: "Total: $241.00" }),
  ).toBeVisible();
});

test("a guest entry does not show another user's saved cart", async ({
  page,
}) => {
  await seedBothCarts(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await expect(page.locator(".cart-item-count")).toHaveText("0");
  await expect(
    page.getByRole("button", { name: "Total: $0.00" }),
  ).toBeVisible();
});
