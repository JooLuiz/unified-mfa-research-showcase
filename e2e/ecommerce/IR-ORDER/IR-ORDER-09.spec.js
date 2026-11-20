const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { signIn } = require("../../support/sign-in");

// IR-ORDER-09 - A signed-in shopper sees a missing order id, and Back to account leaves that page.

const PLACED_ORDER_ID = "order-mp4ve3gd-kb6od6";

test.beforeEach(() => {
  restoreMockData();
});

async function signInAsAlice(page) {
  await signIn(page, {
    username: "alice.parker",
    tokenKey: "ecommerce-shell:auth-token",
    userKey: "ecommerce-shell:auth-user",
  });
}

test("an order path that cannot be read says no order id was provided", async ({
  page,
}) => {
  await signInAsAlice(page);
  await page.goto("/order-details/%", { waitUntil: "domcontentloaded" });
  await expect(page.locator("section.order-details-empty")).toHaveText(
    "No order id was provided.",
  );
});

test("back to account leaves the open order", async ({ page }) => {
  await signInAsAlice(page);
  await page.goto(`/order-details/${PLACED_ORDER_ID}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".order-details-status")).toHaveText("Placed");
  await page.getByRole("button", { name: "Back to account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "My Orders" })).toBeVisible();
});
