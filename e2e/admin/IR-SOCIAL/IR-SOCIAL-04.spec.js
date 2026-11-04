const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-SOCIAL-04 - The admin posts table follows a new post and a like-count change without a reload.

const API_BASE_URL = "http://localhost:4000/api";
const POST_TEXT = "Live update: the community feed should show this post.";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function login(request, username) {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { username, password: "password123" },
  });
  const payload = await response.json();
  return payload.token;
}

test("the admin posts table follows a new post and a like change", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const adminStream = page.waitForResponse(
    (response) => response.url().includes("/api/admin/events") && response.ok(),
  );
  await signInThroughTheForm(page);
  await adminStream;
  await page.getByRole("button", { name: "Posts" }).click();
  await expect(page.getByRole("heading", { name: "All Posts" })).toBeVisible();
  await expect(page.locator("tr.admin-post-row").first()).toBeVisible();
  const carlaToken = await login(page.request, "carla.nguyen");
  const createdResponse = await page.request.post(`${API_BASE_URL}/posts`, {
    headers: { Authorization: `Bearer ${carlaToken}` },
    data: { content: POST_TEXT },
  });
  expect(createdResponse.status()).toBe(201);
  const createdPost = await createdResponse.json();
  const newRow = page
    .locator("tr.admin-post-row")
    .filter({ hasText: POST_TEXT });
  await expect(newRow).toBeVisible();
  await expect(newRow.locator(".admin-cell-likes")).toHaveText("0");
  const brunoToken = await login(page.request, "bruno.silva");
  const likeResponse = await page.request.post(
    `${API_BASE_URL}/posts/${createdPost.id}/like`,
    { headers: { Authorization: `Bearer ${brunoToken}` } },
  );
  expect(await likeResponse.json()).toEqual({ liked: true, likes: 1 });
  await expect(newRow.locator(".admin-cell-likes")).toHaveText("1");
  await expect(page).toHaveURL(/\/posts$/);
});
