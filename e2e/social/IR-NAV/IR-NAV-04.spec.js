const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-NAV-04 - A protected social route sends a guest to /login and keeps the destination.

test.beforeEach(() => {
  restoreMockData();
});

test("a guest opening /account is sent to login and returns there after sign-in", async ({
  page,
}) => {
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Log in to MFE Lab" }),
  ).toBeVisible();
  await page.getByLabel("Username or email").fill("bruno.silva");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "My Account" })).toBeVisible();
});
