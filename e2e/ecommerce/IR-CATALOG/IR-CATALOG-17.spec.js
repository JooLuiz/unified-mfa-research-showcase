const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-17 - Product details clamps typed quantities and moves between similar products.

const PRODUCT_NAME = "Mechanical Wireless Keyboard";
const SIMILAR_PRODUCT_NAME = "Precision Optical Mouse";

test.beforeEach(() => {
  restoreMockData();
});

/**
 * Opens product details for one product and waits for its heading and stock count.
 *
 * @param {import("@playwright/test").Page} page - Browser page.
 * @param {string} productId - Product id in the URL.
 * @param {string} productName - Heading text to wait for.
 * @returns {Promise<import("@playwright/test").Locator>} The details section.
 */
async function openProductDetails(page, productId, productName) {
  await page.goto(`/product?productId=${productId}`, { waitUntil: "domcontentloaded" });
  const details = page.locator(".pdp-shell");
  await expect(details.getByRole("heading", { name: productName })).toBeVisible();
  await expect(details.locator(".pdp-availability")).toBeVisible();
  return details;
}

test("a typed quantity above stock becomes the stock count, and 0 becomes 1", async ({
  page,
}) => {
  const details = await openProductDetails(page, "p-03", PRODUCT_NAME);
  const quantity = details.locator("input.pdp-quantity-value-input");
  await expect(details.getByText("12 available")).toBeVisible();

  await quantity.fill("99");
  await quantity.blur();
  await expect(quantity).toHaveValue("12");
  await expect(details.getByRole("button", { name: "+", exact: true })).toBeDisabled();

  await quantity.fill("0");
  await quantity.blur();
  await expect(quantity).toHaveValue("1");
});

test("opening a similar product resets the quantity, and Back shows the first product again", async ({
  page,
}) => {
  const details = await openProductDetails(page, "p-03", PRODUCT_NAME);
  const quantity = details.locator("input.pdp-quantity-value-input");
  const increase = details.getByRole("button", { name: "+", exact: true });
  await increase.click();
  await increase.click();
  await expect(quantity).toHaveValue("3");

  const similarCard = page.locator("angular-product-showcase article.card-shell", {
    hasText: SIMILAR_PRODUCT_NAME,
  });
  await similarCard.getByRole("img", { name: SIMILAR_PRODUCT_NAME }).click();

  const nextDetails = page.locator(".pdp-shell");
  await expect(page).toHaveURL(/\/product\?productId=p-04$/);
  await expect(nextDetails.getByRole("heading", { name: SIMILAR_PRODUCT_NAME })).toBeVisible();
  await expect(nextDetails.locator("input.pdp-quantity-value-input")).toHaveValue("1");

  await page.goBack();
  await expect(page).toHaveURL(/\/product\?productId=p-03$/);
  await expect(nextDetails.getByRole("heading", { name: PRODUCT_NAME })).toBeVisible();
  await expect(nextDetails.locator("input.pdp-quantity-value-input")).toHaveValue("1");
});

test("a product with no similar products shows no similar product cards", async ({ page }) => {
  await page.route("**/api/products/p-03", async (route) => {
    const response = await route.fetch();
    const product = await response.json();
    await route.fulfill({ response, json: { ...product, similarProducts: [] } });
  });

  await openProductDetails(page, "p-03", PRODUCT_NAME);
  await page.waitForTimeout(500);
  await expect(page.locator("angular-product-showcase article.card-shell")).toHaveCount(0);
});

test("the product page without a product id says so", async ({ page }) => {
  await page.goto("/product", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".pdp-shell")).toContainText("No product id was provided.");
});
