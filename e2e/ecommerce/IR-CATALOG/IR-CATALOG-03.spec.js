const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-03 - The product list requests filtered products and the category list.

test.beforeEach(() => {
  restoreMockData();
});

function waitForProductQuery(page, requiredParts) {
  return page.waitForResponse((response) => {
    if (!response.ok() || !response.url().includes("/products?")) {
      return false;
    }
    const requestUrl = response.url();
    return requiredParts.every((part) => requestUrl.includes(part));
  });
}

test("the product list filters by text, price, and category, and sorts the result", async ({
  page,
}) => {
  const categoriesResponse = page.waitForResponse(
    (response) => response.url().includes("/categories") && response.ok(),
  );
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await categoriesResponse;
  await expect(page.getByRole("checkbox", { name: "Furniture" })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Electronics" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Accessories" }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Lighting" })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Stationery" }),
  ).toBeVisible();
  await page.getByLabel("Search").fill("lamp");
  await page.getByRole("checkbox", { name: "Lighting" }).check();
  const textAndCategory = waitForProductQuery(page, [
    "search=lamp",
    "categoryIds=cat-lighting",
  ]);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await textAndCategory;
  await expect(page.getByText("Total Quantity: 2")).toBeVisible();
  await expect(
    page.getByText("Minimalist Desk Lamp", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Smart Table Lamp", { exact: true }),
  ).toBeVisible();
  const sortedHighToLow = waitForProductQuery(page, [
    "search=lamp",
    "categoryIds=cat-lighting",
    "sortBy=price-desc",
  ]);
  await page.locator(".product-sort-select").selectOption("price-desc");
  await sortedHighToLow;
  const cards = page.locator("article.card-shell");
  await expect(cards.first()).toContainText("Smart Table Lamp");
  await expect(cards.nth(1)).toContainText("Minimalist Desk Lamp");
  await page.getByLabel("Min Price").fill("40");
  await page.getByLabel("Max Price").fill("50");
  const priced = waitForProductQuery(page, [
    "search=lamp",
    "minPrice=40",
    "maxPrice=50",
    "categoryIds=cat-lighting",
    "sortBy=price-desc",
  ]);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await priced;
  await expect(page.getByText("Total Quantity: 1")).toBeVisible();
  await expect(
    page.getByText("Minimalist Desk Lamp", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Smart Table Lamp", { exact: true })).toHaveCount(
    0,
  );
});
