const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-08 - Removing one active filter leaves the rest of the list filtered.

const KEYBOARD = "Mechanical Wireless Keyboard";
const FILTER_TAGS = [
  "Search: lamp",
  "Min Price: $40",
  "Max Price: $50",
  "Category: Lighting",
];

test.beforeEach(() => {
  restoreMockData();
});

test("removing one active filter leaves the rest of the list filtered", async ({
  page,
}) => {
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Search").fill("lamp");
  await page.getByLabel("Min Price").fill("40");
  await page.getByLabel("Max Price").fill("50");
  await page.getByRole("checkbox", { name: "Lighting" }).check();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("Minimalist Desk Lamp", { exact: true })).toBeVisible();
  await expect(page.getByText(KEYBOARD, { exact: true })).toHaveCount(0);

  const remainingTags = [...FILTER_TAGS];
  for (const tagLabel of FILTER_TAGS) {
    await page.getByRole("button", { name: `Remove filter ${tagLabel}` }).click();
    remainingTags.shift();
    await expect(
      page.getByRole("button", { name: `Remove filter ${tagLabel}` }),
    ).toHaveCount(0);
    for (const stillActive of remainingTags) {
      await expect(
        page.getByRole("button", { name: `Remove filter ${stillActive}` }),
      ).toBeVisible();
    }
    if (remainingTags.length > 0) {
      await expect(page.getByText(KEYBOARD, { exact: true })).toHaveCount(0);
    }
  }

  await expect(page.getByText(KEYBOARD, { exact: true })).toBeVisible();
});
