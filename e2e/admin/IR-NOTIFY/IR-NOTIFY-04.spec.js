const { test, expect, chromium } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedNotification } = require("../../support/seed-notification");
const { seedOrder } = require("../../support/seed-order");

// IR-NOTIFY-04 - Marking one admin notice, then the rest, updates the other admin tab.
// The follower tab runs in its own Chromium process. A signed-in tab already holds
// several SSE connections, and Chrome allows 6 to the mock API, so a second tab in
// the same browser never opens the notification stream.

const API_BASE_URL = "http://localhost:4000/api";
const ADMIN_ORIGIN = "http://localhost:4600";
const TOKEN_KEY = "admin-shell:auth-token";
const USER_KEY = "admin-shell:auth-user";
const SHIPPED_ORDER_ID = "order-mp4ve3gd-kb6od6";
const SEEDED_ORDER_ID = "order-e2e-placed";

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

async function shipExistingOrder(browser) {
  const adminContext = await browser.newContext({ baseURL: ADMIN_ORIGIN });
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/login", { waitUntil: "domcontentloaded" });
  await adminPage.getByLabel("Username or email").fill("alice.parker");
  await adminPage.getByLabel("Password").fill("password123");
  await adminPage.getByRole("button", { name: "Sign in" }).click();
  await expect(adminPage.getByRole("button", { name: "Log out" })).toBeVisible();
  await adminPage.goto(`/order-details/${SHIPPED_ORDER_ID}`, {
    waitUntil: "domcontentloaded",
  });
  await adminPage
    .locator(".order-details-shell")
    .getByRole("button", { name: "Ship" })
    .click();
  await expect(adminPage.locator(".order-details-status")).toHaveText(
    "Shipped",
  );
  await adminContext.close();
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
    await seedOrder("bruno.silva", {
      id: SEEDED_ORDER_ID,
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
    });
    await seedNotification({
      username: "alice.parker",
      shell: "admin",
      type: "New order",
      title: "New order",
      message: `A new order #${SEEDED_ORDER_ID} was placed by Bruno Silva.`,
      link: `/order-details/${SEEDED_ORDER_ID}`,
    });
    await shipExistingOrder(browser);
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
    await actingPage.goto("/notifications", { waitUntil: "domcontentloaded" });
    await otherPage.goto("/notifications", { waitUntil: "domcontentloaded" });
    await expect(actingPage.locator(".notification-bell-badge")).toHaveText(
      "2",
    );
    await expect(otherPage.locator(".notification-bell-badge")).toHaveText("2");
    await expect(markReadButton(actingPage, "New post")).toBeVisible();
    await expect(markReadButton(otherPage, "New order")).toBeVisible();
    await markReadButton(actingPage, "New post").click();
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
    await markAllButton.click();
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
