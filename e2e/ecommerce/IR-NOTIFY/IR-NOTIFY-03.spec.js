const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NOTIFY-03 - A saved order-status change arrives in the open store inbox and raises a toast.

const API_BASE_URL = "http://localhost:4000/api";
const TOKEN_KEY = "ecommerce-shell:auth-token";
const ORDER_ID = "order-mp4ve3gd-kb6od6";
const NOTICE_TITLE = "Order status updated";
const NOTICE_MESSAGE = `Your order #${ORDER_ID} is now shipped.`;

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

test("a shipped order arrives in the open inbox and raises a toast", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const streamResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      /\/api\/notifications\/stream\?shell=ecommerce(&|$)/.test(
        response.url(),
      ) &&
      response.ok(),
  );
  await signInThroughTheForm(page);
  await streamResponse;
  const bell = page.getByRole("button", { name: "Notifications" });
  await expect(bell).toBeVisible();
  await expect(page.locator(".notification-bell-badge")).toHaveCount(0);
  await bell.click();
  await page
    .locator(".notification-dropdown")
    .getByRole("button", { name: "See all" })
    .click();
  await expect(page).toHaveURL(/\/notifications$/);
  const inbox = page.locator(".notifications-page-container");
  await expect(
    inbox.getByText("No notifications in your inbox."),
  ).toBeVisible();
  const token = await page.evaluate(
    (storageKey) => window.localStorage.getItem(storageKey),
    TOKEN_KEY,
  );
  const statusResponse = await page.request.put(
    `${API_BASE_URL}/orders/${ORDER_ID}/status`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: "shipped", actor: "admin" },
    },
  );
  expect(statusResponse.ok()).toBeTruthy();
  const toast = page
    .locator(".notification-toast")
    .filter({ hasText: NOTICE_TITLE });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveAttribute("role", "status");
  await expect(toast.getByText(NOTICE_MESSAGE)).toBeVisible();
  await expect(inbox.getByText(NOTICE_TITLE)).toBeVisible();
  await expect(inbox.getByText(NOTICE_MESSAGE)).toBeVisible();
  await expect(inbox.getByText("No notifications in your inbox.")).toHaveCount(
    0,
  );
  await expect(page.locator(".notification-bell-badge")).toHaveText("1");
  await expect(page).toHaveURL(/\/notifications$/);
});
