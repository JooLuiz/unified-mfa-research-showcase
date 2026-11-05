const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-AUTH-02 - Reloading the social media shell restores the stored session.

test.beforeEach(() => {
  restoreMockData();
});

function headerAccountButton(page, name) {
  return page
    .locator("#headerMount")
    .getByRole("button", { name, exact: true });
}

test("a reload keeps the same token and the same user", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username or email").fill("bruno.silva");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(headerAccountButton(page, "Bruno Silva")).toBeVisible();
  const sessionBeforeReload = await page.evaluate(() => ({
    token: localStorage.getItem("social-media-shell:auth-token"),
    user: JSON.parse(localStorage.getItem("social-media-shell:auth-user")),
  }));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(headerAccountButton(page, "Bruno Silva")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  const sessionAfterReload = await page.evaluate(() => ({
    token: localStorage.getItem("social-media-shell:auth-token"),
    user: JSON.parse(localStorage.getItem("social-media-shell:auth-user")),
  }));
  expect(sessionAfterReload.token).toBe(sessionBeforeReload.token);
  expect(sessionAfterReload.user.fullName).toBe("Bruno Silva");
});
