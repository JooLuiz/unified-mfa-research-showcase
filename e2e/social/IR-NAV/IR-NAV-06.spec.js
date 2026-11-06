const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NAV-06 - Opening a product on the social feed goes to that product in the ecommerce shell.

test.beforeEach(() => {
  restoreMockData();
});

test("opening a feed product goes to that product in the store", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const showcase = page.locator("angular-product-showcase");
  const productImage = showcase.getByRole("img", {
    name: "Minimalist Desk Lamp",
  });
  await expect(productImage).toBeVisible();
  await productImage.click();
  await expect(page).toHaveURL("http://localhost:4200/product?productId=p-01");
  await expect(
    page.getByRole("heading", { name: "Minimalist Desk Lamp" }),
  ).toBeVisible();
});
