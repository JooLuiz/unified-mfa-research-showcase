const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { setStoredOrderStatus } = require("../../support/seed-empty-state");

// IR-ORDER-07 - A status change that never reaches the server shows the same failure state.

const ORDER_ID = "order-mp4ve3gd-kb6od6";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function dropStatusChange(page) {
  await page.route("**/api/orders/*/status", async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }
    await route.abort();
  });
}

test("a ship action that never reaches the server leaves the order placed", async ({
  page,
}) => {
  await signInThroughTheForm(page);
  await page.goto(`/order-details/${ORDER_ID}`, {
    waitUntil: "domcontentloaded",
  });
  const orderDetails = page.locator(".order-details-shell");
  await expect(orderDetails.locator(".order-details-status")).toHaveText(
    "Placed",
  );
  await setStoredOrderStatus(ORDER_ID, "delivered");
  await dropStatusChange(page);
  await orderDetails.getByRole("button", { name: "Ship" }).click();
  const toast = page
    .locator(".notification-toast")
    .filter({ hasText: "Status change rejected" });
  await expect(toast).toBeVisible();
  await expect(
    toast.getByText("That status change is not allowed."),
  ).toBeVisible();
  await expect(orderDetails.locator(".order-details-status")).toHaveText(
    "Placed",
  );
});
