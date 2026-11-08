const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedCart } = require("../../support/seed-cart");

// IR-NOTIFY-03 - A new order arrives in the open admin inbox and raises a toast.

const API_BASE_URL = "http://localhost:4000/api";
const STORE_ORIGIN = "http://localhost:4200";
const NOTICE_TITLE = "New order";

test.beforeEach(() => {
  restoreMockData();
});

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function placeBrunoOrder(browser) {
  const storeContext = await browser.newContext({ baseURL: STORE_ORIGIN });
  const login = await storeContext.request.post(`${API_BASE_URL}/auth/login`, {
    data: { username: "bruno.silva", password: "password123" },
  });
  const bruno = await login.json();
  await seedCart("bruno.silva", [{ productId: "p-04", quantity: 1 }]);
  await storeContext.addInitScript(
    ([token, user]) => {
      localStorage.setItem("ecommerce-shell:auth-token", token);
      localStorage.setItem("ecommerce-shell:auth-user", JSON.stringify(user));
    },
    [bruno.token, bruno.user],
  );
  const storePage = await storeContext.newPage();
  await storePage.goto("/checkout", { waitUntil: "domcontentloaded" });
  await storePage.getByRole("button", { name: "Place Order" }).click();
  await expect(
    storePage.getByRole("heading", { name: "Order Placed!" }),
  ).toBeVisible();
  await storeContext.close();
}

test("a new order arrives in the open inbox and raises a toast", async ({
  page,
  browser,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await signInThroughTheForm(page);
  const bell = page.getByRole("button", { name: "Notifications" });
  await expect(bell).toBeVisible();
  await expect(page.locator(".notification-bell-badge")).toHaveCount(0);
  await bell.click();
  await page
    .locator(".notification-dropdown")
    .getByRole("button", { name: "See all" })
    .click();
  await expect(page).toHaveURL(/\/notifications$/);
  const inbox = page.locator(".notifications-page-container");
  await expect(
    inbox.getByText("No notifications in your inbox."),
  ).toBeVisible();
  await placeBrunoOrder(browser);
  const toast = page
    .locator(".notification-toast")
    .filter({ hasText: NOTICE_TITLE });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveAttribute("role", "status");
  await expect(toast).toContainText("A new order #");
  await expect(toast).toContainText("was placed by Bruno Silva.");
  await expect(inbox.getByText(NOTICE_TITLE, { exact: true })).toBeVisible();
  await expect(inbox).toContainText("was placed by Bruno Silva.");
  await expect(inbox.getByText("No notifications in your inbox.")).toHaveCount(
    0,
  );
  await expect(page.locator(".notification-bell-badge")).toHaveText("1");
  await expect(page).toHaveURL(/\/notifications$/);
});
