const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NAV-05 - A social promotion banner opens the ecommerce product list with that promotion's filters.

const STORE_PRODUCTS_URL = "http://localhost:4200/products";

const PROMOTIONS = [
  {
    title: "Upgrade Your Focus",
    storeUrl: `${STORE_PRODUCTS_URL}?searchQuery=monitor`,
    tags: ["Search: monitor"],
  },
  {
    title: "Comfort for the Long Haul",
    storeUrl: `${STORE_PRODUCTS_URL}?categoryIds=cat-furniture`,
    tags: ["Category: Furniture"],
  },
  {
    title: "The Perfect Setup Starts Here",
    storeUrl: `${STORE_PRODUCTS_URL}?maxPrice=150&categoryIds=cat-electronics`,
    tags: ["Max Price: $150", "Category: Electronics"],
  },
  {
    title: "Studio Quality at Home",
    storeUrl: `${STORE_PRODUCTS_URL}?searchQuery=mic`,
    tags: ["Search: mic"],
  },
  {
    title: "Zen Your Desk Space",
    storeUrl: `${STORE_PRODUCTS_URL}?categoryIds=cat-lighting`,
    tags: ["Category: Lighting"],
  },
];

test.beforeEach(() => {
  restoreMockData();
});

for (const promotion of PROMOTIONS) {
  test(`the ${promotion.title} banner opens the store product list with its filters`, async ({
    page,
  }) => {
    await page.goto("/posts", { waitUntil: "domcontentloaded" });
    const bannerCard = page
      .locator("section.banner-card")
      .filter({ hasText: promotion.title });
    await bannerCard.getByRole("button", { name: "View Promotion" }).click();
    await expect(page).toHaveURL(promotion.storeUrl);
    for (const tagLabel of promotion.tags) {
      await expect(page.getByText(tagLabel)).toBeVisible();
    }
  });
}
