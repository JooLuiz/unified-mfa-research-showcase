const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-18 - Leaving the home page before its showcase loads shows the next page and no error.

test.beforeEach(() => {
  restoreMockData();
});

test("leaving home before the showcase loads shows the product list and no error", async ({
  page,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  await page.route("**/api/showcases/*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue().catch(() => {});
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Products" }).click();

  await expect(page).toHaveURL(/\/products$/);
  await expect(
    page.locator("article.card-shell", { hasText: "Mechanical Wireless Keyboard" }),
  ).toBeVisible();

  await page.waitForTimeout(2000);
  expect(pageErrors).toEqual([]);
  await expect(page.getByText("Unable to load showcase.")).toHaveCount(0);
});
