const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedCart } = require("../../support/seed-cart");

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

async function seedBothCarts(page) {
  const bruno = await login(page, "bruno.silva");
  await seedCart("bruno.silva", [{ productId: "p-03", quantity: 2 }]);
  await seedCart("alice.parker", [{ productId: "p-04", quantity: 1 }]);
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
