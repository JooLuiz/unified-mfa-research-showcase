const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ORDER-03 - The admin accepts a cancellation. The order is cancelled, stock comes back, and the admin was notified of the request.

const API_BASE_URL = "http://localhost:4000/api";
const ORDER_ID = "order-mp4ve3gd-kb6od6";
const ADMIN_TOKEN_KEY = "admin-shell:auth-token";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function expectAvailable(request, productId, available) {
  const response = await request.get(`${API_BASE_URL}/products/${productId}`);
  const product = await response.json();
  expect(product.available).toBe(available);
}

test("the admin accepts a cancellation and stock comes back", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const notificationStream = page.waitForResponse(
    (response) =>
      response.url().includes("/api/notifications/stream") &&
      response.url().includes("shell=admin") &&
      response.ok(),
  );
  const orderStream = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/orders/stream") && response.ok(),
  );
  await signInThroughTheForm(page);
  await notificationStream;
  await orderStream;
  await page.goto(`/order-details/${ORDER_ID}`, {
    waitUntil: "domcontentloaded",
  });
  const orderDetails = page.locator(".order-details-shell");
  await expect(orderDetails.locator(".order-details-status")).toHaveText(
    "Placed",
  );
  await expect(
    orderDetails.getByRole("button", { name: "Ship" }),
  ).toBeVisible();
  await expect(
    orderDetails.getByRole("button", { name: "Cancel" }),
  ).toBeVisible();
  const adminToken = await page.evaluate(
    (tokenKey) => localStorage.getItem(tokenKey),
    ADMIN_TOKEN_KEY,
  );
  const requestResponse = await page.request.put(
    `${API_BASE_URL}/orders/${ORDER_ID}/status`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "cancellation-requested", actor: "customer" },
    },
  );
  expect(requestResponse.ok()).toBeTruthy();
  const adminNotice = page
    .getByRole("status")
    .filter({ hasText: "Cancellation requested" });
  await expect(adminNotice).toBeVisible();
  await expect(adminNotice).toContainText(
    `Customer requested cancellation for order #${ORDER_ID}.`,
  );
  await expect(orderDetails.locator(".order-details-status")).toHaveText(
    "Cancellation requested",
  );
  await expectAvailable(page.request, "p-01", 2);
  await expectAvailable(page.request, "p-02", 2);
  await expectAvailable(page.request, "p-07", 12);
  const acceptRequest = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      request.url().includes(`/api/orders/${ORDER_ID}/status`),
  );
  await orderDetails.getByRole("button", { name: "Accept" }).click();
  const sentRequest = await acceptRequest;
  expect(sentRequest.postDataJSON()).toEqual({
    status: "cancelled",
    actor: "admin",
  });
  await expect(orderDetails.locator(".order-details-status")).toHaveText(
    "Cancelled",
  );
  await expectAvailable(page.request, "p-01", 3);
  await expectAvailable(page.request, "p-02", 3);
  await expectAvailable(page.request, "p-07", 13);
});
