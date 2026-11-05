const { test, expect, chromium } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ORDER-04 - The open customer screens follow an order status change.
// The order-details page runs in its own Chromium process. A signed-in tab already
// holds several SSE connections, and Chrome allows 6 to the mock API, so a second
// tab in the same browser never opens the order-status stream.

const API_BASE_URL = "http://localhost:4000/api";
const STORE_ORIGIN = "http://localhost:4200";
const ORDER_ID = "order-mp4ve3gd-kb6od6";
const TOKEN_KEY = "ecommerce-shell:auth-token";
const USER_KEY = "ecommerce-shell:auth-user";

test.beforeEach(() => {
  restoreMockData();
});

async function installSession(context, session) {
  await context.addInitScript(
    ([tokenKey, userKey, token, user]) => {
      localStorage.setItem(tokenKey, token);
      localStorage.setItem(userKey, JSON.stringify(user));
    },
    [TOKEN_KEY, USER_KEY, session.token, session.user],
  );
}

async function signIn(context) {
  const response = await context.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "alice.parker", password: "password123" },
  });
  const session = await response.json();
  await installSession(context, session);
  return session;
}

function isCustomerStatusStream(response) {
  return /\/api\/orders\/stream(\?|$)/.test(response.url()) && response.ok();
}

test("open customer screens follow a status change", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ baseURL: STORE_ORIGIN });
  const detailsBrowser = await chromium.launch({ headless: false });
  try {
    const detailsContext = await detailsBrowser.newContext({
      baseURL: STORE_ORIGIN,
    });
    const session = await signIn(context);
    await installSession(detailsContext, session);
    const token = session.token;
    const accountPage = await context.newPage();
    const detailsPage = await detailsContext.newPage();
    const accountStream = accountPage.waitForResponse(isCustomerStatusStream);
    const detailsStream = detailsPage.waitForResponse(isCustomerStatusStream);
    await accountPage.goto("/account", { waitUntil: "domcontentloaded" });
    await detailsPage.goto(`/order-details/${ORDER_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await accountStream;
    await detailsStream;
    const accountRow = accountPage.locator("button.my-orders-row").filter({
      hasText: ORDER_ID,
    });
    await expect(accountRow.locator(".my-orders-row-status")).toHaveText(
      "Placed",
    );
    await expect(detailsPage.locator(".order-details-status")).toHaveText(
      "Placed",
    );
    const statusResponse = await context.request.put(
      `${API_BASE_URL}/orders/${ORDER_ID}/status`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { status: "shipped", actor: "admin" },
      },
    );
    expect(statusResponse.ok()).toBeTruthy();
    await expect(accountRow.locator(".my-orders-row-status")).toHaveText(
      "Shipped",
    );
    await expect(detailsPage.locator(".order-details-status")).toHaveText(
      "Shipped",
    );
    await expect(accountPage).toHaveURL(/\/account$/);
    await expect(detailsPage).toHaveURL(
      new RegExp(`/order-details/${ORDER_ID}$`),
    );
  } finally {
    await detailsBrowser.close();
    await context.close();
  }
});
