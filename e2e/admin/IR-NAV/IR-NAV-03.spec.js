const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { signIn } = require("../../support/sign-in");

// IR-NAV-03 - Every admin route opens in this shell.

const SIGNED_IN_ROUTES = [
  { path: "/", url: /\/$/, heading: "Admin Dashboard" },
  { path: "/orders", url: /\/orders$/, heading: "All Orders" },
  {
    path: "/order-details/order-mp20d2w4-s59o9n",
    url: /\/order-details\/order-mp20d2w4-s59o9n$/,
    heading: "Order Details",
  },
  { path: "/posts", url: /\/posts$/, heading: "All Posts" },
  {
    path: "/posts/post-01",
    url: /\/posts\/post-01$/,
    text: "Just set up my new minimalist desk lamp",
  },
  { path: "/account", url: /\/account$/, heading: "My Account" },
  {
    path: "/notifications",
    url: /\/notifications$/,
    heading: "Notification Inbox",
  },
];

async function signInAsAlice(page) {
  await signIn(page, {
    username: "alice.parker",
    tokenKey: "admin-shell:auth-token",
    userKey: "admin-shell:auth-user",
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
  test(`a signed-in admin can open ${route.path}`, async ({ page }) => {
    await signInAsAlice(page);
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
