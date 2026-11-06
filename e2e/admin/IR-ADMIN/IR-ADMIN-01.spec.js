const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ADMIN-01 - The dashboard and orders table load every user's data, and only an admin token passes.

const API_BASE_URL = "http://localhost:4000/api";
const ADMIN_TOKEN_KEY = "admin-shell:auth-token";
const ORDER_IDS = [
  "order-mpq0wylv-j2mdx0",
  "order-mp4ve3gd-kb6od6",
  "order-mp20d2w4-s59o9n",
];

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page, username) {
  await page.getByLabel("Username or email").fill(username);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
}

function summaryCard(page, title) {
  return page.locator("article.admin-summary-card").filter({ hasText: title });
}

test("the dashboard and orders table load every order and post", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const ordersResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      /\/api\/admin\/orders(\?|$)/.test(response.url()) &&
      response.ok(),
  );
  const postsResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      /\/api\/admin\/posts(\?|$)/.test(response.url()) &&
      response.ok(),
  );
  await signInThroughTheForm(page, "alice.parker");
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  const ordersResponse = await ordersResponsePromise;
  const postsResponse = await postsResponsePromise;
  const adminToken = await page.evaluate(
    (tokenKey) => localStorage.getItem(tokenKey),
    ADMIN_TOKEN_KEY,
  );
  const ordersPayload = await ordersResponse.json();
  const postsPayload = await postsResponse.json();
  const revenueLabel = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(
    ordersPayload.items.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    ),
  );
  expect(adminToken).toBeTruthy();
  expect(ordersResponse.request().headers().authorization).toBe(
    `Bearer ${adminToken}`,
  );
  expect(postsResponse.request().headers().authorization).toBe(
    `Bearer ${adminToken}`,
  );
  expect(ordersPayload.total).toBe(3);
  expect(ordersPayload.items.map((order) => order.id)).toEqual(ORDER_IDS);
  expect(postsPayload.total).toBe(21);
  expect(new Set(postsPayload.items.map((post) => post.authorId))).toEqual(
    new Set(["u-01", "u-02", "u-03"]),
  );
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard" }),
  ).toBeVisible();
  await expect(
    summaryCard(page, "Total Orders").locator(".admin-summary-value"),
  ).toHaveText("3");
  await expect(
    summaryCard(page, "Total Posts").locator(".admin-summary-value"),
  ).toHaveText("21");
  await expect(
    summaryCard(page, "Total Revenue").locator(".admin-summary-value"),
  ).toHaveText(revenueLabel);
  await page.getByRole("button", { name: "Orders" }).click();
  await expect(page.getByRole("heading", { name: "All Orders" })).toBeVisible();
  await expect(page.locator("tr.admin-order-row")).toHaveCount(3);
  for (const orderId of ORDER_IDS) {
    await expect(
      page.locator("tr.admin-order-row").filter({ hasText: orderId }),
    ).toContainText("Alice Parker");
  }
});

test("a customer token cannot load admin orders or posts", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page, "bruno.silva");
  await expect(
    page.getByRole("alert").filter({ hasText: "Access denied" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard" }),
  ).toHaveCount(0);
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "bruno.silva", password: "password123" },
  });
  const brunoToken = (await loginResponse.json()).token;
  const ordersDenied = await page.request.get(`${API_BASE_URL}/admin/orders`, {
    headers: { Authorization: `Bearer ${brunoToken}` },
  });
  const postsDenied = await page.request.get(`${API_BASE_URL}/admin/posts`, {
    headers: { Authorization: `Bearer ${brunoToken}` },
  });
  const ordersWithoutToken = await page.request.get(
    `${API_BASE_URL}/admin/orders`,
  );
  expect(ordersDenied.status()).toBe(403);
  expect(postsDenied.status()).toBe(403);
  expect(ordersWithoutToken.status()).toBe(401);
});
