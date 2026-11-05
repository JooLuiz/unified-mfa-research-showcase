const { test, expect, chromium } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NOTIFY-04 - Marking one social notice, then the rest, updates the other social tab.
// The follower tab runs in its own Chromium process. A signed-in tab already holds
// several SSE connections, and Chrome allows 6 to the mock API, so a second tab in
// the same browser never opens the notification stream.

const API_BASE_URL = "http://localhost:4000/api";
const SOCIAL_ORIGIN = "http://localhost:4500";
const TOKEN_KEY = "social-media-shell:auth-token";
const USER_KEY = "social-media-shell:auth-user";

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
    data: { username: "carla.nguyen", password: "password123" },
  });
  const session = await response.json();
  await installSession(context, session);
  return session;
}

function isSocialInboxStream(response) {
  return (
    response.request().method() === "GET" &&
    /\/api\/notifications\/stream\?shell=social(&|$)/.test(response.url()) &&
    response.ok()
  );
}

function markReadButtons(targetPage) {
  return targetPage
    .locator(".notifications-page-container")
    .getByRole("button", { name: "Mark as read", exact: true });
}

test("both social tabs follow mark-one and mark-all", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ baseURL: SOCIAL_ORIGIN });
  const otherBrowser = await chromium.launch({ headless: false });
  try {
    const brunoToken = await login(context.request, "bruno.silva");
    for (const postId of ["post-03", "post-06"]) {
      const likeResponse = await context.request.post(
        `${API_BASE_URL}/posts/${postId}/like`,
        { headers: { Authorization: `Bearer ${brunoToken}` } },
      );
      expect(likeResponse.ok()).toBeTruthy();
    }
    const carlaToken = await login(context.request, "carla.nguyen");
    const orderResponse = await context.request.post(`${API_BASE_URL}/orders`, {
      headers: { Authorization: `Bearer ${carlaToken}` },
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
    const otherContext = await otherBrowser.newContext({ baseURL: SOCIAL_ORIGIN });
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
    const actingStream = actingPage.waitForResponse(isSocialInboxStream);
    const otherStream = otherPage.waitForResponse(isSocialInboxStream);
    await actingPage.goto("/notifications", { waitUntil: "domcontentloaded" });
    await otherPage.goto("/notifications", { waitUntil: "domcontentloaded" });
    await actingStream;
    await otherStream;
    const actingInbox = actingPage.locator(".notifications-page-container");
    const otherInbox = otherPage.locator(".notifications-page-container");
    await expect(actingPage.locator(".notification-bell-badge")).toHaveText(
      "2",
    );
    await expect(otherPage.locator(".notification-bell-badge")).toHaveText("2");
    await expect(actingInbox.getByText("Post liked")).toHaveCount(2);
    await expect(
      otherInbox.getByText("Bruno Silva liked your post."),
    ).toHaveCount(2);
    await expect(markReadButtons(actingPage)).toHaveCount(2);
    const readResponse = actingPage.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        /\/api\/notifications\/[^/]+\/read$/.test(response.url()) &&
        response.ok(),
    );
    await markReadButtons(actingPage).first().click();
    const updatedNotice = await (await readResponse).json();
    expect(updatedNotice.read).toBe(true);
    await expect(markReadButtons(actingPage)).toHaveCount(1);
    await expect(actingPage.locator(".notification-bell-badge")).toHaveText(
      "1",
    );
    await expect(markReadButtons(otherPage)).toHaveCount(1);
    await expect(otherPage.locator(".notification-bell-badge")).toHaveText("1");
    await expect(actingInbox.getByText("Post liked")).toHaveCount(2);
    const markAllButton = actingPage.getByRole("button", {
      name: "Mark all as read",
      exact: true,
    });
    await expect(markAllButton).toBeEnabled();
    const readAllResponse = actingPage.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        /\/api\/notifications\/read-all\?shell=social$/.test(response.url()) &&
        response.ok(),
    );
    await markAllButton.click();
    const readAllPayload = await (await readAllResponse).json();
    expect(readAllPayload.items.every((item) => item.read)).toBe(true);
    await expect(actingPage.locator(".notification-bell-badge")).toHaveCount(0);
    await expect(otherPage.locator(".notification-bell-badge")).toHaveCount(0);
    await expect(markReadButtons(actingPage)).toHaveCount(0);
    await expect(markReadButtons(otherPage)).toHaveCount(0);
    await expect(markAllButton).toBeDisabled();
    await expect(
      otherPage.getByRole("button", { name: "Mark all as read", exact: true }),
    ).toBeDisabled();
    await expect(actingInbox.getByText("Post liked")).toHaveCount(2);
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
      "Order placed",
    ]);
    expect(storeInbox.items[0].read).toBe(false);
  } finally {
    await otherBrowser.close();
    await context.close();
  }
});
