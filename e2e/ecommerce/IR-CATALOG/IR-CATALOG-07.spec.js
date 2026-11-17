const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-07 - Clearing every filter shows the unfiltered list again.

test.beforeEach(() => {
  restoreMockData();
});

test("clearing every filter shows the unfiltered list again", async ({
  page,
}) => {
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Search").fill("lamp");
  await page.getByRole("checkbox", { name: "Lighting" }).check();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("Total Quantity: 2")).toBeVisible();
  await expect(
    page.getByText("Mechanical Wireless Keyboard", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByLabel("Search", { exact: true })).toHaveValue("");
  await expect(page.getByRole("checkbox", { name: "Lighting" })).not.toBeChecked();
  await expect(
    page.getByText("Mechanical Wireless Keyboard", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Total Quantity: 2")).toHaveCount(0);
});

test("clearing filters on a phone closes the filter panel", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Expand" }).click();
  await page.getByLabel("Search").fill("lamp");
  await page.getByRole("checkbox", { name: "Lighting" }).check();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("Total Quantity: 2")).toBeVisible();
  await page.getByRole("button", { name: "Expand" }).click();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("button", { name: "Expand" })).toBeVisible();
  await expect(page.getByText("Total Quantity: 2")).toHaveCount(0);
  await page.getByRole("button", { name: "Expand" }).click();
  await expect(page.getByLabel("Search", { exact: true })).toHaveValue("");
  await expect(page.getByRole("checkbox", { name: "Lighting" })).not.toBeChecked();
});
