const { test, expect } = require("../../fixtures");
const fs = require("fs/promises");
const path = require("path");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-06 - A banner in the posts feed sends the shopper to the store product list with that banner's filters.

const ECOMMERCE_PRODUCTS_URL = "http://localhost:4200/products";
const BANNERS_PATH = path.resolve("apps/mock-data-service/data/banners.json");

test.beforeEach(() => {
  restoreMockData();
});

async function setFirstBannerFilters(filters) {
  const banners = JSON.parse(await fs.readFile(BANNERS_PATH, "utf8"));
  banners[0].filters = filters;
  await fs.writeFile(BANNERS_PATH, `${JSON.stringify(banners, null, 2)}\n`, "utf8");
}

/**
 * Clicks the first posts-feed banner and returns the store URL it navigates to.
 *
 * The store navigation is answered with 204, so the browser keeps the posts page loaded.
 * That keeps this page's coverage counts, which a cross-origin page load would discard.
 *
 * @param {import("@playwright/test").Page} page - Social page.
 * @returns {Promise<URL>} The store URL the banner opened.
 */
async function openFirstPostsBanner(page) {
  await page.goto("/posts", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Community Posts" }),
  ).toBeVisible();
  await page.route(`${ECOMMERCE_PRODUCTS_URL}**`, (route) =>
    route.fulfill({ status: 204 }),
  );
  const storeNavigation = page.waitForRequest(
    (request) =>
      request.isNavigationRequest() &&
      request.url().startsWith(ECOMMERCE_PRODUCTS_URL),
  );
  const bannerButton = page
    .locator(".posts-banner-slot")
    .first()
    .getByRole("button", { name: "View Promotion" });
  await expect(bannerButton).toBeVisible();
  // click() would wait for a navigation that the 204 never commits.
  await bannerButton.dispatchEvent("click");
  return new URL((await storeNavigation).url());
}

test("a banner with every filter opens the product list with those filters", async ({
  page,
}) => {
  await setFirstBannerFilters({
    searchQuery: "lamp",
    minPrice: "10",
    maxPrice: "150",
    categoryIds: ["cat-electronics", "cat-lighting"],
  });
  const storeUrl = await openFirstPostsBanner(page);

  expect(`${storeUrl.origin}${storeUrl.pathname}`).toBe(ECOMMERCE_PRODUCTS_URL);
  expect(storeUrl.searchParams.get("searchQuery")).toBe("lamp");
  expect(storeUrl.searchParams.get("minPrice")).toBe("10");
  expect(storeUrl.searchParams.get("maxPrice")).toBe("150");
  expect(storeUrl.searchParams.get("categoryIds")).toBe(
    "cat-electronics,cat-lighting",
  );
});

test("a banner with no filters opens the plain product list", async ({
  page,
}) => {
  await setFirstBannerFilters({});
  const storeUrl = await openFirstPostsBanner(page);

  expect(storeUrl.href).toBe(ECOMMERCE_PRODUCTS_URL);
});
