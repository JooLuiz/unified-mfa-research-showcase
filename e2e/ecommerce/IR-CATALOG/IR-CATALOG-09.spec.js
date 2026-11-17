const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-09 - A non-numeric price is ignored.

const KEYBOARD = "Mechanical Wireless Keyboard";

test.beforeEach(() => {
  restoreMockData();
});

test("a non-numeric price is ignored", async ({ page }) => {
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  const minPrice = page.getByLabel("Min Price");
  await minPrice.fill("40");
  await expect(minPrice).toHaveValue("40");
  await minPrice.evaluate((input) => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    valueSetter.call(input, "1.5");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(minPrice).toHaveValue("40");
  await expect(page.getByText(KEYBOARD, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove filter Min Price: $40" })).toHaveCount(0);
});
