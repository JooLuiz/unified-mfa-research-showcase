const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-SOCIAL-03 - The post card tells the shell that a post was liked.

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

test("the feed card tells the shell that a post was liked", async ({
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
  const shellNotice = page
    .getByRole("status")
    .filter({ hasText: "Post Liked" });
  await expect(shellNotice).toBeVisible();
  await expect(shellNotice).toContainText("You liked this post.");
  await page.getByRole("button", { name: "Posts" }).click();
  await expect(
    page.getByRole("heading", { name: "Community Posts" }),
  ).toBeVisible();
  const communityPost = page.locator("article.post-card").filter({
    hasText: POST_TEXT,
  });
  await expect(
    communityPost.getByRole("button", { name: "Liked (2)" }),
  ).toBeVisible();
});
