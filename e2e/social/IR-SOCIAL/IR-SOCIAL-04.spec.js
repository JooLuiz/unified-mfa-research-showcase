const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-SOCIAL-04 - Open feeds follow a new post and a like-count change without a reload.

const SOCIAL_ORIGIN = "http://localhost:4500";
const POST_TEXT = "Live update: the community feed should show this post.";

test.beforeEach(() => {
  restoreMockData();
});

function postCard(page, text) {
  return page.locator("article.post-card").filter({ hasText: text });
}

async function signIn(page, username) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill(username);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function publishPost(page, content) {
  await page.getByRole("button", { name: "Posts" }).click();
  const postFrame = page.frameLocator('iframe[title="Create new post"]');
  await postFrame.getByLabel("What do you want to share?").fill(content);
  await postFrame.getByRole("button", { name: "Send" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Post published" }),
  ).toBeVisible();
}

test("open feeds follow a new post and a like change", async ({ browser }) => {
  const observerContext = await browser.newContext({ baseURL: SOCIAL_ORIGIN });
  const carlaContext = await browser.newContext({ baseURL: SOCIAL_ORIGIN });
  const brunoContext = await browser.newContext({ baseURL: SOCIAL_ORIGIN });
  try {
    const postsPage = await observerContext.newPage();
    const feedPage = await observerContext.newPage();
    await postsPage.goto("/posts", { waitUntil: "domcontentloaded" });
    await feedPage.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      postsPage.getByRole("heading", { name: "Community Posts" }),
    ).toBeVisible();
    await expect(
      feedPage.getByRole("heading", { name: "Trending Posts" }),
    ).toBeVisible();
    const carlaPage = await carlaContext.newPage();
    await signIn(carlaPage, "carla.nguyen");
    await publishPost(carlaPage, POST_TEXT);
    const communityPost = postCard(postsPage, POST_TEXT);
    await expect(communityPost).toBeVisible();
    await expect(
      communityPost.getByRole("button", { name: "Like (0)" }),
    ).toBeVisible();
    const brunoPage = await brunoContext.newPage();
    await signIn(brunoPage, "bruno.silva");
    await brunoPage.getByRole("button", { name: "Posts" }).click();
    await postCard(brunoPage, POST_TEXT)
      .getByRole("button", { name: "Like (0)" })
      .click();
    await expect(
      communityPost.getByRole("button", { name: "Like (1)" }),
    ).toBeVisible();
    const trendingPost = postCard(feedPage, POST_TEXT);
    await expect(trendingPost).toBeVisible();
    await expect(
      trendingPost.getByRole("button", { name: "Like (1)" }),
    ).toBeVisible();
    await expect(postsPage).toHaveURL(/\/posts$/);
    await expect(feedPage).toHaveURL(/\/$/);
  } finally {
    await brunoContext.close();
    await carlaContext.close();
    await observerContext.close();
  }
});
