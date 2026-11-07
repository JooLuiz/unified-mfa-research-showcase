const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ORDER-01 - The store account lists the orders of the signed-in person.

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page, username) {
  await page.getByLabel("Username or email").fill(username);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function expectOrderRow(page, orderId, status, total) {
  const orderRow = page.locator("button.my-orders-row").filter({
    hasText: orderId,
  });
  await expect(orderRow).toBeVisible();
  await expect(orderRow).toContainText("3 items");
  await expect(orderRow).toContainText(status);
  await expect(orderRow).toContainText(total);
}

test("the store account lists the signed-in person's orders", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page, "alice.parker");
  const aliceOrders = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      /\/api\/orders(\?|$)/.test(response.url()) &&
      response.ok(),
  );
  await page.getByRole("button", { name: "Alice Parker" }).click();
  const alicePayload = await (await aliceOrders).json();
  expect(alicePayload.total).toBe(3);
  expect(alicePayload.items.map((order) => order.userId)).toEqual([
    "u-01",
    "u-01",
    "u-01",
  ]);
  await expect(page.getByRole("heading", { name: "My Orders" })).toBeVisible();
  await expect(page.getByText("3 orders placed.")).toBeVisible();
  await expect(page.locator("button.my-orders-row")).toHaveCount(3);
  await expectOrderRow(page, "order-mpq0wylv-j2mdx0", "Shipped", "$860.49");
  await expectOrderRow(page, "order-mp4ve3gd-kb6od6", "Placed", "$706.49");
  await expectOrderRow(page, "order-mp20d2w4-s59o9n", "Delivered", "$455.49");
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("button", { name: "Log in" }).click();
  await signInThroughTheForm(page, "bruno.silva");
  const brunoOrders = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      /\/api\/orders(\?|$)/.test(response.url()) &&
      response.ok(),
  );
  await page.getByRole("button", { name: "Bruno Silva" }).click();
  const brunoPayload = await (await brunoOrders).json();
  expect(brunoPayload.total).toBe(0);
  await expect(
    page.getByText("You have not placed any orders yet."),
  ).toBeVisible();
  await expect(page.locator("button.my-orders-row")).toHaveCount(0);
});
