const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NOTIFY-04 - Marking one store notice, then the rest, updates the other store tab.

const API_BASE_URL = "http://localhost:4000/api";
const TOKEN_KEY = "ecommerce-shell:auth-token";
const USER_KEY = "ecommerce-shell:auth-user";
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

function isStoreInboxStream(response) {
  return (
    response.request().method() === "GET" &&
    /\/api\/notifications\/stream\?shell=ecommerce(&|$)/.test(response.url()) &&
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

test("both store tabs follow mark-one and mark-all", async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const seedToken = await login(context.request, "alice.parker");
    const orderResponse = await context.request.post(`${API_BASE_URL}/orders`, {
      headers: { Authorization: `Bearer ${seedToken}` },
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
    const statusResponse = await context.request.put(
      `${API_BASE_URL}/orders/${SHIPPED_ORDER_ID}/status`,
      {
        headers: { Authorization: `Bearer ${seedToken}` },
        data: { status: "shipped", actor: "admin" },
      },
    );
    expect(statusResponse.ok()).toBeTruthy();
    const token = await signIn(context);
    const actingPage = await context.newPage();
    const otherPage = await context.newPage();
    const followedTabWrites = [];
    otherPage.on("request", (request) => {
      if (
        request.method() === "PUT" &&
        request.url().includes("/api/notifications")
      ) {
        followedTabWrites.push(request.url());
      }
    });
    const actingStream = actingPage.waitForResponse(isStoreInboxStream);
    const otherStream = otherPage.waitForResponse(isStoreInboxStream);
    await actingPage.goto("/notifications", { waitUntil: "domcontentloaded" });
    await otherPage.goto("/notifications", { waitUntil: "domcontentloaded" });
    await actingStream;
    await otherStream;
    await expect(actingPage.locator(".notification-bell-badge")).toHaveText(
      "2",
    );
    await expect(otherPage.locator(".notification-bell-badge")).toHaveText("2");
    await expect(markReadButton(actingPage, "Order placed")).toBeVisible();
    await expect(
      markReadButton(otherPage, "Order status updated"),
    ).toBeVisible();
    const readResponse = actingPage.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        /\/api\/notifications\/[^/]+\/read$/.test(response.url()) &&
        response.ok(),
    );
    await markReadButton(actingPage, "Order placed").click();
    const updatedNotice = await (await readResponse).json();
    expect(updatedNotice.title).toBe("Order placed");
    expect(updatedNotice.read).toBe(true);
    await expect(markReadButton(actingPage, "Order placed")).toHaveCount(0);
    await expect(
      markReadButton(actingPage, "Order status updated"),
    ).toBeVisible();
    await expect(actingPage.locator(".notification-bell-badge")).toHaveText(
      "1",
    );
    await expect(markReadButton(otherPage, "Order placed")).toHaveCount(0);
    await expect(
      markReadButton(otherPage, "Order status updated"),
    ).toBeVisible();
    await expect(otherPage.locator(".notification-bell-badge")).toHaveText("1");
    const markAllButton = actingPage.getByRole("button", {
      name: "Mark all as read",
      exact: true,
    });
    await expect(markAllButton).toBeEnabled();
    const readAllResponse = actingPage.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        /\/api\/notifications\/read-all\?shell=ecommerce$/.test(
          response.url(),
        ) &&
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
    const adminInboxResponse = await context.request.get(
      `${API_BASE_URL}/notifications?shell=admin`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const adminInbox = await adminInboxResponse.json();
    expect(adminInbox.items.map((item) => item.title)).toEqual(["New order"]);
    expect(adminInbox.items[0].read).toBe(false);
  } finally {
    await context.close();
  }
});
