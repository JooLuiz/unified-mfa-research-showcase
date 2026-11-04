const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ORDER-03 - The customer asks to cancel a placed order.

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

test("the customer requests cancellation", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page);
  await page.goto(`/order-details/${ORDER_ID}`, {
    waitUntil: "domcontentloaded",
  });
  const orderDetails = page.locator(".order-details-shell");
  await expect(orderDetails.locator(".order-details-status")).toHaveText(
    "Placed",
  );
  const statusRequest = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      request.url().includes(`/api/orders/${ORDER_ID}/status`),
  );
  await orderDetails
    .getByRole("button", { name: "Request cancellation" })
    .click();
  const sentRequest = await statusRequest;
  expect(sentRequest.postDataJSON()).toEqual({
    status: "cancellation-requested",
    actor: "customer",
  });
  await expect(orderDetails.locator(".order-details-status")).toHaveText(
    "Cancellation requested",
  );
  await expect(
    orderDetails.getByRole("button", { name: "Request cancellation" }),
  ).toHaveCount(0);
});
