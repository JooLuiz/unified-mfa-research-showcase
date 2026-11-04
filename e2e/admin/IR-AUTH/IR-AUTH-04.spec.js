const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-AUTH-04 - Logging out clears the admin session and returns to the login page.

test.beforeEach(() => {
  restoreMockData();
});

test("log out clears the session and returns to the login page", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Log in to MFE Lab" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Alice Parker" })).toHaveCount(
    0,
  );
  const storedSession = await page.evaluate(() => ({
    token: localStorage.getItem("admin-shell:auth-token"),
    user: localStorage.getItem("admin-shell:auth-user"),
  }));
  expect(storedSession.token).toBeNull();
  expect(storedSession.user).toBeNull();
});
