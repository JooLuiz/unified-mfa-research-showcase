const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-SOCIAL-04 - Open feeds follow a new post and a like-count change without a reload.

const API_BASE_URL = "http://localhost:4000/api";
const POST_TEXT = "Live update: the community feed should show this post.";

test.beforeEach(() => {
  restoreMockData();
});

async function login(request, username) {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { username, password: "password123" },
  });
  const payload = await response.json();
  return payload.token;
}

function postCard(page, text) {
  return page.locator("article.post-card").filter({ hasText: text });
}

test("open feeds follow a new post and a like change", async ({ browser }) => {
  const context = await browser.newContext();
  const postsPage = await context.newPage();
  const feedPage = await context.newPage();
  try {
    const postsStream = postsPage.waitForResponse(
      (response) =>
        response.url().includes("/api/posts/stream") && response.ok(),
    );
    const feedStream = feedPage.waitForResponse(
      (response) =>
        response.url().includes("/api/posts/stream") && response.ok(),
    );
    await postsPage.goto("/posts", { waitUntil: "domcontentloaded" });
    await feedPage.goto("/", { waitUntil: "domcontentloaded" });
    await postsStream;
    await feedStream;
    await expect(
      postsPage.getByRole("heading", { name: "Community Posts" }),
    ).toBeVisible();
    await expect(
      feedPage.getByRole("heading", { name: "Trending Posts" }),
    ).toBeVisible();
    const carlaToken = await login(postsPage.request, "carla.nguyen");
    const createdResponse = await postsPage.request.post(
      `${API_BASE_URL}/posts`,
      {
        headers: { Authorization: `Bearer ${carlaToken}` },
        data: { content: POST_TEXT },
      },
    );
    expect(createdResponse.status()).toBe(201);
    const createdPost = await createdResponse.json();
    const communityPost = postCard(postsPage, POST_TEXT);
    await expect(communityPost).toBeVisible();
    await expect(
      communityPost.getByRole("button", { name: "Like (0)" }),
    ).toBeVisible();
    const brunoToken = await login(postsPage.request, "bruno.silva");
    const likeResponse = await postsPage.request.post(
      `${API_BASE_URL}/posts/${createdPost.id}/like`,
      { headers: { Authorization: `Bearer ${brunoToken}` } },
    );
    expect(await likeResponse.json()).toEqual({ liked: true, likes: 1 });
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
    await context.close();
  }
});
