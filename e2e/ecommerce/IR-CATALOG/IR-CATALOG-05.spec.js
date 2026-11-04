const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-05 - The latest product-list filters survive a reload of the store.

const SAVED_QUERY_PARTS = [
  "search=lamp",
  "minPrice=40",
  "maxPrice=50",
  "categoryIds=cat-lighting",
];

test.beforeEach(() => {
  restoreMockData();
});

function waitForSavedFilters(page) {
  return page.waitForResponse((response) => {
    if (!response.ok() || !response.url().includes("/products?")) {
      return false;
    }
    const requestUrl = response.url();
    return SAVED_QUERY_PARTS.every((part) => requestUrl.includes(part));
  });
}

test("the product list keeps the last filters after a reload", async ({
  page,
}) => {
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Search").fill("lamp");
  await page.getByLabel("Min Price").fill("40");
  await page.getByLabel("Max Price").fill("50");
  await page.getByRole("checkbox", { name: "Lighting" }).check();
  const appliedFilters = waitForSavedFilters(page);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await appliedFilters;
  await expect(page.getByText("Total Quantity: 1")).toBeVisible();
  const restoredFilters = waitForSavedFilters(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await restoredFilters;
  await expect(page.getByLabel("Search")).toHaveValue("lamp");
  await expect(page.getByLabel("Min Price")).toHaveValue("40");
  await expect(page.getByLabel("Max Price")).toHaveValue("50");
  await expect(page.getByRole("checkbox", { name: "Lighting" })).toBeChecked();
  await expect(page.getByText("Total Quantity: 1")).toBeVisible();
  await expect(
    page.getByText("Minimalist Desk Lamp", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Smart Table Lamp", { exact: true })).toHaveCount(
    0,
  );
});
