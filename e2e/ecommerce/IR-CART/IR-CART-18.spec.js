const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedCart } = require("../../support/seed-cart");

// IR-CART-18 - A guest's cart lines join the saved cart when that shopper signs in.

test.beforeEach(() => {
  restoreMockData();
});

test("a guest's cart merges into the saved cart on sign-in and stays after a reload", async ({
  page,
}) => {
  await seedCart("bruno.silva", [{ productId: "p-03", quantity: 2 }]);

  await page.goto("/products", { waitUntil: "domcontentloaded" });
  const mouseCard = page.locator("article.card-shell", {
    hasText: "Precision Optical Mouse",
  });
  await mouseCard.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.locator(".cart-item-count")).toHaveText("1");

  await page.getByRole("button", { name: "Log in" }).click();
  await expect(
    page.getByRole("heading", { name: "Log in to MFE Lab" }),
  ).toBeVisible();
  await page.getByLabel("Username or email").fill("bruno.silva");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("button", { name: "Bruno Silva" })).toBeVisible();
  await expect(page.locator(".cart-item-count")).toHaveText("3");
  await expect(
    page.getByRole("button", { name: "Total: $296.00" }),
  ).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Bruno Silva" })).toBeVisible();
  await expect(page.locator(".cart-item-count")).toHaveText("3");
  await expect(
    page.getByRole("button", { name: "Total: $296.00" }),
  ).toBeVisible();
});
