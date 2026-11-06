const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ORDER-02 - /order-details/{orderId} shows the order, using the store token to load it.

const ORDER_ID = "order-mpq0wylv-j2mdx0";
const STORE_TOKEN_KEY = "ecommerce-shell:auth-token";
test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

test("the order route shows the order with the store token", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page);
  const orderRequest = page.waitForRequest(
    (request) =>
      request.method() === "GET" &&
      request.url().includes(`/api/orders/${ORDER_ID}`),
  );
  await page.goto(`/order-details/${ORDER_ID}`, {
    waitUntil: "domcontentloaded",
  });
  const sentRequest = await orderRequest;
  const storeToken = await page.evaluate(
    (tokenKey) => localStorage.getItem(tokenKey),
    STORE_TOKEN_KEY,
  );
  expect(storeToken).toBeTruthy();
  expect(sentRequest.headers().authorization).toBe(`Bearer ${storeToken}`);
  await expect(page).toHaveURL(new RegExp(`/order-details/${ORDER_ID}$`));
  await expect(
    page.getByRole("heading", { name: "Order Details" }),
  ).toBeVisible();
  const orderDetails = page.locator(".order-details-shell");
  await expect(
    orderDetails.getByRole("heading", { name: `Order ${ORDER_ID}` }),
  ).toBeVisible();
  await expect(orderDetails.getByText("Shipped")).toBeVisible();
  await expect(
    orderDetails.getByRole("cell", { name: "Ergonomic Office Chair" }),
  ).toBeVisible();
  await expect(
    orderDetails.getByRole("cell", { name: "Mechanical Wireless Keyboard" }),
  ).toBeVisible();
  await expect(
    orderDetails.getByRole("cell", { name: "4K Ultra-Wide Monitor" }),
  ).toBeVisible();
  await expect(orderDetails.locator(".is-total")).toContainText("$860.49");
  await expect(orderDetails.getByText("123 Maple Street")).toBeVisible();
});

test("a guest does not load the order", async ({ page }) => {
  const orderFetches = [];
  page.on("request", (request) => {
    if (
      request.method() === "GET" &&
      request.url().includes(`/api/orders/${ORDER_ID}`)
    ) {
      orderFetches.push(request.url());
    }
  });
  await page.goto(`/order-details/${ORDER_ID}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", { name: "Log in to MFE Lab" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  expect(orderFetches).toEqual([]);
});
