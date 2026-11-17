const { test, expect } = require("../../fixtures");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-ACCOUNT-02 - A profile save the server rejects keeps the previous name.

const USERNAME = "carla.nguyen";
const ORIGINAL_NAME = "Carla Nguyen";
const REJECTED_NAME = "Carla Nguyen Alves";

test.beforeEach(() => {
  restoreMockData();
});

function headerAccountButton(page, name) {
  return page
    .locator("#headerMount")
    .getByRole("button", { name, exact: true });
}

async function signInThroughTheForm(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill(USERNAME);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function rejectProfileSave(page) {
  await page.route("**/api/users/me", async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: "{}",
    });
  });
}

test("a rejected profile save keeps the previous name", async ({ page }) => {
  await signInThroughTheForm(page);
  await headerAccountButton(page, ORIGINAL_NAME).click();
  await expect(page.getByRole("heading", { name: "My Account" })).toBeVisible();
  await rejectProfileSave(page);
  await page.getByLabel("Full name").fill(REJECTED_NAME);
  await page.getByRole("button", { name: "Save profile" }).click();
  const toast = page
    .locator(".notification-toast")
    .filter({ hasText: "Account update failed" });
  await expect(toast).toBeVisible();
  await expect(
    toast.getByText("Your changes were not saved. Please try again."),
  ).toBeVisible();
  await expect(headerAccountButton(page, ORIGINAL_NAME)).toBeVisible();
  await expect(headerAccountButton(page, REJECTED_NAME)).toHaveCount(0);
});
