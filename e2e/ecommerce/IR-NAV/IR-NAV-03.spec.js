const { test, expect } = require("@playwright/test");
const { restoreMockData } = require("../../support/reset-mock-data");
const { signIn } = require("../../support/sign-in");
// IR-NAV-03 - Every ecommerce route opens in this shell.
const SIGNED_IN_ROUTES = [
  { path: "/", url: /\/$/, iframeTitle: "FAQ Formulary" },
  { path: "/products", url: /\/products$/, heading: "Filters" },
  { path: "/promotions", url: /\/promotions$/, heading: "Upgrade Your Focus" },
  {
    path: "/product?productId=p-01",
    url: /\/product\?productId=p-01$/,
    heading: "Minimalist Desk Lamp",
  },
  { path: "/checkout", url: /\/checkout$/, emptyCart: true },
  { path: "/order-placed", url: /\/order-placed$/, heading: "Order Placed!" },
  { path: "/account", url: /\/account$/, heading: "My Account" },
  {
    path: "/notifications",
    url: /\/notifications$/,
    heading: "Notification Inbox",
  },
  {
    path: "/order-details/order-mp20d2w4-s59o9n",
    url: /\/order-details\/order-mp20d2w4-s59o9n$/,
    heading: "Order Details",
  },
];

async function signInAsBruno(page) {
  await signIn(page, {
    username: "bruno.silva",
    tokenKey: "ecommerce-shell:auth-token",
    userKey: "ecommerce-shell:auth-user",
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
    if (route.iframeTitle) {
      await expect(
        page.locator(`iframe[title="${route.iframeTitle}"]`),
      ).toBeVisible();
    }
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
