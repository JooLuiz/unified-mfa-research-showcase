const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NOTIFY-03 - A saved order-status change arrives in the open store inbox and raises a toast.

const ORDER_ID = "order-mp4ve3gd-kb6od6";
const NOTICE_TITLE = "Order status updated";
const NOTICE_MESSAGE = `Your order #${ORDER_ID} is now shipped.`;
const ADMIN_ORIGIN = "http://localhost:4600";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function shipFromAdmin(browser) {
  const adminContext = await browser.newContext({ baseURL: ADMIN_ORIGIN });
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/login", { waitUntil: "domcontentloaded" });
  await adminPage.getByLabel("Username or email").fill("alice.parker");
  await adminPage.getByLabel("Password").fill("password123");
  await adminPage.getByRole("button", { name: "Sign in" }).click();
  await expect(adminPage.getByRole("button", { name: "Log out" })).toBeVisible();
  await adminPage.goto(`/order-details/${ORDER_ID}`, {
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

test("a shipped order arrives in the open inbox and raises a toast", async ({
  page,
  browser,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page);
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
  await shipFromAdmin(browser);
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
