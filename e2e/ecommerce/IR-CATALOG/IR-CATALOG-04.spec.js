const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-04 - The /product route shows the product indicated by productId.

const PRODUCTS = [
  {
    productId: "p-01",
    name: "Minimalist Desk Lamp",
    priceLabel: "Price: $45.00",
  },
  {
    productId: "p-03",
    name: "Mechanical Wireless Keyboard",
    priceLabel: "Price: $120.50",
  },
];
test.beforeEach(() => {
  restoreMockData();
});
for (const product of PRODUCTS) {
  test(`/product?productId=${product.productId} shows ${product.name}`, async ({
    page,
  }) => {
    await page.goto(`/product?productId=${product.productId}`, {
      waitUntil: "domcontentloaded",
    });
    const details = page.locator(".pdp-shell");
    await expect(
      details.getByRole("heading", { name: product.name }),
    ).toBeVisible();
    await expect(
      details.getByRole("img", { name: product.name }),
    ).toBeVisible();
    await expect(details.getByText(product.priceLabel)).toBeVisible();
  });
}
