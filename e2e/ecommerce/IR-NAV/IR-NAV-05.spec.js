const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NAV-05 - A promotion banner opens the product list with that promotion's filters.

const PROMOTIONS = [
  {
    title: "Upgrade Your Focus",
    tags: ["Search: monitor"],
  },
  {
    title: "Comfort for the Long Haul",
    tags: ["Category: Furniture"],
  },
  {
    title: "The Perfect Setup Starts Here",
    tags: ["Max Price: $150", "Category: Electronics"],
  },
  {
    title: "Studio Quality at Home",
    tags: ["Search: mic"],
  },
  {
    title: "Zen Your Desk Space",
    tags: ["Category: Lighting"],
  },
];

async function openPromotion(page, title) {
  const bannerCard = page
    .locator("section.banner-card")
    .filter({ hasText: title });
  await bannerCard.getByRole("button", { name: "View Promotion" }).click();
  await expect(page).toHaveURL(/\/products$/);
}

test.beforeEach(() => {
  restoreMockData();
});

test("the home banner opens the product list with its filters", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await openPromotion(page, "Upgrade Your Focus");
  await expect(page.getByText("Search: monitor")).toBeVisible();
});

for (const promotion of PROMOTIONS) {
  test(`the ${promotion.title} banner opens the product list with its filters`, async ({
    page,
  }) => {
    await page.goto("/promotions", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: promotion.title }),
    ).toBeVisible();
    await openPromotion(page, promotion.title);
    for (const tagLabel of promotion.tags) {
      await expect(page.getByText(tagLabel)).toBeVisible();
    }
  });
}
