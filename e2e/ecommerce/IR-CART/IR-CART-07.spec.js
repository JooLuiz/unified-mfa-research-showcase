const { test, expect, chromium } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedCart } = require("../../support/seed-cart");

// IR-CART-07 - Cart changes sync across tabs and browsers. An order empties that cart.
// Logout clears the open screens. Items added before login join the saved cart.
// Each extra signed-in store page runs in its own Chromium process so Chrome's
// 6-connection cap to the mock API is not exhausted (a signed-in tab already holds 5 SSE slots).

const API_BASE_URL = "http://localhost:4000/api";
const STORE_ORIGIN = "http://localhost:4200";
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
  await page.goto(`${STORE_ORIGIN}/`, { waitUntil: "domcontentloaded" });
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
  test.setTimeout(180_000);
  const bruno = await loginAs(page, "bruno.silva");
  await seedCart("bruno.silva", [{ productId: "p-03", quantity: 1 }]);
  await installSession(context, bruno);
  const otherBrowser = await chromium.launch({ headless: false });
  try {
    const otherContext = await otherBrowser.newContext();
    await installSession(otherContext, bruno);
    const otherTab = await otherContext.newPage();
    await openSignedInHome(otherTab);
    await openSignedInHome(page);
    await expectCart(otherTab, "1", "Total: $120.50");
    await raiseKeyboardQuantity(page);
    await expectCart(otherTab, "2", "Total: $241.00");
  } finally {
    await otherBrowser.close();
  }
});

test("a checkout change shows in another browser", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const bruno = await loginAs(page, "bruno.silva");
  await seedCart("bruno.silva", [{ productId: "p-03", quantity: 1 }]);
  await installSession(context, bruno);
  const otherBrowser = await chromium.launch({ headless: false });
  try {
    const otherContext = await otherBrowser.newContext();
    await installSession(otherContext, bruno);
    const otherBrowserPage = await otherContext.newPage();
    await openSignedInHome(otherBrowserPage);
    await openSignedInHome(page);
    await expectCart(otherBrowserPage, "1", "Total: $120.50");
    await raiseKeyboardQuantity(page);
    await expectCart(otherBrowserPage, "2", "Total: $241.00");
  } finally {
    await otherBrowser.close();
  }
});

test("placing an order empties the cart on the other screens", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const bruno = await loginAs(page, "bruno.silva");
  await seedCart("bruno.silva", [{ productId: "p-03", quantity: 1 }]);
  await installSession(context, bruno);
  const tabBrowser = await chromium.launch({ headless: false });
  const otherBrowser = await chromium.launch({ headless: false });
  try {
    const tabContext = await tabBrowser.newContext();
    await installSession(tabContext, bruno);
    const otherTab = await tabContext.newPage();
    const otherContext = await otherBrowser.newContext();
    await installSession(otherContext, bruno);
    const otherBrowserPage = await otherContext.newPage();
    await openSignedInHome(otherTab);
    await openSignedInHome(otherBrowserPage);
    await openSignedInHome(page);
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Place Order" }).click();
    await expect(
      page.getByRole("heading", { name: "Order Placed!" }),
    ).toBeVisible();
    await expectCart(page, "0", "Total: $0.00");
    await expectCart(otherTab, "0", "Total: $0.00");
    await expectCart(otherBrowserPage, "0", "Total: $0.00");
  } finally {
    await tabBrowser.close();
    await otherBrowser.close();
  }
});

test("logging out clears the other open tab", async ({ page, context }) => {
  test.setTimeout(180_000);
  const bruno = await loginAs(page, "bruno.silva");
  await seedCart("bruno.silva", [{ productId: "p-03", quantity: 1 }]);
  await installSession(context, bruno);
  // Logout reaches the other tab through a localStorage event, so both tabs share
  // this browser. A signed-in tab holds 5 SSE connections and Chrome allows 6 to the
  // mock API, so the second tab never finishes loading. The streams are not what
  // carries logout, so this test replaces EventSource with a silent stub.
  await context.addInitScript(() => {
    class SilentEventSource {
      constructor() {}
      close() {}
      addEventListener() {}
      removeEventListener() {}
    }
    window.EventSource = SilentEventSource;
  });
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

test("items added before login join the saved cart", async ({ page }) => {
  test.setTimeout(180_000);
  const bruno = await loginAs(page, "bruno.silva");
  await seedCart("bruno.silva", [{ productId: "p-04", quantity: 1 }]);
  const otherBrowser = await chromium.launch({ headless: false });
  try {
    const otherContext = await otherBrowser.newContext();
    await installSession(otherContext, bruno);
    const otherBrowserPage = await otherContext.newPage();
    await openSignedInHome(otherBrowserPage);
    await expectCart(otherBrowserPage, "1", "Total: $55.00");
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
    await expectCart(otherBrowserPage, "2", "Total: $175.50");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectCart(page, "2", "Total: $175.50");
  } finally {
    await otherBrowser.close();
  }
});
