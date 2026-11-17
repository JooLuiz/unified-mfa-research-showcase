const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-SOCIAL-06 - A like that never reaches the server does not change the like count.

const USERNAME = "bruno.silva";
const POST_TEXT =
  "Sunday reset: clean desk, empty inbox, full water bottle. Ready for the week.";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill(USERNAME);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function dropLike(page) {
  await page.route("**/api/posts/*/like", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.abort();
  });
}

test("a like that never reaches the server does not change the like count", async ({
  page,
}) => {
  await signInThroughTheForm(page);
  await expect(
    page.getByRole("heading", { name: "Trending Posts" }),
  ).toBeVisible();
  const feedPost = page.locator("article.post-card").filter({
    hasText: POST_TEXT,
  });
  const likeButton = feedPost.getByRole("button", { name: "Like (1)" });
  await expect(likeButton).toBeVisible();
  await dropLike(page);
  await likeButton.click();
  await expect(likeButton).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Post Liked" }),
  ).toHaveCount(0);
});
