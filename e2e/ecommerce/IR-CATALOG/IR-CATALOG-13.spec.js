const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-13 - The product page shows a missing id, clamps the quantity, and stops watching when the shopper leaves.

const LAMP = "Minimalist Desk Lamp";
const LAMP_PATH = "/product?productId=p-01";
const STORE_ORIGIN = "http://localhost:4200";

test.beforeEach(() => {
  restoreMockData();
});

function productDetails(page) {
  return page.locator(".pdp-shell");
}

test("a product page with no id says none was provided", async ({ page }) => {
  await page.goto("/product", { waitUntil: "domcontentloaded" });
  await expect(productDetails(page)).toContainText("No product id was provided.");
});

test("the lamp quantity cannot go below one or above the available count", async ({
  page,
}) => {
  await page.goto(LAMP_PATH, { waitUntil: "domcontentloaded" });
  const details = productDetails(page);
  const quantityInput = details.locator("input.pdp-quantity-value-input");
  await expect(details.getByRole("heading", { name: LAMP })).toBeVisible();
  await expect(details.getByText("Price: $45.00")).toBeVisible();
  await expect(details.getByText("2 available")).toBeVisible();

  await details.getByRole("button", { name: "-", exact: true }).click();
  await expect(quantityInput).toHaveValue("1");

  await quantityInput.fill("9");
  await quantityInput.press("Tab");
  await expect(quantityInput).toHaveValue("2");
  await expect(
    details.getByRole("button", { name: "+", exact: true }),
  ).toBeDisabled();
});

test("reserving one lamp lowers the quantity a shopper already raised", async ({
  page,
  browser,
}) => {
  await page.goto(LAMP_PATH, { waitUntil: "domcontentloaded" });
  const details = productDetails(page);
  const quantityInput = details.locator("input.pdp-quantity-value-input");
  await expect(details.getByText("2 available")).toBeVisible();
  await details.getByRole("button", { name: "+", exact: true }).click();
  await expect(quantityInput).toHaveValue("2");

  const shopperContext = await browser.newContext({ baseURL: STORE_ORIGIN });
  try {
    const shopper = await shopperContext.newPage();
    await shopper.goto(LAMP_PATH, { waitUntil: "domcontentloaded" });
    const shopperDetails = productDetails(shopper);
    await expect(shopperDetails.getByText("2 available")).toBeVisible();
    await shopperDetails.getByRole("button", { name: "Add to Cart" }).click();
    await expect(shopper.getByRole("status")).toContainText(
      `${LAMP} was added to your cart.`,
    );
    await expect(details.getByText("1 available")).toBeVisible();
    await expect(quantityInput).toHaveValue("1");
  } finally {
    await shopperContext.close();
  }
});

test("leaving the product page removes the lamp", async ({ page }) => {
  await page.goto(LAMP_PATH, { waitUntil: "domcontentloaded" });
  const details = productDetails(page);
  await expect(details.getByRole("heading", { name: LAMP })).toBeVisible();
  await expect(details.getByText("2 available")).toBeVisible();
  await page.getByRole("button", { name: "Products" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole("heading", { name: "Filters" })).toBeVisible();
  await expect(page.getByRole("heading", { name: LAMP })).toHaveCount(0);
});
