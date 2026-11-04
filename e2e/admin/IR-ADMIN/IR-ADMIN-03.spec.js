const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ADMIN-03 - A new order, a new post, and a like update the open dashboard and tables.

const API_BASE_URL = "http://localhost:4000/api";
const TOKEN_KEY = "admin-shell:auth-token";
const USER_KEY = "admin-shell:auth-user";
const POST_TEXT = "Live update: the admin table should show this post.";
const LIKED_POST_TEXT = "Late night brainstorm";
const STARTING_REVENUE = 455.49 + 706.491 + 860.49;
const NEW_ORDER_TOTAL = 55;
test.beforeEach(() => {
  restoreMockData();
});

function formatRevenue(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function summaryValue(page, title) {
  return page
    .locator("article.admin-summary-card")
    .filter({ hasText: title })
    .locator(".admin-summary-value");
}

function isAdminEventStream(response) {
  return /\/api\/admin\/events(\?|$)/.test(response.url()) && response.ok();
}

async function login(request, username) {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { username, password: "password123" },
  });
  const payload = await response.json();
  return payload.token;
}

async function signIn(context) {
  const token = await login(context.request, "alice.parker");
  const userResponse = await context.request.get(`${API_BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const user = await userResponse.json();
  await context.addInitScript(
    ([tokenKey, userKey, storedToken, storedUser]) => {
      localStorage.setItem(tokenKey, storedToken);
      localStorage.setItem(userKey, JSON.stringify(storedUser));
    },
    [TOKEN_KEY, USER_KEY, token, user],
  );
}

test("open dashboard and tables follow a new order, a new post, and a like", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await signIn(context);
  const dashboardPage = await context.newPage();
  const ordersPage = await context.newPage();
  const postsPage = await context.newPage();
  try {
    const dashboardStream = dashboardPage.waitForResponse(isAdminEventStream);
    const ordersStream = ordersPage.waitForResponse(isAdminEventStream);
    const postsStream = postsPage.waitForResponse(isAdminEventStream);
    await dashboardPage.goto("/", { waitUntil: "domcontentloaded" });
    await ordersPage.goto("/orders", { waitUntil: "domcontentloaded" });
    await postsPage.goto("/posts", { waitUntil: "domcontentloaded" });
    await dashboardStream;
    await ordersStream;
    await postsStream;
    await expect(summaryValue(dashboardPage, "Total Orders")).toHaveText("3");
    await expect(summaryValue(dashboardPage, "Total Posts")).toHaveText("21");
    await expect(summaryValue(dashboardPage, "Total Revenue")).toHaveText(
      formatRevenue(STARTING_REVENUE),
    );
    await expect(ordersPage.locator("tr.admin-order-row")).toHaveCount(3);
    await expect(postsPage.locator("tr.admin-post-row")).toHaveCount(21);
    const likedRow = postsPage.locator("tr.admin-post-row").filter({
      hasText: LIKED_POST_TEXT,
    });
    await expect(likedRow.locator(".admin-cell-likes")).toHaveText("1");
    const brunoToken = await login(context.request, "bruno.silva");
    const orderResponse = await context.request.post(`${API_BASE_URL}/orders`, {
      headers: { Authorization: `Bearer ${brunoToken}` },
      data: {
        items: [
          {
            productId: "p-04",
            name: "Precision Optical Mouse",
            quantity: 1,
            unitPrice: NEW_ORDER_TOTAL,
          },
        ],
        subtotal: NEW_ORDER_TOTAL,
        discountAmount: 0,
        totalAmount: NEW_ORDER_TOTAL,
      },
    });
    expect(orderResponse.status()).toBe(201);
    const createdOrder = await orderResponse.json();
    await expect(summaryValue(dashboardPage, "Total Orders")).toHaveText("4");
    await expect(summaryValue(dashboardPage, "Total Revenue")).toHaveText(
      formatRevenue(STARTING_REVENUE + NEW_ORDER_TOTAL),
    );
    const orderRow = ordersPage.locator("tr.admin-order-row").filter({
      hasText: createdOrder.id,
    });
    await expect(orderRow).toContainText("Bruno Silva");
    await expect(orderRow).toContainText("$55.00");
    await expect(orderRow).toContainText("Placed");
    const carlaToken = await login(context.request, "carla.nguyen");
    const postResponse = await context.request.post(`${API_BASE_URL}/posts`, {
      headers: { Authorization: `Bearer ${carlaToken}` },
      data: { content: POST_TEXT },
    });
    expect(postResponse.status()).toBe(201);
    await expect(summaryValue(dashboardPage, "Total Posts")).toHaveText("22");
    await expect(postsPage.locator("tr.admin-post-row")).toHaveCount(22);
    await expect(postsPage.locator("tr.admin-post-row").first()).toContainText(
      POST_TEXT,
    );
    await expect(postsPage.locator("tr.admin-post-row").first()).toContainText(
      "Carla Nguyen",
    );
    const dashboardRefresh = dashboardPage.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        /\/api\/admin\/posts(\?|$)/.test(response.url()) &&
        response.ok(),
    );
    const likeResponse = await context.request.post(
      `${API_BASE_URL}/posts/post-21/like`,
      { headers: { Authorization: `Bearer ${brunoToken}` } },
    );
    expect(await likeResponse.json()).toEqual({ liked: true, likes: 2 });
    await dashboardRefresh;
    await expect(likedRow.locator(".admin-cell-likes")).toHaveText("2");
    await expect(summaryValue(dashboardPage, "Total Orders")).toHaveText("4");
    await expect(summaryValue(dashboardPage, "Total Posts")).toHaveText("22");
    await expect(dashboardPage).toHaveURL(/\/$/);
    await expect(ordersPage).toHaveURL(/\/orders$/);
    await expect(postsPage).toHaveURL(/\/posts$/);
  } finally {
    await context.close();
  }
});
