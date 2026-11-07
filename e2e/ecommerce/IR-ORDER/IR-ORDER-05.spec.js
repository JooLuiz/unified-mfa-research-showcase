const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ORDER-05 - A signed-in shopper cannot see another person's order. A guest is sent to login.

const ORDER_ID = "order-mp20d2w4-s59o9n";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("bruno.silva");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

test("a signed-in shopper cannot see another person's order", async ({
  page,
}) => {
  await signInThroughTheForm(page);
  const orderResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes(`/api/orders/${ORDER_ID}`),
  );
  await page.goto(`/order-details/${ORDER_ID}`, {
    waitUntil: "domcontentloaded",
  });
  expect((await orderResponse).status()).toBe(403);
  await expect(page).toHaveURL(new RegExp(`/order-details/${ORDER_ID}$`));
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await expect(
    page.getByText("This order belongs to another account."),
  ).toBeVisible();
  await expect(page.locator(".order-details-shell")).toHaveCount(0);
});

test("a guest opening another person's order is sent to login", async ({
  page,
}) => {
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
