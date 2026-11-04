const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-AUTH-04 - Logging out clears the ecommerce session and returns to the store home.

test.beforeEach(() => {
  restoreMockData();
});

test("log out clears the session and returns to the store home", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("bruno.silva");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('iframe[title="FAQ Formulary"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bruno Silva" })).toHaveCount(
    0,
  );
  const storedSession = await page.evaluate(() => ({
    token: localStorage.getItem("ecommerce-shell:auth-token"),
    user: localStorage.getItem("ecommerce-shell:auth-user"),
  }));
  expect(storedSession.token).toBeNull();
  expect(storedSession.user).toBeNull();
});
