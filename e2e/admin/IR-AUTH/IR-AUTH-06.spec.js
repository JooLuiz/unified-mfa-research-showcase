const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-AUTH-06 - A protected admin route stays pending through a failed sign-in, then opens after an admin login succeeds.

const PROTECTED_ROUTES = [
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

test.beforeEach(() => {
  restoreMockData();
});
for (const route of PROTECTED_ROUTES) {
  test(`a guest opening ${route.path} returns there after login finishes`, async ({
    page,
  }) => {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Log in to MFE Lab" }),
    ).toBeVisible();
    await page.getByLabel("Username or email").fill("alice.parker");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Invalid credentials")).toBeVisible();
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(route.url);
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
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
