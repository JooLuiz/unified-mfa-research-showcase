const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const fs = require("fs/promises");
const path = require("path");

// IR-SOCIAL-08 - A banner carrying every filter, and a banner carrying none, opens the store list.

const STORE_PRODUCTS_URL = "http://localhost:4200/products";
const BANNERS_PATH = path.resolve("apps/mock-data-service/data/banners.json");

test.beforeEach(() => {
  restoreMockData();
});

async function writeBanners(banners) {
  await fs.writeFile(BANNERS_PATH, `${JSON.stringify(banners, null, 2)}\n`, "utf8");
}

test("a banner with search, price, and category opens the filtered product list", async ({
  page,
}) => {
  await writeBanners([
    {
      id: "b-all",
      title: "Everything Filtered",
      imageUrl: "https://example.com/banner.jpg",
      filters: {
        searchQuery: "lamp",
        minPrice: "10",
        maxPrice: "150",
        categoryIds: ["cat-lighting"],
      },
    },
  ]);
  await page.goto("/posts", { waitUntil: "domcontentloaded" });
  await page
    .locator("section.banner-card")
    .filter({ hasText: "Everything Filtered" })
    .getByRole("button", { name: "View Promotion" })
    .first()
    .click();
  await expect(page).toHaveURL(
    `${STORE_PRODUCTS_URL}?searchQuery=lamp&minPrice=10&maxPrice=150&categoryIds=cat-lighting`,
  );
});

test("a banner with no filters opens the product list", async ({ page }) => {
  await writeBanners([
    {
      id: "b-none",
      title: "Browse everything",
      imageUrl: "https://example.com/banner.jpg",
      filters: {},
    },
  ]);
  await page.goto("/posts", { waitUntil: "domcontentloaded" });
  await page
    .locator("section.banner-card")
    .filter({ hasText: "Browse everything" })
    .getByRole("button", { name: "View Promotion" })
    .first()
    .click();
  await expect(page).toHaveURL(STORE_PRODUCTS_URL);
});
