const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { signIn } = require("../../support/sign-in");

// IR-NAV-04 - A protected admin route sends a guest or a customer to /login and keeps the destination.

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

async function signInAsBruno(page) {
  await signIn(page, {
    username: "bruno.silva",
    tokenKey: "admin-shell:auth-token",
    userKey: "admin-shell:auth-user",
  });
}

async function signInAsAliceThroughTheForm(page) {
  await page.getByLabel("Username or email").fill("alice.parker");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function expectProtectedRoute(page, route) {
  await expect(page).toHaveURL(route.url);
  if (route.heading) {
    await expect(
      page.getByRole("heading", { name: route.heading }),
    ).toBeVisible();
  }
  if (route.text) {
    await expect(page.getByText(route.text)).toBeVisible();
  }
}

test.beforeEach(() => {
  restoreMockData();
});

for (const route of PROTECTED_ROUTES) {
  test(`a guest opening ${route.path} is sent to login and returns there after an admin sign-in`, async ({
    page,
  }) => {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Log in to MFE Lab" }),
    ).toBeVisible();
    await signInAsAliceThroughTheForm(page);
    await expectProtectedRoute(page, route);
  });

  test(`a non-admin customer opening ${route.path} is sent to login and an admin sign-in goes to home page`, async ({
    page,
  }) => {
    await signInAsBruno(page);
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByText("This account does not have admin access."),
    ).toBeVisible();
    await signInAsAliceThroughTheForm(page);
    await expectProtectedRoute(page, {
      path: "/",
      url: /\/$/,
      heading: "Admin Dashboard",
    });
  });
}
