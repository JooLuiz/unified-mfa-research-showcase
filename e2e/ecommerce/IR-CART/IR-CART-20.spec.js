const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedCart } = require("../../support/seed-cart");

// IR-CART-20 - Checkout cleans typed quantities and coupon codes, and skips a stored line with no product.

const API_BASE_URL = "http://localhost:4000/api";
const PRODUCT_NAME = "Mechanical Wireless Keyboard";

test.beforeEach(() => {
  restoreMockData();
});

/**
 * Signs bruno.silva in with a stored cart and opens checkout.
 *
 * @param {import("@playwright/test").Page} page - Browser page.
 * @param {Array<{ productId: string, quantity: number }>} items - Stored cart lines.
 * @returns {Promise<void>}
 */
async function openCheckoutWithCart(page, items) {
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "bruno.silva", password: "password123" },
  });
  const loginPayload = await loginResponse.json();
  await seedCart("bruno.silva", items);

  await page.addInitScript(
    ([token, user]) => {
      localStorage.setItem("ecommerce-shell:auth-token", token);
      localStorage.setItem("ecommerce-shell:auth-user", JSON.stringify(user));
    },
    [loginPayload.token, loginPayload.user],
  );
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
}

test("a typed 0 becomes 1, and typing the same quantity keeps the total", async ({ page }) => {
  await openCheckoutWithCart(page, [{ productId: "p-03", quantity: 2 }]);
  const line = page.locator("article.checkout-item", { hasText: PRODUCT_NAME });
  const quantity = line.locator("input.checkout-quantity-input");
  await expect(quantity).toHaveValue("2");
  await expect(page.getByRole("button", { name: "Total: $241.00" })).toBeVisible();

  await quantity.fill("2");
  await quantity.blur();
  await expect(quantity).toHaveValue("2");
  await expect(page.getByRole("button", { name: "Total: $241.00" })).toBeVisible();

  await quantity.fill("0");
  await quantity.blur();
  await expect(quantity).toHaveValue("1");
  await expect(page.locator(".cart-item-count")).toHaveText("1");
  await expect(page.getByRole("button", { name: "Total: $120.50" })).toBeVisible();
});

test("an empty coupon code asks for one, and a padded upper-case code still applies", async ({
  page,
}) => {
  await openCheckoutWithCart(page, [{ productId: "p-03", quantity: 1 }]);
  const summary = page.locator(".checkout-summary-shell");
  const couponForm = page.locator(".apply-coupon-shell");
  const couponInput = couponForm.getByPlaceholder("Coupon code");
  const applyButton = couponForm.getByRole("button", { name: "Apply Coupon" });
  await expect(page.locator("article.checkout-item", { hasText: PRODUCT_NAME })).toBeVisible();

  await applyButton.click();
  await expect(couponForm.getByText("Please type a coupon code.")).toBeVisible();

  await couponInput.fill("   ");
  await applyButton.click();
  await expect(couponForm.getByText("Please type a coupon code.")).toBeVisible();
  await expect(summary.getByText("Discount")).toHaveCount(0);

  await couponInput.fill("  FIFTY ");
  await applyButton.click();
  await expect(couponForm.getByText("Coupon applied: 50% discount.")).toBeVisible();
  await expect(summary.getByText("-$60.25")).toBeVisible();
});

test("a stored cart line with no product id is not shown at checkout", async ({ page }) => {
  await openCheckoutWithCart(page, [
    { productId: "p-03", quantity: 1 },
    { productId: "", quantity: 2 },
  ]);

  await expect(page.locator("article.checkout-item", { hasText: PRODUCT_NAME })).toBeVisible();
  await expect(page.locator("article.checkout-item")).toHaveCount(1);
});
