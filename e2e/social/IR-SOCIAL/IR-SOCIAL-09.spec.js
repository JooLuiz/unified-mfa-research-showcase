const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-SOCIAL-09 - A signed-out visitor does not get a composer and no new post appears.

test.beforeEach(() => {
  restoreMockData();
});

test("a signed-out visitor cannot add a post", async ({ page }) => {
  await page.goto("/posts", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("You need to be logged in to create a new post."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Just set up my new minimalist desk lamp from MFE Lab. The light is buttery soft and the build feels premium.",
    ),
  ).toBeVisible();
  await expect(page.locator('iframe[title="Create new post"]')).toHaveCount(0);
});
