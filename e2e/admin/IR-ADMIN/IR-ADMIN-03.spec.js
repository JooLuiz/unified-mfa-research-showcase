const { test, expect, chromium } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedCart } = require("../../support/seed-cart");

// IR-ADMIN-03 - A new order, a new post, and a like update the open dashboard and tables.
// The orders page and the posts page each run in their own Chromium process. A signed-in
// tab already holds several SSE connections, and Chrome allows 6 to the mock API, so another
// tab in the same browser never opens the admin event stream.

const API_BASE_URL = "http://localhost:4000/api";
const ADMIN_ORIGIN = "http://localhost:4600";
const STORE_ORIGIN = "http://localhost:4200";
const SOCIAL_ORIGIN = "http://localhost:4500";
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

async function installSession(context, session) {
  await context.addInitScript(
    ([tokenKey, userKey, storedToken, storedUser]) => {
      localStorage.setItem(tokenKey, storedToken);
      localStorage.setItem(userKey, JSON.stringify(storedUser));
    },
    [TOKEN_KEY, USER_KEY, session.token, session.user],
  );
}

async function closeLaunchedBrowser(browser) {
  // Headed Chrome can keep the close handshake open past the test timeout.
  const gaveUpWaiting = new Promise((resolve) => setTimeout(resolve, 5_000));
  await Promise.race([browser.close(), gaveUpWaiting]);
}

async function signIn(context) {
  const response = await context.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "alice.parker", password: "password123" },
  });
  const session = await response.json();
  await installSession(context, session);
  return session;
}

test("open dashboard and tables follow a new order, a new post, and a like", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ baseURL: ADMIN_ORIGIN });
  const ordersBrowser = await chromium.launch({ headless: false });
  const postsBrowser = await chromium.launch({ headless: false });
  let storeContext;
  let carlaContext;
  let brunoContext;
  try {
    const ordersContext = await ordersBrowser.newContext({
      baseURL: ADMIN_ORIGIN,
    });
    const postsContext = await postsBrowser.newContext({
      baseURL: ADMIN_ORIGIN,
    });
    const session = await signIn(context);
    await installSession(ordersContext, session);
    await installSession(postsContext, session);
    const dashboardPage = await context.newPage();
    const ordersPage = await ordersContext.newPage();
    const postsPage = await postsContext.newPage();
    await dashboardPage.goto("/", { waitUntil: "domcontentloaded" });
    await ordersPage.goto("/orders", { waitUntil: "domcontentloaded" });
    await postsPage.goto("/posts", { waitUntil: "domcontentloaded" });
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
    storeContext = await browser.newContext({ baseURL: STORE_ORIGIN });
    const storeLogin = await storeContext.request.post(
      `${API_BASE_URL}/auth/login`,
      { data: { username: "bruno.silva", password: "password123" } },
    );
    const bruno = await storeLogin.json();
    await seedCart("bruno.silva", [{ productId: "p-04", quantity: 1 }]);
    await storeContext.addInitScript(
      ([token, user]) => {
        localStorage.setItem("ecommerce-shell:auth-token", token);
        localStorage.setItem(
          "ecommerce-shell:auth-user",
          JSON.stringify(user),
        );
      },
      [bruno.token, bruno.user],
    );
    const storePage = await storeContext.newPage();
    await storePage.goto("/checkout", { waitUntil: "domcontentloaded" });
    await storePage.getByRole("button", { name: "Place Order" }).click();
    await expect(
      storePage.getByRole("heading", { name: "Order Placed!" }),
    ).toBeVisible();
    await expect(summaryValue(dashboardPage, "Total Orders")).toHaveText("4");
    await expect(summaryValue(dashboardPage, "Total Revenue")).toHaveText(
      formatRevenue(STARTING_REVENUE + NEW_ORDER_TOTAL),
    );
    const orderRow = ordersPage.locator("tr.admin-order-row").filter({
      hasText: "Bruno Silva",
    });
    await expect(orderRow).toContainText("Bruno Silva");
    await expect(orderRow).toContainText("$55.00");
    await expect(orderRow).toContainText("Placed");
    carlaContext = await browser.newContext({ baseURL: SOCIAL_ORIGIN });
    const carlaPage = await carlaContext.newPage();
    await carlaPage.goto("/login", { waitUntil: "domcontentloaded" });
    await carlaPage.getByLabel("Username or email").fill("carla.nguyen");
    await carlaPage.getByLabel("Password").fill("password123");
    await carlaPage.getByRole("button", { name: "Sign in" }).click();
    await expect(carlaPage.getByRole("button", { name: "Log out" })).toBeVisible();
    await carlaPage.getByRole("button", { name: "Posts" }).click();
    const postFrame = carlaPage.frameLocator('iframe[title="Create new post"]');
    await postFrame.getByLabel("What do you want to share?").fill(POST_TEXT);
    await postFrame.getByRole("button", { name: "Send" }).click();
    await expect(summaryValue(dashboardPage, "Total Posts")).toHaveText("22");
    await expect(postsPage.locator("tr.admin-post-row")).toHaveCount(22);
    await expect(postsPage.locator("tr.admin-post-row").first()).toContainText(
      POST_TEXT,
    );
    await expect(postsPage.locator("tr.admin-post-row").first()).toContainText(
      "Carla Nguyen",
    );
    brunoContext = await browser.newContext({ baseURL: SOCIAL_ORIGIN });
    const brunoPage = await brunoContext.newPage();
    await brunoPage.goto("/login", { waitUntil: "domcontentloaded" });
    await brunoPage.getByLabel("Username or email").fill("bruno.silva");
    await brunoPage.getByLabel("Password").fill("password123");
    await brunoPage.getByRole("button", { name: "Sign in" }).click();
    await expect(brunoPage.getByRole("button", { name: "Log out" })).toBeVisible();
    await brunoPage.goto("/posts/post-21", { waitUntil: "domcontentloaded" });
    await brunoPage
      .locator(".single-post-card")
      .getByRole("button", { name: /^Like \(/ })
      .click();
    await expect(likedRow.locator(".admin-cell-likes")).toHaveText("2");
    await expect(summaryValue(dashboardPage, "Total Orders")).toHaveText("4");
    await expect(summaryValue(dashboardPage, "Total Posts")).toHaveText("22");
    await expect(dashboardPage).toHaveURL(/\/$/);
    await expect(ordersPage).toHaveURL(/\/orders$/);
    await expect(postsPage).toHaveURL(/\/posts$/);
  } finally {
    await storeContext?.close();
    await carlaContext?.close();
    await brunoContext?.close();
    await closeLaunchedBrowser(ordersBrowser);
    await closeLaunchedBrowser(postsBrowser);
    await context.close();
  }
});
