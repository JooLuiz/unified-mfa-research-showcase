const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-CART-07 - Cart changes sync across tabs and browsers. An order empties that cart.
// Logout clears the open screens. Items added before login join the saved cart.

const API_BASE_URL = "http://localhost:4000/api";
const KEYBOARD = "Mechanical Wireless Keyboard";

test.beforeEach(() => {
  restoreMockData();
});

async function loginAs(page, username) {
  const loginResponse = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username, password: "password123" },
  });
  return loginResponse.json();
}

async function saveCart(page, token, items) {
  const saveResponse = await page.request.put(`${API_BASE_URL}/cart`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { items, appliedCoupon: null },
  });
  expect(saveResponse.ok()).toBeTruthy();
}

async function installSession(context, session) {
  await context.addInitScript(
    ([token, user]) => {
      localStorage.setItem("ecommerce-shell:auth-token", token);
      localStorage.setItem("ecommerce-shell:auth-user", JSON.stringify(user));
    },
    [session.token, session.user],
  );
}

async function openSignedInHome(page) {
  const cartStream = page.waitForResponse(
    (response) => response.url().includes("/api/cart/events") && response.ok(),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await cartStream;
  await expect(page.getByRole("button", { name: "Bruno Silva" })).toBeVisible();
}

async function expectCart(page, count, totalLabel) {
  await expect(page.locator(".cart-item-count")).toHaveText(count);
  await expect(page.getByRole("button", { name: totalLabel })).toBeVisible();
}

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill("bruno.silva");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Bruno Silva" })).toBeVisible();
}

async function raiseKeyboardQuantity(page) {
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
  const line = page.locator("article.checkout-item", { hasText: KEYBOARD });
  await line.getByRole("button", { name: "+", exact: true }).click();
  await expectCart(page, "2", "Total: $241.00");
}

test("a checkout change shows on another tab", async ({ page, context }) => {
  const bruno = await loginAs(page, "bruno.silva");
  await saveCart(page, bruno.token, [{ productId: "p-03", quantity: 1 }]);
  await installSession(context, bruno);
  const otherTab = await context.newPage();
  await openSignedInHome(otherTab);
  await openSignedInHome(page);
  await expectCart(otherTab, "1", "Total: $120.50");
  await raiseKeyboardQuantity(page);
  await expectCart(otherTab, "2", "Total: $241.00");
});

test("a checkout change shows in another browser", async ({
  page,
  context,
  browser,
}) => {
  const bruno = await loginAs(page, "bruno.silva");
  await saveCart(page, bruno.token, [{ productId: "p-03", quantity: 1 }]);
  await installSession(context, bruno);
  const otherContext = await browser.newContext();
  try {
    await installSession(otherContext, bruno);
    const otherBrowser = await otherContext.newPage();
    await openSignedInHome(otherBrowser);
    await openSignedInHome(page);
    await expectCart(otherBrowser, "1", "Total: $120.50");
    await raiseKeyboardQuantity(page);
    await expectCart(otherBrowser, "2", "Total: $241.00");
  } finally {
    await otherContext.close();
  }
});

test("placing an order empties the cart on the other screens", async ({
  page,
  context,
  browser,
}) => {
  const bruno = await loginAs(page, "bruno.silva");
  await saveCart(page, bruno.token, [{ productId: "p-03", quantity: 1 }]);
  await installSession(context, bruno);
  const otherTab = await context.newPage();
  const otherContext = await browser.newContext();
  try {
    await installSession(otherContext, bruno);
    const otherBrowser = await otherContext.newPage();
    await openSignedInHome(otherTab);
    await openSignedInHome(otherBrowser);
    await openSignedInHome(page);
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Place Order" }).click();
    await expect(
      page.getByRole("heading", { name: "Order Placed!" }),
    ).toBeVisible();
    await expectCart(page, "0", "Total: $0.00");
    await expectCart(otherTab, "0", "Total: $0.00");
    await expectCart(otherBrowser, "0", "Total: $0.00");
  } finally {
    await otherContext.close();
  }
});

test("logging out clears the other open tab", async ({ page, context }) => {
  const bruno = await loginAs(page, "bruno.silva");
  await saveCart(page, bruno.token, [{ productId: "p-03", quantity: 1 }]);
  await installSession(context, bruno);
  const otherTab = await context.newPage();
  await openSignedInHome(otherTab);
  await openSignedInHome(page);
  await expectCart(page, "1", "Total: $120.50");
  await expectCart(otherTab, "1", "Total: $120.50");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await expectCart(page, "0", "Total: $0.00");
  await expect(otherTab.getByRole("button", { name: "Log in" })).toBeVisible();
  await expectCart(otherTab, "0", "Total: $0.00");
  await page.getByRole("button", { name: "Log in" }).click();
  await signInThroughTheForm(page);
  await expectCart(page, "1", "Total: $120.50");
});

test("items added before login join the saved cart", async ({
  page,
  browser,
}) => {
  const bruno = await loginAs(page, "bruno.silva");
  await saveCart(page, bruno.token, [{ productId: "p-04", quantity: 1 }]);
  const otherContext = await browser.newContext();
  try {
    await installSession(otherContext, bruno);
    const otherBrowser = await otherContext.newPage();
    await openSignedInHome(otherBrowser);
    await expectCart(otherBrowser, "1", "Total: $55.00");
    await page.goto("/product?productId=p-03", {
      waitUntil: "domcontentloaded",
    });
    await page
      .locator(".pdp-shell")
      .getByRole("button", { name: "Add to Cart" })
      .click();
    await expectCart(page, "1", "Total: $120.50");
    await page.getByRole("button", { name: "Log in" }).click();
    await signInThroughTheForm(page);
    await expectCart(page, "2", "Total: $175.50");
    await expectCart(otherBrowser, "2", "Total: $175.50");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectCart(page, "2", "Total: $175.50");
  } finally {
    await otherContext.close();
  }
});
