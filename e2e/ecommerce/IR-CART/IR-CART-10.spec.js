const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CART-10 - On the empty cart page, the shopper returns to the product list.

const API_BASE_URL = "http://localhost:4000/api";

test.beforeEach(() => {
  restoreMockData();
});

test("the shopper leaves the empty cart for the product list", async ({
  page,
  context,
}) => {
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "bruno.silva", password: "password123" },
  });
  const bruno = await loginResponse.json();
  await context.addInitScript(
    ([token, user]) => {
      localStorage.setItem("ecommerce-shell:auth-token", token);
      localStorage.setItem("ecommerce-shell:auth-user", JSON.stringify(user));
    },
    [bruno.token, bruno.user],
  );
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
  const emptyCartFrame = page.frameLocator('iframe[title="Checkout Empty"]');
  await expect(
    emptyCartFrame.getByRole("heading", {
      name: "There are no items in your cart",
    }),
  ).toBeVisible();
  await emptyCartFrame
    .getByRole("button", { name: "Go Back to Shopping" })
    .click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole("heading", { name: "Filters" })).toBeVisible();
  await expect(page.locator('iframe[title="Checkout Empty"]')).toHaveCount(0);
});
