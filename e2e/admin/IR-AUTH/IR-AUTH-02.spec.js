const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-AUTH-02 - Reloading the admin shell restores the stored session.

test.beforeEach(() => {
  restoreMockData();
});

test("a reload keeps the same token and the same user", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("button", { name: "Alice Parker" }),
  ).toBeVisible();
  const sessionBeforeReload = await page.evaluate(() => ({
    token: localStorage.getItem("admin-shell:auth-token"),
    user: JSON.parse(localStorage.getItem("admin-shell:auth-user")),
  }));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Alice Parker" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  const sessionAfterReload = await page.evaluate(() => ({
    token: localStorage.getItem("admin-shell:auth-token"),
    user: JSON.parse(localStorage.getItem("admin-shell:auth-user")),
  }));
  expect(sessionAfterReload.token).toBe(sessionBeforeReload.token);
  expect(sessionAfterReload.user.fullName).toBe("Alice Parker");
});
