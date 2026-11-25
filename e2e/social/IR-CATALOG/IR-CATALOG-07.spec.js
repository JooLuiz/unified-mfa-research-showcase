const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-07 - The feed showcase can be hidden and shown again.

test.beforeEach(() => {
  restoreMockData();
});

test("the feed showcase hides and shows its products", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const showcase = page.locator("angular-product-showcase");
  const lamp = showcase.getByText("Minimalist Desk Lamp", { exact: true });
  await expect(lamp).toBeVisible();

  await showcase.getByRole("button", { name: "Hide" }).click();
  await expect(showcase.getByRole("button", { name: "Show" })).toBeVisible();
  await expect(lamp).toBeHidden();

  await showcase.getByRole("button", { name: "Show" }).click();
  await expect(showcase.getByRole("button", { name: "Hide" })).toBeVisible();
  await expect(lamp).toBeVisible();
});
