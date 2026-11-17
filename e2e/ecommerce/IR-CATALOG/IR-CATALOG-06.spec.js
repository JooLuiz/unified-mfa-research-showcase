const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CATALOG-06 - A narrow product list shows fewer cards than the desktop list.

test.beforeEach(() => {
  restoreMockData();
});

async function countProductCards(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await expect(page.locator("article.card-shell").first()).toBeVisible();
  return page.locator("article.card-shell").count();
}

test("a narrow product list shows fewer cards than the desktop list", async ({
  page,
}) => {
  const desktopCount = await countProductCards(page, {
    width: 1280,
    height: 720,
  });
  const narrowCount = await countProductCards(page, {
    width: 600,
    height: 800,
  });
  expect(narrowCount).toBeLessThan(desktopCount);
});

test("widening the open list shows more cards, and a small resize keeps that count", async ({
  page,
}) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await expect(page.locator("article.card-shell").first()).toBeVisible();
  const narrowCount = await page.locator("article.card-shell").count();

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect
    .poll(() => page.locator("article.card-shell").count())
    .toBeGreaterThan(narrowCount);
  const wideCount = await page.locator("article.card-shell").count();

  await page.setViewportSize({ width: 1300, height: 720 });
  await expect
    .poll(() => page.locator("article.card-shell").count())
    .toBe(wideCount);
});
