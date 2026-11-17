const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedCart } = require("../../support/seed-cart");
const { seedEmptyOrders } = require("../../support/seed-empty-state");

// IR-ADMIN-06 - The first order placed while the table is empty becomes the first row.

const API_BASE_URL = "http://localhost:4000/api";
const STORE_ORIGIN = "http://localhost:4200";

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

async function placeBrunoOrder(browser) {
  const storeContext = await browser.newContext({ baseURL: STORE_ORIGIN });
  try {
    const login = await storeContext.request.post(`${API_BASE_URL}/auth/login`, {
      data: { username: "bruno.silva", password: "password123" },
    });
    const bruno = await login.json();
    await seedCart("bruno.silva", [{ productId: "p-04", quantity: 1 }]);
    await storeContext.addInitScript(
      ([token, user]) => {
        localStorage.setItem("ecommerce-shell:auth-token", token);
        localStorage.setItem(
          "ecommerce-shell:auth-user",
          JSON.stringify(user),
        );
      },
      [bruno.token, bruno.user],
    );
    const storePage = await storeContext.newPage();
    await storePage.goto("/checkout", { waitUntil: "domcontentloaded" });
    await storePage.getByRole("button", { name: "Place Order" }).click();
    await expect(
      storePage.getByRole("heading", { name: "Order Placed!" }),
    ).toBeVisible();
  } finally {
    await storeContext.close();
  }
}

test("the first order placed into an empty table becomes the first row", async ({
  page,
  browser,
}) => {
  await seedEmptyOrders();
  await signInThroughTheForm(page);
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await expect(page.locator("p.admin-empty")).toHaveText("No orders found.");
  await placeBrunoOrder(browser);
  const orderRow = page.locator("tr.admin-order-row");
  await expect(orderRow).toHaveCount(1);
  await expect(orderRow).toContainText("Bruno Silva");
  await expect(orderRow).toContainText("Placed");
});
