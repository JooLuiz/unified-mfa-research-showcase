const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-SOCIAL-11 - A single post that cannot be loaded shows the error copy instead of a card.

test.beforeEach(() => {
  restoreMockData();
});

test("an unknown post id shows the failed status", async ({ page }) => {
  await page.goto("/posts/post-missing", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".single-post-error")).toHaveText(
    "Failed to load post: 404",
  );
  await expect(page.locator(".single-post-card")).toHaveCount(0);
});

test("a post request that never arrives shows the error copy", async ({ page }) => {
  await page.route("**/api/posts/post-01", (route) => route.abort());
  await page.goto("/posts/post-01", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".single-post-error")).toBeVisible();
  await expect(page.locator(".single-post-card")).toHaveCount(0);
});
