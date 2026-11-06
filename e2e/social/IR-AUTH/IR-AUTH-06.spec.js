const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-AUTH-06 - A social destination stays pending through a failed sign-in, then opens after login succeeds.

test.beforeEach(() => {
  restoreMockData();
});

async function failThenSignIn(page) {
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Log in to MFE Lab" }),
  ).toBeVisible();
  await page.getByLabel("Username or email").fill("bruno.silva");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Invalid credentials")).toBeVisible();
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

test("a guest opening /account returns there after login finishes", async ({
  page,
}) => {
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await failThenSignIn(page);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "My Account" })).toBeVisible();
});

test("a guest who chooses to create a post returns to /posts after login finishes", async ({
  page,
}) => {
  await page.goto("/posts", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Community Posts" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log in to create a post" }).click();
  await failThenSignIn(page);
  await expect(page).toHaveURL(/\/posts$/);
  await expect(
    page.getByRole("heading", { name: "Community Posts" }),
  ).toBeVisible();
  await expect(page.locator('iframe[title="Create new post"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Log in to create a post" }),
  ).toHaveCount(0);
});
