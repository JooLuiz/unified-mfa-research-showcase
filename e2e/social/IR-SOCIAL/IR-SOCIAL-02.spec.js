const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-SOCIAL-02 - A signed-in person likes a post on the feed and unlikes it on the post card.

const USERNAME = "bruno.silva";
const POST_TEXT =
  "Sunday reset: clean desk, empty inbox, full water bottle. Ready for the week.";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill(USERNAME);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

test("a signed-in person likes a post on the feed and unlikes it on the post card", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page);
  await expect(
    page.getByRole("heading", { name: "Trending Posts" }),
  ).toBeVisible();
  const feedPost = page.locator("article.post-card").filter({
    hasText: POST_TEXT,
  });
  await feedPost.getByRole("button", { name: "Like (1)" }).click();
  await expect(
    feedPost.getByRole("button", { name: "Liked (2)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Post Liked" }),
  ).toBeVisible();
  await feedPost.getByText(POST_TEXT).click();
  await expect(page).toHaveURL(/\/posts\/post-19$/);
  const postCard = page.locator(".single-post-card");
  await expect(postCard.getByText(POST_TEXT)).toBeVisible();
  await postCard.getByRole("button", { name: "Liked (2)" }).click();
  await expect(
    postCard.getByRole("button", { name: "Like (1)" }),
  ).toBeVisible();
});
