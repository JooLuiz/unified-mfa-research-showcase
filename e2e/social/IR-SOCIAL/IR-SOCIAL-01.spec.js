const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-SOCIAL-01 - A signed-in person sends text and an image, and the feed shows the post.

const USERNAME = "carla.nguyen";
const POST_TEXT = "The new desk lamp just arrived and the light is perfect.";
const IMAGE_URL = "https://example.com/desk-lamp.jpg";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill(USERNAME);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

test("a signed-in person publishes a post and the feed shows it", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page);
  await page.getByRole("button", { name: "Posts" }).click();
  await expect(
    page.getByRole("heading", { name: "Community Posts" }),
  ).toBeVisible();
  const postFrame = page.frameLocator('iframe[title="Create new post"]');
  await expect(
    postFrame.getByRole("heading", { name: "Create a new post" }),
  ).toBeVisible();
  await postFrame.getByLabel("What do you want to share?").fill(POST_TEXT);
  await postFrame.getByLabel("Image URL (optional)").fill(IMAGE_URL);
  const postRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().includes("/api/posts"),
  );
  await postFrame.getByRole("button", { name: "Send" }).click();
  const sentRequest = await postRequest;
  expect(sentRequest.postDataJSON()).toEqual({
    content: POST_TEXT,
    imageUrl: IMAGE_URL,
    authorId: "u-03",
  });
  await expect(
    page.getByRole("status").filter({ hasText: "Post published" }),
  ).toBeVisible();
  const latestPosts = page.locator("section.post-feed-shell").filter({
    has: page.getByRole("heading", { name: "Latest Posts" }),
  });
  const newPost = latestPosts.locator("article.post-card").filter({
    hasText: POST_TEXT,
  });
  await expect(newPost).toBeVisible();
  await expect(
    newPost.getByRole("img", { name: "Post visual" }),
  ).toHaveAttribute("src", IMAGE_URL);
});
