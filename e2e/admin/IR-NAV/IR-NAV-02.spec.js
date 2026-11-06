const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { signIn } = require("../../support/sign-in");

// IR-NAV-02 - A header click makes the admin shell change route.

async function signInAsAlice(page) {
  await signIn(page, {
    username: "alice.parker",
    tokenKey: "admin-shell:auth-token",
    userKey: "admin-shell:auth-user",
  });
}

async function expectRoute(page, url, headingName) {
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible();
}

async function signInThroughTheForm(page) {
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.beforeEach(() => {
  restoreMockData();
});

test("a guest Orders click opens that route after sign-in", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Orders" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signInThroughTheForm(page);
  await expectRoute(page, /\/orders$/, "All Orders");
});

test("a guest Posts click opens that route after sign-in", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Posts" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signInThroughTheForm(page);
  await expectRoute(page, /\/posts$/, "All Posts");
});

test("a guest logo click opens the dashboard after sign-in", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Admin" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signInThroughTheForm(page);
  await expectRoute(page, /\/$/, "Admin Dashboard");
});

test("signed-in header links change the admin route", async ({ page }) => {
  await signInAsAlice(page);
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Admin" }).click();
  await expectRoute(page, /\/$/, "Admin Dashboard");
  await page.getByRole("button", { name: "Orders" }).click();
  await expectRoute(page, /\/orders$/, "All Orders");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Posts" }).click();
  await expectRoute(page, /\/posts$/, "All Posts");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Alice Parker" }).click();
  await expectRoute(page, /\/account$/, "My Account");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Notifications" }).click();
  await page.getByRole("button", { name: "See all" }).click();
  await expectRoute(page, /\/notifications$/, "Notification Inbox");
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Log in to MFE Lab" }),
  ).toBeVisible();
});

test.describe("mobile header menu", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("menu links change the admin route", async ({ page }) => {
    await signInAsAlice(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Orders" }).click();
    await expectRoute(page, /\/orders$/, "All Orders");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Posts" }).click();
    await expectRoute(page, /\/posts$/, "All Posts");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Account" }).click();
    await expectRoute(page, /\/account$/, "My Account");
  });
});
