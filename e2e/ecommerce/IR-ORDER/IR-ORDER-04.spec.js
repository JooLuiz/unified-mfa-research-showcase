const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ORDER-04 - The open customer screens follow an order status change.

const API_BASE_URL = "http://localhost:4000/api";
const ORDER_ID = "order-mp4ve3gd-kb6od6";
const TOKEN_KEY = "ecommerce-shell:auth-token";
const USER_KEY = "ecommerce-shell:auth-user";

test.beforeEach(() => {
  restoreMockData();
});

async function signIn(context) {
  const response = await context.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "alice.parker", password: "password123" },
  });
  const payload = await response.json();
  await context.addInitScript(
    ([tokenKey, userKey, token, user]) => {
      localStorage.setItem(tokenKey, token);
      localStorage.setItem(userKey, JSON.stringify(user));
    },
    [TOKEN_KEY, USER_KEY, payload.token, payload.user],
  );
  return payload.token;
}

function isCustomerStatusStream(response) {
  return /\/api\/orders\/stream(\?|$)/.test(response.url()) && response.ok();
}

test("open customer screens follow a status change", async ({ browser }) => {
  const context = await browser.newContext();
  const token = await signIn(context);
  const accountPage = await context.newPage();
  const detailsPage = await context.newPage();
  try {
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
    await context.close();
  }
});
