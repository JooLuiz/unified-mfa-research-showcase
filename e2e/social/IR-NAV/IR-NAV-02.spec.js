const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { signIn } = require("../../support/sign-in");

// IR-NAV-02 - A header click makes the social media shell change route.

async function signInAsBruno(page) {
  await signIn(page, {
    username: "bruno.silva",
    tokenKey: "social-media-shell:auth-token",
    userKey: "social-media-shell:auth-user",
  });
}

async function expectRoute(page, url, headingName) {
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible();
}

test.beforeEach(() => {
  restoreMockData();
});

test("guest header links change the social media route", async ({ page }) => {
  await page.goto("/posts", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Social Media" }).click();
  await expectRoute(page, /\/$/, "Trending Posts");
  await page.getByRole("button", { name: "Posts" }).click();
  await expectRoute(page, /\/posts$/, "Community Posts");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Log in" }).click();
  await expectRoute(page, /\/login$/, "Log in to MFE Lab");
});

test("signed-in header links change the social media route", async ({
  page,
}) => {
  await signInAsBruno(page);
  await page.goto("/posts", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Social Media" }).click();
  await expectRoute(page, /\/$/, "Trending Posts");
  await page.getByRole("button", { name: "Posts" }).click();
  await expectRoute(page, /\/posts$/, "Community Posts");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Bruno Silva" }).click();
  await expectRoute(page, /\/account$/, "My Account");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Notifications" }).click();
  await page.getByRole("button", { name: "See all" }).click();
  await expectRoute(page, /\/notifications$/, "Notification Inbox");
  await page.goto("/posts", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Trending Posts" }),
  ).toBeVisible();
});

test.describe("mobile header menu", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("menu links change the social media route", async ({ page }) => {
    await signInAsBruno(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Posts" }).click();
    await expectRoute(page, /\/posts$/, "Community Posts");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Account" }).click();
    await expectRoute(page, /\/account$/, "My Account");
  });
});
