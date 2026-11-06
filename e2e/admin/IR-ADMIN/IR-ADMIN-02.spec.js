const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ADMIN-02 - The dashboard and posts table load every user's posts, and only an admin token passes.

const API_BASE_URL = "http://localhost:4000/api";
const ADMIN_TOKEN_KEY = "admin-shell:auth-token";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page, username) {
  await page.getByLabel("Username or email").fill(username);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("the dashboard and posts table load every post", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const postsResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      /\/api\/admin\/posts(\?|$)/.test(response.url()) &&
      response.ok(),
  );
  await signInThroughTheForm(page, "alice.parker");
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  const postsResponse = await postsResponsePromise;
  const adminToken = await page.evaluate(
    (tokenKey) => localStorage.getItem(tokenKey),
    ADMIN_TOKEN_KEY,
  );
  const postsPayload = await postsResponse.json();
  expect(adminToken).toBeTruthy();
  expect(postsResponse.request().headers().authorization).toBe(
    `Bearer ${adminToken}`,
  );
  expect(postsPayload.total).toBe(21);
  expect(postsPayload.items[0].id).toBe("post-21");
  expect(new Set(postsPayload.items.map((post) => post.authorId))).toEqual(
    new Set(["u-01", "u-02", "u-03"]),
  );
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard" }),
  ).toBeVisible();
  await expect(
    page
      .locator("article.admin-summary-card")
      .filter({ hasText: "Total Posts" })
      .locator(".admin-summary-value"),
  ).toHaveText("21");
  await page.getByRole("button", { name: "Posts" }).click();
  await expect(page.getByRole("heading", { name: "All Posts" })).toBeVisible();
  await expect(page.locator("tr.admin-post-row")).toHaveCount(21);
  await expect(page.locator("tr.admin-post-row").first()).toContainText(
    "Carla Nguyen",
  );
  await expect(
    page.locator("tr.admin-post-row").filter({ hasText: "Sunday reset" }),
  ).toContainText("Alice Parker");
  await expect(
    page
      .locator("tr.admin-post-row")
      .filter({ hasText: "First long bike ride" }),
  ).toContainText("Bruno Silva");
  await expect(
    page
      .locator("tr.admin-post-row")
      .filter({ hasText: "Late night brainstorm" }),
  ).toContainText("Carla Nguyen");
});

test("a customer token cannot load admin posts", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page, "bruno.silva");
  await expect(
    page.getByRole("alert").filter({ hasText: "Access denied" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "All Posts" })).toHaveCount(0);
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "bruno.silva", password: "password123" },
  });
  const brunoToken = (await loginResponse.json()).token;
  const postsDenied = await page.request.get(`${API_BASE_URL}/admin/posts`, {
    headers: { Authorization: `Bearer ${brunoToken}` },
  });
  const postsWithoutToken = await page.request.get(
    `${API_BASE_URL}/admin/posts`,
  );
  expect(postsDenied.status()).toBe(403);
  expect(postsWithoutToken.status()).toBe(401);
});
