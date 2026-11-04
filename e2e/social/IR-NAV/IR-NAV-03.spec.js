const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { signIn } = require("../../support/sign-in");

// IR-NAV-03 - Every social media route opens in this shell.

const SIGNED_IN_ROUTES = [
  { path: "/", url: /\/$/, heading: "Trending Posts" },
  { path: "/posts", url: /\/posts$/, heading: "Community Posts" },
  {
    path: "/posts/post-02",
    url: /\/posts\/post-02$/,
    text: "Goodbye, back pain!",
  },
  { path: "/account", url: /\/account$/, heading: "My Account" },
  {
    path: "/notifications",
    url: /\/notifications$/,
    heading: "Notification Inbox",
  },
];

async function signInAsBruno(page) {
  await signIn(page, {
    username: "bruno.silva",
    tokenKey: "social-media-shell:auth-token",
    userKey: "social-media-shell:auth-user",
  });
}

test.beforeEach(() => {
  restoreMockData();
});

test("a guest can open the login page", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Log in to MFE Lab" }),
  ).toBeVisible();
});

for (const route of SIGNED_IN_ROUTES) {
  test(`a signed-in shopper can open ${route.path}`, async ({ page }) => {
    await signInAsBruno(page);
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(route.url);
    if (route.heading) {
      await expect(
        page.getByRole("heading", { name: route.heading }),
      ).toBeVisible();
    }
    if (route.text) {
      await expect(page.getByText(route.text)).toBeVisible();
    }
  });
}
