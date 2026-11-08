const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ORDER-03 - The admin accepts a cancellation. The order is cancelled, stock comes back, and the admin was notified of the request.

const API_BASE_URL = "http://localhost:4000/api";
const STORE_ORIGIN = "http://localhost:4200";
const ORDER_ID = "order-mp4ve3gd-kb6od6";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function requestCancellation(browser) {
  const storeContext = await browser.newContext({ baseURL: STORE_ORIGIN });
  const storePage = await storeContext.newPage();
  await storePage.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(storePage);
  await storePage.goto(`/order-details/${ORDER_ID}`, {
    waitUntil: "domcontentloaded",
  });
  await storePage
    .locator(".order-details-shell")
    .getByRole("button", { name: "Request cancellation" })
    .click();
  await expect(storePage.locator(".order-details-status")).toHaveText(
    "Cancellation requested",
  );
  await storeContext.close();
}

async function expectAvailable(request, productId, available) {
  const response = await request.get(`${API_BASE_URL}/products/${productId}`);
  const product = await response.json();
  expect(product.available).toBe(available);
}

test("the admin accepts a cancellation and stock comes back", async ({
  page,
  browser,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page);
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
  await requestCancellation(browser);
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
  await orderDetails.getByRole("button", { name: "Accept" }).click();
  await expect(orderDetails.locator(".order-details-status")).toHaveText(
    "Cancelled",
  );
  await expectAvailable(page.request, "p-01", 3);
  await expectAvailable(page.request, "p-02", 3);
  await expectAvailable(page.request, "p-07", 13);
});
