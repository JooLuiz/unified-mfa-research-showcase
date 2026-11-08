const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedCart } = require("../../support/seed-cart");

// IR-CART-04 - On checkout, the shopper applies a coupon to the current cart.

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

test("the shopper applies a fifty percent coupon at checkout", async ({
  page,
}) => {
  await openCheckoutWithOneKeyboard(page);
  const line = page.locator("article.checkout-item", { hasText: PRODUCT_NAME });
  const summary = page.locator(".checkout-summary-shell");
  const couponForm = page.locator(".apply-coupon-shell");
  await expect(line.getByText("$120.50")).toBeVisible();
  await expect(summary.getByText("Discount")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Total: $120.50" }),
  ).toBeVisible();
  await couponForm.getByPlaceholder("Coupon code").fill("fifty");
  await couponForm.getByRole("button", { name: "Apply Coupon" }).click();
  await expect(
    couponForm.getByText("Coupon applied: 50% discount."),
  ).toBeVisible();
  await expect(line.getByText("$120.50")).toBeVisible();
  await expect(summary.getByText("-$60.25")).toBeVisible();
  await expect(summary.locator("strong", { hasText: "$60.25" })).toBeVisible();
  await expect(page.locator(".cart-item-count")).toHaveText("1");
  await expect(
    page.getByRole("button", { name: "Total: $60.25" }),
  ).toBeVisible();
});
