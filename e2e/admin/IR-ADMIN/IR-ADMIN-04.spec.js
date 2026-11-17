const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");
const { seedEmptyOrders } = require("../../support/seed-empty-state");

// IR-ADMIN-04 - An admin with no orders sees "No orders found."

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

test("an admin with no orders sees the empty orders message", async ({
  page,
}) => {
  await seedEmptyOrders();
  await signInThroughTheForm(page);
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "All Orders" })).toBeVisible();
  await expect(page.locator("p.admin-empty")).toHaveText("No orders found.");
  await expect(page.locator("tr.admin-order-row")).toHaveCount(0);
});
