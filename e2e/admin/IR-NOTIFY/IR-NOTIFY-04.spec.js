const { test, expect, chromium } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NOTIFY-04 - Marking one admin notice, then the rest, updates the other admin tab.
// The follower tab runs in its own Chromium process. A signed-in tab already holds
// several SSE connections, and Chrome allows 6 to the mock API, so a second tab in
// the same browser never opens the notification stream.

const API_BASE_URL = "http://localhost:4000/api";
const ADMIN_ORIGIN = "http://localhost:4600";
const TOKEN_KEY = "admin-shell:auth-token";
const USER_KEY = "admin-shell:auth-user";
const SHIPPED_ORDER_ID = "order-mp4ve3gd-kb6od6";

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

function isAdminInboxStream(response) {
  return (
    response.request().method() === "GET" &&
    /\/api\/notifications\/stream\?shell=admin(&|$)/.test(response.url()) &&
    response.ok()
  );
}

function noticeRow(targetPage, title) {
  return targetPage.locator(".notification-item").filter({ hasText: title });
}

function markReadButton(targetPage, title) {
  return noticeRow(targetPage, title).getByRole("button", {
    name: "Mark as read",
    exact: true,
  });
}

test("both admin tabs follow mark-one and mark-all", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ baseURL: ADMIN_ORIGIN });
  const otherBrowser = await chromium.launch({ headless: false });
  try {
    const carlaToken = await login(context.request, "carla.nguyen");
    const postResponse = await context.request.post(`${API_BASE_URL}/posts`, {
      headers: { Authorization: `Bearer ${carlaToken}` },
      data: { content: "A saved post for the admin inbox." },
    });
    expect(postResponse.status()).toBe(201);
    const brunoToken = await login(context.request, "bruno.silva");
    const orderResponse = await context.request.post(`${API_BASE_URL}/orders`, {
      headers: { Authorization: `Bearer ${brunoToken}` },
      data: {
        items: [
          {
            productId: "p-04",
            name: "Precision Optical Mouse",
            quantity: 1,
            unitPrice: 55,
          },
        ],
        subtotal: 55,
        discountAmount: 0,
        totalAmount: 55,
      },
    });
    expect(orderResponse.status()).toBe(201);
    const seedToken = await login(context.request, "alice.parker");
    const statusResponse = await context.request.put(
      `${API_BASE_URL}/orders/${SHIPPED_ORDER_ID}/status`,
      {
        headers: { Authorization: `Bearer ${seedToken}` },
        data: { status: "shipped", actor: "admin" },
      },
    );
    expect(statusResponse.ok()).toBeTruthy();
    const otherContext = await otherBrowser.newContext({ baseURL: ADMIN_ORIGIN });
    const session = await signIn(context);
    await installSession(otherContext, session);
    const token = session.token;
    const actingPage = await context.newPage();
    const otherPage = await otherContext.newPage();
    const followedTabWrites = [];
    otherPage.on("request", (request) => {
      if (
        request.method() === "PUT" &&
        request.url().includes("/api/notifications")
      ) {
        followedTabWrites.push(request.url());
      }
    });
    const actingStream = actingPage.waitForResponse(isAdminInboxStream);
    const otherStream = otherPage.waitForResponse(isAdminInboxStream);
    await actingPage.goto("/notifications", { waitUntil: "domcontentloaded" });
    await otherPage.goto("/notifications", { waitUntil: "domcontentloaded" });
    await actingStream;
    await otherStream;
    await expect(actingPage.locator(".notification-bell-badge")).toHaveText(
      "2",
    );
    await expect(otherPage.locator(".notification-bell-badge")).toHaveText("2");
    await expect(markReadButton(actingPage, "New post")).toBeVisible();
    await expect(markReadButton(otherPage, "New order")).toBeVisible();
    const readResponse = actingPage.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        /\/api\/notifications\/[^/]+\/read$/.test(response.url()) &&
        response.ok(),
    );
    await markReadButton(actingPage, "New post").click();
    const updatedNotice = await (await readResponse).json();
    expect(updatedNotice.title).toBe("New post");
    expect(updatedNotice.read).toBe(true);
    await expect(markReadButton(actingPage, "New post")).toHaveCount(0);
    await expect(markReadButton(actingPage, "New order")).toBeVisible();
    await expect(actingPage.locator(".notification-bell-badge")).toHaveText(
      "1",
    );
    await expect(markReadButton(otherPage, "New post")).toHaveCount(0);
    await expect(markReadButton(otherPage, "New order")).toBeVisible();
    await expect(otherPage.locator(".notification-bell-badge")).toHaveText("1");
    const markAllButton = actingPage.getByRole("button", {
      name: "Mark all as read",
      exact: true,
    });
    await expect(markAllButton).toBeEnabled();
    const readAllResponse = actingPage.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        /\/api\/notifications\/read-all\?shell=admin$/.test(response.url()) &&
        response.ok(),
    );
    await markAllButton.click();
    const readAllPayload = await (await readAllResponse).json();
    expect(readAllPayload.items.every((item) => item.read)).toBe(true);
    await expect(actingPage.locator(".notification-bell-badge")).toHaveCount(0);
    await expect(otherPage.locator(".notification-bell-badge")).toHaveCount(0);
    await expect(
      actingPage.getByRole("button", { name: "Mark as read", exact: true }),
    ).toHaveCount(0);
    await expect(
      otherPage.getByRole("button", { name: "Mark as read", exact: true }),
    ).toHaveCount(0);
    await expect(markAllButton).toBeDisabled();
    await expect(
      otherPage.getByRole("button", { name: "Mark all as read", exact: true }),
    ).toBeDisabled();
    await expect(actingPage.locator(".notification-toast")).toHaveCount(0);
    await expect(otherPage.locator(".notification-toast")).toHaveCount(0);
    await expect(actingPage).toHaveURL(/\/notifications$/);
    await expect(otherPage).toHaveURL(/\/notifications$/);
    expect(followedTabWrites).toEqual([]);
    const storeInboxResponse = await context.request.get(
      `${API_BASE_URL}/notifications?shell=ecommerce`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const storeInbox = await storeInboxResponse.json();
    expect(storeInbox.items.map((item) => item.title)).toEqual([
      "Order status updated",
    ]);
    expect(storeInbox.items[0].read).toBe(false);
  } finally {
    await otherBrowser.close();
    await context.close();
  }
});
