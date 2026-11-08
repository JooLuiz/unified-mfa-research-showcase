const { test, expect, chromium } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ORDER-04 - The open admin screens follow an order status change.
// The order-details page runs in its own Chromium process. A signed-in tab already
// holds several SSE connections, and Chrome allows 6 to the mock API, so a second
// tab in the same browser never opens the order-status stream.

const API_BASE_URL = "http://localhost:4000/api";
const ADMIN_ORIGIN = "http://localhost:4600";
const ORDER_ID = "order-mp4ve3gd-kb6od6";
const TOKEN_KEY = "admin-shell:auth-token";
const USER_KEY = "admin-shell:auth-user";

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

test("open admin screens follow a status change", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ baseURL: ADMIN_ORIGIN });
  const detailsBrowser = await chromium.launch({ headless: false });
  try {
    const detailsContext = await detailsBrowser.newContext({
      baseURL: ADMIN_ORIGIN,
    });
    const session = await signIn(context);
    await installSession(detailsContext, session);
    const ordersPage = await context.newPage();
    const detailsPage = await detailsContext.newPage();
    await ordersPage.goto("/orders", { waitUntil: "domcontentloaded" });
    await detailsPage.goto(`/order-details/${ORDER_ID}`, {
      waitUntil: "domcontentloaded",
    });
    const orderRow = ordersPage.locator("tr.admin-order-row").filter({
      hasText: ORDER_ID,
    });
    await expect(orderRow.locator("td").nth(5)).toHaveText("Placed");
    await expect(detailsPage.locator(".order-details-status")).toHaveText(
      "Placed",
    );
    await detailsPage
      .locator(".order-details-shell")
      .getByRole("button", { name: "Ship" })
      .click();
    await expect(orderRow.locator("td").nth(5)).toHaveText("Shipped");
    await expect(detailsPage.locator(".order-details-status")).toHaveText(
      "Shipped",
    );
    await expect(ordersPage).toHaveURL(/\/orders$/);
    await expect(detailsPage).toHaveURL(
      new RegExp(`/order-details/${ORDER_ID}$`),
    );
  } finally {
    await detailsBrowser.close();
    await context.close();
  }
});
