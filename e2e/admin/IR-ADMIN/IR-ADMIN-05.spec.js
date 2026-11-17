const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedEmptyPosts } = require("../../support/seed-empty-state");

// IR-ADMIN-05 - An admin with no posts sees the empty posts message.

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

test("an admin with no posts sees the empty posts message", async ({ page }) => {
  await seedEmptyPosts();
  await signInThroughTheForm(page);
  await page.goto("/posts", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "All Posts" })).toBeVisible();
  await expect(page.locator("p.admin-empty")).toHaveText("No posts found.");
  await expect(page.locator("tr.admin-post-row")).toHaveCount(0);
});
