const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");

// IR-AUTH-06 - A protected ecommerce route stays pending through a failed sign-in, then opens after login succeeds.

const PROTECTED_ROUTES = [
  { path: "/checkout", url: /\/checkout$/, emptyCart: true },
  { path: "/account", url: /\/account$/, heading: "My Account" },
  {
    path: "/order-details/order-mp20d2w4-s59o9n",
    url: /\/order-details\/order-mp20d2w4-s59o9n$/,
    heading: "Order Details",
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
    await page.getByLabel("Username or email").fill("bruno.silva");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Invalid credentials")).toBeVisible();
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(route.url);
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    if (route.emptyCart) {
      const emptyCartFrame = page.frameLocator(
        'iframe[title="Checkout Empty"]',
      );
      await expect(
        emptyCartFrame.getByRole("heading", {
          name: "There are no items in your cart",
        }),
      ).toBeVisible();
    }
    if (route.heading) {
      await expect(
        page.getByRole("heading", { name: route.heading }),
      ).toBeVisible();
    }
  });
}
