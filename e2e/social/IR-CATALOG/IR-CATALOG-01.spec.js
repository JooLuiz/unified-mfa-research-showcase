const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-01 - On open, the social network loads products, showcases, banners, and posts.

test.beforeEach(() => {
  restoreMockData();
});

test("the social network shows posts, a showcase, its products, and a banner", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Trending Posts" }),
  ).toBeVisible();
  await expect(
    page.getByText("Just set up my new minimalist desk lamp from MFE Lab."),
  ).toBeVisible();
  const showcase = page.locator("angular-product-showcase");
  await expect(
    showcase.getByRole("heading", { name: "Work from Home Essentials" }),
  ).toBeVisible();
  await expect(
    showcase.getByText("Minimalist Desk Lamp", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Posts" }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await expect(
    page.getByRole("heading", { name: "Community Posts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Upgrade Your Focus" }),
  ).toBeVisible();
});
