const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedOrder } = require("../../support/seed-order");

// IR-NOTIFY-05 - Clicking a toast that has a saved notice and a link opens that page and marks the inbox row read.

const STORE_ORIGIN = "http://localhost:4200";
const ORDER_ID = "order-e2e-cancel";
const NOTICE_TITLE = "Cancellation requested";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page, username) {
  await page.getByLabel("Username or email").fill(username);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function requestBrunoCancellation(browser) {
  const storeContext = await browser.newContext({ baseURL: STORE_ORIGIN });
  const storePage = await storeContext.newPage();
  await storePage.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(storePage, "bruno.silva");
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

test("clicking the cancellation toast opens the order and marks the notice read", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  await seedOrder("bruno.silva", {
    id: ORDER_ID,
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
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page, "alice.parker");
  const bell = page.getByRole("button", { name: "Notifications" });
  await bell.click();
  await page
    .locator(".notification-dropdown")
    .getByRole("button", { name: "See all" })
    .click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(
    page.getByText("No notifications in your inbox."),
  ).toBeVisible();
  await requestBrunoCancellation(browser);
  const toast = page
    .locator(".notification-toast")
    .filter({ hasText: NOTICE_TITLE });
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(`order #${ORDER_ID}`);
  await toast.click();
  await expect(page).toHaveURL(new RegExp(`/order-details/${ORDER_ID}$`));
  await expect(page.locator(".notification-bell-badge")).toHaveCount(0);
  await bell.click();
  await page
    .locator(".notification-dropdown")
    .getByRole("button", { name: "See all" })
    .click();
  await expect(page).toHaveURL(/\/notifications$/);
  const noticeRow = page
    .locator(".notification-item")
    .filter({ hasText: NOTICE_TITLE });
  await expect(noticeRow).toBeVisible();
  await expect(
    noticeRow.getByRole("button", { name: "Mark as read", exact: true }),
  ).toHaveCount(0);
});
