const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedCart } = require("../../support/seed-cart");

// IR-CART-11 - An unknown coupon is refused and the total stays the same.

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

test("an unknown coupon is refused and the total stays the same", async ({
  page,
}) => {
  await openCheckoutWithOneKeyboard(page);
  const summary = page.locator(".checkout-summary-shell");
  const couponForm = page.locator(".apply-coupon-shell");
  await expect(
    page.getByRole("button", { name: "Total: $120.50" }),
  ).toBeVisible();
  await couponForm.getByPlaceholder("Coupon code").fill("nope");
  await couponForm.getByRole("button", { name: "Apply Coupon" }).click();
  await expect(couponForm.getByText("Invalid coupon.")).toBeVisible();
  await expect(summary.getByText("Discount")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Total: $120.50" }),
  ).toBeVisible();
});
